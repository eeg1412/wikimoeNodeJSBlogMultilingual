const aiSettingsService = require('./aiSettingsService')
const fs = require('fs')
const http = require('http')
const https = require('https')
const {
  createDiagnosticError,
  logDiagnostic,
  summarizeError,
  summarizeRequestBody,
  summarizeResponse,
  summarizeRuntimeSettings,
  truncateText
} = require('./coverImageAiDiagnosticService')

const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 30000
const REMOTE_IMAGE_FETCH_REDIRECT_LIMIT = 5
const GEMINI_NATIVE_FETCH_TIMEOUT_MS = 180000

function getOpenAIConstructor() {
  const OpenAIImport = require('openai')
  return OpenAIImport.default || OpenAIImport
}

function normalizeTimeout(timeoutSeconds) {
  const seconds = Number(timeoutSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 180000
  }
  return Math.round(seconds * 1000)
}

function createOpenAiClient(settings) {
  const OpenAI = getOpenAIConstructor()
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
    timeout: normalizeTimeout(settings.timeoutSeconds)
  })
}

function buildGeminiNativeGenerateContentUrl(settings) {
  const configuredBaseUrl = String(settings?.baseUrl || '').trim()
  const normalizedBaseUrl = configuredBaseUrl
    ? configuredBaseUrl
        .replace(/\/+$/, '')
        .replace(/\/openai\/v\d+$/i, '')
        .replace(/\/openai$/i, '')
    : 'https://generativelanguage.googleapis.com/v1beta'
  const model = encodeURIComponent(String(settings?.model || '').trim())
  const apiKey = encodeURIComponent(String(settings?.apiKey || '').trim())
  if (!model || !apiKey) {
    throw new Error('Gemini 原生图片生成缺少 model 或 apiKey')
  }
  return `${normalizedBaseUrl}/models/${model}:generateContent?key=${apiKey}`
}

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
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

function setValueIfEnabled(target, name, value) {
  if (value === null || typeof value === 'undefined') {
    return
  }
  if (value === '' || value === 'auto') {
    return
  }
  target[name] = value
}

function buildOpenAiImageRequest(settings, prompt) {
  const requestBody = {
    model: settings.model,
    prompt: appendPromptPrefix(prompt, settings.promptPrefix)
  }
  const requestOptions = settings.requestOptions || {}
  setValueIfEnabled(requestBody, 'size', requestOptions.size)
  setValueIfEnabled(requestBody, 'quality', requestOptions.quality)
  setValueIfEnabled(requestBody, 'output_format', requestOptions.outputFormat)
  setValueIfEnabled(
    requestBody,
    'output_compression',
    requestOptions.outputCompression
  )
  setValueIfEnabled(requestBody, 'background', requestOptions.background)
  return requestBody
}

function buildNanoBananaImageRequest(settings, prompt) {
  const requestOptions = settings.requestOptions || {}
  const requestBody = {
    model: settings.model,
    prompt: appendPromptPrefix(prompt, settings.promptPrefix),
    response_format: requestOptions.responseFormat || 'b64_json',
    n: 1
  }

  const extraBody = {}
  setValueIfEnabled(extraBody, 'aspect_ratio', requestOptions.aspectRatio)
  setValueIfEnabled(extraBody, 'image_size', requestOptions.imageSize)
  if (Object.keys(extraBody).length > 0) {
    requestBody.extra_body = extraBody
  }
  return requestBody
}

function buildImageGenerationRequest(settings, prompt) {
  if (settings.provider === 'openai') {
    return buildOpenAiImageRequest(settings, prompt)
  }
  if (settings.provider === 'nano-banana') {
    return buildNanoBananaImageRequest(settings, prompt)
  }
  throw new Error(`unsupported image generation provider: ${settings.provider}`)
}

function buildGeminiNativeContentParts(prompt, sourceImageDataUrl) {
  const promptText = String(prompt || '').trim()
  if (!promptText) {
    throw new Error('Gemini 原生图片生成 prompt 为空')
  }
  const imagePayload = extractImagePayloadFromUrlValue(
    sourceImageDataUrl,
    'source'
  )
  if (!imagePayload || !imagePayload.base64) {
    throw new Error('Gemini 原生图片编辑要求传入 data URL 图片')
  }
  return [
    {
      text: promptText
    },
    {
      inlineData: {
        mimeType: imagePayload.mimeType || 'image/png',
        data: imagePayload.base64
      }
    }
  ]
}

function buildGeminiNativeGenerationConfig(requestOptions = {}, selectedRatio) {
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

function summarizeGeminiNativeRequestBody(requestBody, requestUrl = '') {
  const summary = {
    model: normalizeText(requestBody?.model),
    requestUrl: truncateText(requestUrl, 220),
    contents: Array.isArray(requestBody?.contents)
      ? requestBody.contents.slice(0, 5).map(item => {
          return {
            role: normalizeText(item?.role),
            partCount: Array.isArray(item?.parts) ? item.parts.length : 0,
            parts: Array.isArray(item?.parts)
              ? item.parts.slice(0, 5).map(part => {
                  if (part.text) {
                    return {
                      type: 'text',
                      textLength: part.text.length,
                      textPreview: truncateText(part.text)
                    }
                  }
                  if (part.inlineData) {
                    return {
                      type: 'inlineData',
                      mimeType: normalizeText(part.inlineData.mimeType),
                      dataLength: normalizeText(part.inlineData.data).length
                    }
                  }
                  return {
                    type: 'unknown',
                    keys: Object.keys(part || {})
                      .sort()
                      .slice(0, 10)
                  }
                })
              : []
          }
        })
      : [],
    generationConfig: requestBody?.generationConfig || null
  }
  return summary
}

function summarizeGeminiNativeResponse(response) {
  if (!response || typeof response !== 'object') {
    return null
  }
  return {
    keys: Object.keys(response).sort().slice(0, 20),
    candidateCount: Array.isArray(response.candidates)
      ? response.candidates.length
      : 0,
    usageMetadata:
      response.usageMetadata && typeof response.usageMetadata === 'object'
        ? { ...response.usageMetadata }
        : null,
    promptFeedback:
      response.promptFeedback && typeof response.promptFeedback === 'object'
        ? { ...response.promptFeedback }
        : null
  }
}

function extractBase64FromGeminiNativeResponse(response) {
  const candidates = Array.isArray(response?.candidates)
    ? response.candidates
    : []
  for (
    let candidateIndex = 0;
    candidateIndex < candidates.length;
    candidateIndex += 1
  ) {
    const candidate = candidates[candidateIndex]
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : []
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex]
      if (part?.inlineData?.data) {
        return {
          mimeType: part.inlineData.mimeType || 'image/png',
          base64: part.inlineData.data,
          sourcePath: `candidates[${candidateIndex}].content.parts[${partIndex}].inlineData.data`
        }
      }
    }
  }
  return null
}

async function sendGeminiNativeGenerateContentRequest(
  settings,
  requestBody,
  requestUrl = ''
) {
  const targetUrl = requestUrl || buildGeminiNativeGenerateContentUrl(settings)
  const payloadText = JSON.stringify(requestBody)
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: payloadText,
    signal: AbortSignal.timeout(
      normalizeTimeout(settings.timeoutSeconds) ||
        GEMINI_NATIVE_FETCH_TIMEOUT_MS
    )
  })
  const responseText = await response.text()
  let responseJson = null
  if (responseText) {
    try {
      responseJson = JSON.parse(responseText)
    } catch (error) {
      responseJson = null
    }
  }
  if (!response.ok) {
    const providerError = new Error(
      responseJson?.error?.message || responseText || `HTTP ${response.status}`
    )
    providerError.status = response.status
    providerError.code = normalizeText(responseJson?.error?.status)
    providerError.type = normalizeText(
      responseJson?.error?.details?.[0]?.['@type']
    )
    providerError.error = responseJson?.error || null
    providerError.response = {
      status: response.status,
      data: responseJson,
      text: responseText
    }
    throw providerError
  }
  if (!responseJson || typeof responseJson !== 'object') {
    throw new Error('Gemini 原生图片生成返回了非 JSON 响应')
  }
  return responseJson
}

function extractImagePayloadFromUrlValue(value, sourcePath = '') {
  const text = String(value || '').trim()
  const match = text.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return {
      mimeType: match[1],
      base64: match[2],
      sourcePath
    }
  }
  if (/^https?:\/\//i.test(text)) {
    return {
      mimeType: '',
      imageUrl: text,
      sourcePath
    }
  }
  return null
}

function extractBase64FromContentPart(part, sourcePath = '') {
  if (!part || typeof part !== 'object') {
    return null
  }
  if (part.b64_json) {
    return {
      mimeType: 'image/png',
      base64: part.b64_json,
      sourcePath: sourcePath ? `${sourcePath}.b64_json` : 'b64_json'
    }
  }
  if (part.image_url && typeof part.image_url.url === 'string') {
    return extractImagePayloadFromUrlValue(
      part.image_url.url,
      sourcePath ? `${sourcePath}.image_url.url` : 'image_url.url'
    )
  }
  if (part.inline_data && part.inline_data.data) {
    return {
      mimeType: part.inline_data.mime_type || 'image/png',
      base64: part.inline_data.data,
      sourcePath: sourcePath
        ? `${sourcePath}.inline_data.data`
        : 'inline_data.data'
    }
  }
  if (part.type === 'image_url' && part.image_url?.url) {
    return extractImagePayloadFromUrlValue(
      part.image_url.url,
      sourcePath ? `${sourcePath}.image_url.url` : 'image_url.url'
    )
  }
  return null
}

function extractBase64FromImageResponse(response) {
  const imageData = response?.data?.[0]
  if (imageData?.b64_json) {
    return {
      mimeType: 'image/png',
      base64: imageData.b64_json,
      sourcePath: 'data[0].b64_json'
    }
  }
  if (typeof imageData?.url === 'string') {
    return extractImagePayloadFromUrlValue(imageData.url, 'data[0].url')
  }

  const outputList = Array.isArray(response?.output) ? response.output : []
  for (let outputIndex = 0; outputIndex < outputList.length; outputIndex += 1) {
    const output = outputList[outputIndex]
    if (output?.type === 'image_generation_call' && output.result) {
      return {
        mimeType: 'image/png',
        base64: output.result,
        sourcePath: `output[${outputIndex}].result`
      }
    }
    const contentList = Array.isArray(output?.content) ? output.content : []
    for (
      let contentIndex = 0;
      contentIndex < contentList.length;
      contentIndex += 1
    ) {
      const content = contentList[contentIndex]
      const result = extractBase64FromContentPart(
        content,
        `output[${outputIndex}].content[${contentIndex}]`
      )
      if (result) {
        return result
      }
    }
  }

  const message = response?.choices?.[0]?.message
  const messageImages = Array.isArray(message?.images) ? message.images : []
  for (let imageIndex = 0; imageIndex < messageImages.length; imageIndex += 1) {
    const image = messageImages[imageIndex]
    const result = extractBase64FromContentPart(
      image,
      `choices[0].message.images[${imageIndex}]`
    )
    if (result) {
      return result
    }
  }
  const messageContent = Array.isArray(message?.content) ? message.content : []
  for (
    let contentIndex = 0;
    contentIndex < messageContent.length;
    contentIndex += 1
  ) {
    const content = messageContent[contentIndex]
    const result = extractBase64FromContentPart(
      content,
      `choices[0].message.content[${contentIndex}]`
    )
    if (result) {
      return result
    }
  }

  return null
}

function summarizeExtractedImage(extractedImage) {
  if (!extractedImage || typeof extractedImage !== 'object') {
    return null
  }
  return {
    sourcePath: normalizeText(extractedImage.sourcePath),
    mimeType: normalizeText(extractedImage.mimeType),
    base64Length: normalizeText(extractedImage.base64).length,
    imageUrlPreview: extractedImage.imageUrl
      ? truncateText(extractedImage.imageUrl, 180)
      : '',
    transport: extractedImage.imageUrl ? 'remote-url' : 'inline'
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
    request:
      options.requestSummary || summarizeRequestBody(options.requestBody),
    response: options.responseSummary || null,
    extraction: options.extractionSummary || null,
    error: options.errorSummary || null
  }
}

async function downloadRemoteImageBuffer(imageUrl, redirectCount = 0) {
  if (redirectCount > REMOTE_IMAGE_FETCH_REDIRECT_LIMIT) {
    throw new Error('AI 图片地址重定向次数过多')
  }
  const parsedUrl = new URL(imageUrl)
  const transport = parsedUrl.protocol === 'https:' ? https : http
  return await new Promise((resolve, reject) => {
    const request = transport.get(
      parsedUrl,
      {
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'wikimoe-ai-image-fetch/1.0'
        },
        timeout: REMOTE_IMAGE_FETCH_TIMEOUT_MS
      },
      response => {
        const statusCode = Number(response.statusCode || 0)
        const location = normalizeText(response.headers.location)
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume()
          let redirectUrl = ''
          try {
            redirectUrl = new URL(location, parsedUrl).toString()
          } catch (error) {
            reject(new Error('AI 图片地址重定向目标不合法'))
            return
          }
          downloadRemoteImageBuffer(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject)
          return
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.resume()
          reject(new Error(`AI 图片下载失败：HTTP ${statusCode}`))
          return
        }
        const chunkList = []
        response.on('data', chunk => {
          chunkList.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          const buffer = Buffer.concat(chunkList)
          if (!buffer.length) {
            reject(new Error('AI 图片下载结果为空'))
            return
          }
          resolve({
            buffer,
            mimeType: normalizeText(response.headers['content-type'])
              .split(';')[0]
              .trim(),
            finalUrl: parsedUrl.toString()
          })
        })
        response.on('error', reject)
      }
    )
    request.on('timeout', () => {
      request.destroy(new Error('AI 图片下载超时'))
    })
    request.on('error', reject)
  })
}

async function resolveExtractedImageBuffer(extractedImage) {
  if (extractedImage?.base64) {
    return {
      mimeType: extractedImage.mimeType || 'image/png',
      buffer: Buffer.from(extractedImage.base64, 'base64')
    }
  }
  if (extractedImage?.imageUrl) {
    const downloadedImage = await downloadRemoteImageBuffer(
      extractedImage.imageUrl
    )
    return {
      mimeType:
        downloadedImage.mimeType || extractedImage.mimeType || 'image/png',
      buffer: downloadedImage.buffer
    }
  }
  throw new Error('AI 图片返回中缺少可保存的图片数据')
}

function setOpenAiImageEditOption(requestBody, name, value) {
  if (value === null || typeof value === 'undefined') {
    return
  }
  if (value === '' || value === 'auto') {
    return
  }
  requestBody[name] = value
}

async function generateOpenAiCoverImage({
  client,
  settings,
  prompt,
  sourceFilePath,
  selectedRatio,
  diagnosticContext = null
}) {
  const requestOptions = settings.requestOptions || {}
  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  const requestBody = {
    model: settings.model,
    image: fs.createReadStream(sourceFilePath),
    prompt,
    n: 1
  }
  setOpenAiImageEditOption(
    requestBody,
    'size',
    selectedRatio?.value || requestOptions.size
  )
  setOpenAiImageEditOption(requestBody, 'quality', requestOptions.quality)
  setOpenAiImageEditOption(
    requestBody,
    'output_format',
    requestOptions.outputFormat
  )
  setOpenAiImageEditOption(
    requestBody,
    'output_compression',
    requestOptions.outputCompression
  )
  setOpenAiImageEditOption(requestBody, 'background', requestOptions.background)
  try {
    const response = await client.images.edit(requestBody)
    const responseSummary = summarizeResponse(response)
    const extractedImage = extractBase64FromImageResponse(response)
    if (!extractedImage) {
      const diagnostics = buildGenerationDiagnostics({
        settings,
        requestBody,
        responseSummary,
        diagnosticContext
      })
      logDiagnostic('error', 'generation.response_without_image', diagnostics)
      throw createDiagnosticError('OpenAI Image API 未返回图片', diagnostics)
    }
    const resolvedImage = await resolveExtractedImageBuffer(extractedImage)
    logDiagnostic(
      'info',
      'generation.success',
      buildGenerationDiagnostics({
        settings,
        requestBody,
        responseSummary,
        diagnosticContext,
        extractionSummary: summarizeExtractedImage(extractedImage)
      })
    )
    return {
      provider: settings.provider,
      model: settings.model,
      mimeType: resolvedImage.mimeType,
      buffer: resolvedImage.buffer,
      rawResponseId: response?.id || ''
    }
  } catch (error) {
    if (error?.diagnostics) {
      throw error
    }
    const diagnostics = buildGenerationDiagnostics({
      settings,
      requestBody,
      diagnosticContext,
      errorSummary: summarizeError(error)
    })
    logDiagnostic('error', 'generation.request_failed', diagnostics)
    throw createDiagnosticError(
      error?.message || 'OpenAI 图像生成失败',
      diagnostics
    )
  }
}

async function generateNanoBananaCoverImage({
  settings,
  prompt,
  sourceImageDataUrl,
  selectedRatio,
  diagnosticContext = null
}) {
  const requestOptions = settings.requestOptions || {}
  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  const requestBody = {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: buildGeminiNativeContentParts(prompt, sourceImageDataUrl)
      }
    ],
    generationConfig: buildGeminiNativeGenerationConfig(
      requestOptions,
      selectedRatio
    )
  }
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
    if (!extractedImage) {
      const diagnostics = buildGenerationDiagnostics({
        settings,
        requestSummary,
        responseSummary,
        diagnosticContext
      })
      logDiagnostic('error', 'generation.response_without_image', diagnostics)
      throw createDiagnosticError(
        'Nano Banana 未返回图片，不能在无参考图结果下继续',
        diagnostics
      )
    }
    const resolvedImage = await resolveExtractedImageBuffer(extractedImage)
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
      mimeType: resolvedImage.mimeType,
      buffer: resolvedImage.buffer,
      rawResponseId:
        response?.responseId || response?.candidates?.[0]?.responseId || ''
    }
  } catch (error) {
    if (error?.diagnostics) {
      throw error
    }
    const diagnostics = buildGenerationDiagnostics({
      settings,
      requestSummary,
      diagnosticContext,
      errorSummary: summarizeError(error)
    })
    logDiagnostic('error', 'generation.request_failed', diagnostics)
    throw createDiagnosticError(
      error?.message || 'Nano Banana 图像生成失败',
      diagnostics
    )
  }
}

async function generateCoverImage(options = {}) {
  if (!options.settings || !options.settings.provider) {
    throw new Error('image generation settings is required')
  }
  if (!options.prompt) {
    throw new Error('image generation prompt is required')
  }
  if (!options.sourceFilePath) {
    throw new Error('source image path is required')
  }

  if (options.settings.provider === 'openai') {
    const client = options.client || createOpenAiClient(options.settings)
    return await generateOpenAiCoverImage({
      client,
      settings: options.settings,
      prompt: options.prompt,
      sourceFilePath: options.sourceFilePath,
      selectedRatio: options.selectedRatio,
      diagnosticContext: options.diagnosticContext
    })
  }
  if (options.settings.provider === 'nano-banana') {
    return await generateNanoBananaCoverImage({
      settings: options.settings,
      prompt: options.prompt,
      sourceImageDataUrl: options.sourceImageDataUrl,
      selectedRatio: options.selectedRatio,
      diagnosticContext: options.diagnosticContext
    })
  }
  throw new Error(
    `unsupported image generation provider: ${options.settings.provider}`
  )
}

async function createConfiguredImageGenerationClient() {
  const settings = await aiSettingsService.getImageGenerationRuntimeSettings()
  return {
    client: createOpenAiClient(settings),
    settings
  }
}

module.exports = {
  buildImageGenerationRequest,
  createConfiguredImageGenerationClient,
  createOpenAiClient,
  extractBase64FromImageResponse,
  generateCoverImage
}
