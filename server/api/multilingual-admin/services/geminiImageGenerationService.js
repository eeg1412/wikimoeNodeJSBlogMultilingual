const aiSettingsService = require('./aiSettingsService')
const {
  createDiagnosticError,
  logDiagnostic,
  summarizeError,
  summarizeRuntimeSettings
} = require('./coverImageAiDiagnosticService')
const {
  buildGeminiNativeGenerateContentUrl,
  buildInlineDataPartFromDataUrl,
  buildTextPart,
  extractBase64FromGeminiNativeResponse,
  sendGeminiNativeGenerateContentRequest,
  summarizeGeminiNativeRequestBody,
  summarizeGeminiNativeResponse
} = require('./geminiNativeApiService')
const { recordGeminiUsageLog } = require('./geminiUsageLogService')

function summarizeExtractedImage(extractedImage) {
  if (!extractedImage || typeof extractedImage !== 'object') {
    return null
  }
  return {
    sourcePath: extractedImage.sourcePath || '',
    mimeType: extractedImage.mimeType || '',
    base64Length: String(extractedImage.base64 || '').length,
    transport: 'inline'
  }
}

function appendPromptPrefix(prompt, promptPrefix) {
  const normalizedPrompt = String(prompt || '').trim()
  const normalizedPrefix = String(promptPrefix || '').trim()
  if (!normalizedPrefix) {
    return normalizedPrompt
  }
  if (!normalizedPrompt) {
    return normalizedPrefix
  }
  return `${normalizedPrefix}\n\n${normalizedPrompt}`
}

function buildGeminiGenerationConfig(requestOptions = {}, selectedRatio) {
  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE']
  }
  const imageConfig = {}
  const aspectRatio = selectedRatio?.value || requestOptions.aspectRatio
  if (aspectRatio && aspectRatio !== 'auto') {
    imageConfig.aspectRatio = aspectRatio
  }
  if (requestOptions.imageSize) {
    imageConfig.imageSize = requestOptions.imageSize
  }
  if (Object.keys(imageConfig).length > 0) {
    generationConfig.imageConfig = imageConfig
  }
  return generationConfig
}

function buildGenerationRequest(
  settings,
  prompt,
  sourceImageDataUrl,
  selectedRatio
) {
  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [
          buildTextPart(appendPromptPrefix(prompt, settings.promptPrefix)),
          buildInlineDataPartFromDataUrl(sourceImageDataUrl, 'source')
        ]
      }
    ],
    generationConfig: buildGeminiGenerationConfig(
      settings.requestOptions,
      selectedRatio
    )
  }
}

function buildGenerationDiagnostics(options = {}) {
  return {
    layer: 'image-generation-client',
    context:
      options.diagnosticContext && typeof options.diagnosticContext === 'object'
        ? { ...options.diagnosticContext }
        : {},
    runtime: summarizeRuntimeSettings(options.settings),
    request: options.requestSummary || null,
    response: options.responseSummary || null,
    extraction: options.extractionSummary || null,
    error: options.errorSummary || null
  }
}

async function generateCoverImage(options = {}) {
  const settings = options.settings
  const diagnosticContext =
    options.diagnosticContext && typeof options.diagnosticContext === 'object'
      ? { ...options.diagnosticContext }
      : {}
  const operation = 'cover.image.generation'
  if (!settings || settings.provider !== 'gemini') {
    throw new Error('Gemini 图像生成 settings 未配置')
  }
  if (!options.prompt) {
    throw new Error('image generation prompt is required')
  }
  if (!options.sourceImageDataUrl) {
    throw new Error('source image data url is required')
  }

  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  const requestBody = buildGenerationRequest(
    settings,
    options.prompt,
    options.sourceImageDataUrl,
    options.selectedRatio
  )
  const requestSummary = summarizeGeminiNativeRequestBody(
    requestBody,
    requestUrl
  )

  try {
    const response = await sendGeminiNativeGenerateContentRequest(
      settings,
      requestBody,
      requestUrl
    )
    const responseSummary = summarizeGeminiNativeResponse(response)
    const extractedImage = extractBase64FromGeminiNativeResponse(response)
    if (!extractedImage || !extractedImage.base64) {
      await recordGeminiUsageLog({
        settings,
        operation,
        status: 'error',
        response,
        context: diagnosticContext,
        failureCode: 'NO_IMAGE',
        resultType: 'text'
      })
      const diagnostics = buildGenerationDiagnostics({
        settings,
        requestSummary,
        responseSummary,
        diagnosticContext
      })
      logDiagnostic('error', 'generation.response_without_image', diagnostics)
      throw createDiagnosticError(
        'Gemini 图像生成未返回图片，不能在无参考图结果下继续',
        diagnostics
      )
    }

    await recordGeminiUsageLog({
      settings,
      operation,
      status: 'success',
      response,
      context: diagnosticContext,
      meta: {
        outputMimeType: extractedImage.mimeType || 'image/png'
      },
      resultType: 'image'
    })

    logDiagnostic(
      'info',
      'generation.success',
      buildGenerationDiagnostics({
        settings,
        requestSummary,
        responseSummary,
        diagnosticContext,
        extractionSummary: summarizeExtractedImage(extractedImage)
      })
    )

    return {
      provider: settings.provider,
      model: settings.model,
      mimeType: extractedImage.mimeType || 'image/png',
      buffer: Buffer.from(extractedImage.base64, 'base64'),
      rawResponseId: response?.responseId || '',
      requestSummary,
      responseSummary
    }
  } catch (error) {
    if (error?.diagnostics) {
      throw error
    }
    let failureCode = 'REQUEST_FAILED'
    if (/timeout|timed out/i.test(error.message || '')) {
      failureCode = 'REQUEST_TIMEOUT'
    }
    await recordGeminiUsageLog({
      settings,
      operation,
      status: 'error',
      error,
      context: diagnosticContext,
      failureCode,
      failureReason: error?.message || ''
    })
    const diagnostics = buildGenerationDiagnostics({
      settings,
      requestSummary,
      diagnosticContext,
      errorSummary: summarizeError(error)
    })
    logDiagnostic('error', 'generation.request_failed', diagnostics)
    throw createDiagnosticError(
      error?.message || 'Gemini 图像生成失败',
      diagnostics
    )
  }
}

async function createConfiguredImageGenerationClient() {
  const settings = await aiSettingsService.getImageGenerationRuntimeSettings()
  return { settings }
}

module.exports = {
  createConfiguredImageGenerationClient,
  generateCoverImage
}
