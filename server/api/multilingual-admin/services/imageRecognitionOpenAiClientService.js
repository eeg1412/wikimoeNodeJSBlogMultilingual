const aiSettingsService = require('./aiSettingsService')
const { createOpenAiClient } = require('./imageGenerationOpenAiClientService')
const {
  logDiagnostic,
  summarizeError,
  summarizeRequestBody,
  summarizeResponse,
  summarizeRuntimeSettings,
  truncateText
} = require('./coverImageAiDiagnosticService')
const { zodResponseFormat } = require('openai/helpers/zod')
const { z } = require('zod')
const {
  COVER_IMAGE_RECOGNITION_SCHEMA,
  COVER_IMAGE_RECOGNITION_VERSION,
  parseImageRecognitionResult
} = require('../utils/coverImageTranslationUtils')

const coverImageRecognitionResultSchema = z
  .object({
    schema: z.string(),
    version: z.number(),
    containsTitle: z.boolean(),
    recognizedTitleText: z.string(),
    confidence: z.number().min(0).max(1),
    titleRegion: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0).max(1),
        height: z.number().min(0).max(1)
      })
      .strict(),
    reason: z.string(),
    shouldTranslate: z.boolean()
  })
  .strict()

function normalizeErrorText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function buildResponsePreview(text, maxLength = 240) {
  const normalizedText = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalizedText) {
    return ''
  }
  if (normalizedText.length <= maxLength) {
    return normalizedText
  }
  return `${normalizedText.slice(0, maxLength)}...`
}

function summarizeRecognitionResult(result) {
  if (!result || typeof result !== 'object') {
    return null
  }
  return {
    schema: normalizeErrorText(result.schema),
    version: Number(result.version || 0),
    containsTitle: result.containsTitle === true,
    shouldTranslate: result.shouldTranslate === true,
    confidence: Number(result.confidence || 0),
    recognizedTitleTextPreview: truncateText(result.recognizedTitleText),
    titleRegion: result.titleRegion || null
  }
}

function buildRecognitionDiagnostics(options = {}) {
  return {
    layer: 'image-recognition-client',
    context:
      options.diagnosticContext && typeof options.diagnosticContext === 'object'
        ? { ...options.diagnosticContext }
        : {},
    runtime: summarizeRuntimeSettings(options.settings),
    request: summarizeRequestBody(options.requestBody),
    response: options.responseSummary || null,
    parse: options.parseSummary || null,
    result: options.resultSummary || null,
    error: options.errorSummary || null
  }
}

function getProviderRequestId(error) {
  const headerRequestId =
    error?.headers?.['x-request-id'] ||
    error?.response?.headers?.['x-request-id'] ||
    error?.response?.headers?.['request-id']
  return normalizeErrorText(error?.request_id || headerRequestId)
}

function extractProviderErrorSummary(error) {
  const status = Number(error?.status || error?.response?.status || 0)
  const nestedError =
    error?.error || error?.response?.data?.error || error?.body?.error || {}
  const primaryMessage = normalizeErrorText(error?.message)
  const nestedMessage = normalizeErrorText(nestedError?.message)
  const message =
    nestedMessage && nestedMessage !== primaryMessage
      ? `${nestedMessage}（${primaryMessage}）`
      : nestedMessage || primaryMessage
  const details = []
  if (status > 0) {
    details.push(`HTTP ${status}`)
  }
  const code = normalizeErrorText(error?.code || nestedError?.code)
  if (code) {
    details.push(`code=${code}`)
  }
  const type = normalizeErrorText(error?.type || nestedError?.type)
  if (type) {
    details.push(`type=${type}`)
  }
  const param = normalizeErrorText(nestedError?.param)
  if (param) {
    details.push(`param=${param}`)
  }
  const requestId = getProviderRequestId(error)
  if (requestId) {
    details.push(`requestId=${requestId}`)
  }
  return {
    message,
    detailText: details.join(', ')
  }
}

function appendErrorDetails(message, detailText) {
  const normalizedMessage = normalizeErrorText(message)
  const normalizedDetailText = normalizeErrorText(detailText)
  if (!normalizedDetailText) {
    return normalizedMessage
  }
  if (!normalizedMessage) {
    return normalizedDetailText
  }
  return `${normalizedMessage}（${normalizedDetailText}）`
}

function getMessageText(message) {
  const content = message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item
        }
        if (item && typeof item.text === 'string') {
          return item.text
        }
        return ''
      })
      .join('')
  }
  return ''
}

function buildImageContent(settings, imageDataUrl) {
  const imageUrl = {
    url: imageDataUrl
  }
  if (settings.provider === 'openai') {
    const detail = settings.requestOptions?.detail || 'high'
    if (detail) {
      imageUrl.detail = detail
    }
  }
  return {
    type: 'image_url',
    image_url: imageUrl
  }
}

function buildOpenAiRecognitionRequest(settings, prompt, imageDataUrl) {
  return {
    model: settings.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          buildImageContent(settings, imageDataUrl)
        ]
      }
    ],
    response_format: { type: 'json_object' }
  }
}

function buildGeminiRecognitionRequest(settings, prompt, imageDataUrl) {
  return {
    model: settings.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          buildImageContent(settings, imageDataUrl)
        ]
      }
    ],
    response_format: zodResponseFormat(
      coverImageRecognitionResultSchema,
      'cover_image_recognition_result'
    )
  }
}

function buildRecognitionRequest(settings, prompt, imageDataUrl) {
  if (settings.provider === 'gemini') {
    return buildGeminiRecognitionRequest(settings, prompt, imageDataUrl)
  }

  return buildOpenAiRecognitionRequest(settings, prompt, imageDataUrl)
}

function createRecognitionFailure(
  settings,
  errorCode,
  errorMessage,
  diagnostics = null
) {
  return {
    ok: false,
    provider: settings?.provider || '',
    model: settings?.model || '',
    errorCode,
    errorMessage,
    diagnostics
  }
}

async function recognizeCoverTitle(options = {}) {
  const settings = options.runtimeSettings
  const diagnosticContext =
    options.diagnosticContext && typeof options.diagnosticContext === 'object'
      ? { ...options.diagnosticContext }
      : {}
  if (!settings || !settings.provider || !settings.apiKey) {
    return createRecognitionFailure(
      settings,
      'PROVIDER_NOT_CONFIGURED',
      '图像识别 provider 未配置'
    )
  }
  if (!options.imageDataUrl) {
    return createRecognitionFailure(
      settings,
      'INVALID_IMAGE_INPUT',
      '图像识别输入图片为空'
    )
  }

  const client = createOpenAiClient(settings)
  const requestBody = buildRecognitionRequest(
    settings,
    options.prompt,
    options.imageDataUrl
  )

  try {
    const completion =
      settings.provider === 'gemini'
        ? await client.chat.completions.parse(requestBody)
        : await client.chat.completions.create(requestBody)
    const responseSummary = summarizeResponse(completion)
    const message = completion?.choices?.[0]?.message
    const parsedMessage = message?.parsed
    const rawText = getMessageText(message).trim()
    const rawResult = parsedMessage || rawText
    const parseSummary = {
      parsedPresent: typeof parsedMessage !== 'undefined',
      rawResultType: parsedMessage ? 'parsed' : 'text',
      rawTextLength: rawText.length,
      rawTextPreview: truncateText(rawText)
    }
    if (!rawResult) {
      const diagnostics = buildRecognitionDiagnostics({
        settings,
        requestBody,
        responseSummary,
        parseSummary,
        diagnosticContext
      })
      logDiagnostic('error', 'recognition.empty_response', diagnostics)
      return createRecognitionFailure(
        settings,
        'EMPTY_RESPONSE',
        '图像识别 provider 未返回文本',
        diagnostics
      )
    }
    let result = null
    try {
      result = parseImageRecognitionResult(
        rawResult,
        options.confidenceThreshold || settings.confidenceThreshold
      )
    } catch (error) {
      const responsePreview = buildResponsePreview(rawText)
      const diagnostics = buildRecognitionDiagnostics({
        settings,
        requestBody,
        responseSummary,
        parseSummary,
        diagnosticContext,
        errorSummary: summarizeError(error)
      })
      if (error && error.name === 'SyntaxError') {
        logDiagnostic('error', 'recognition.invalid_json', diagnostics)
        return createRecognitionFailure(
          settings,
          'INVALID_JSON',
          appendErrorDetails(
            '图像识别返回内容不是合法 JSON',
            responsePreview ? `原始返回：${responsePreview}` : ''
          ),
          diagnostics
        )
      }
      if (
        error &&
        /schema|version|confidence|titleRegion|containsTitle|shouldTranslate/.test(
          error.message || ''
        )
      ) {
        logDiagnostic('error', 'recognition.invalid_schema', diagnostics)
        return createRecognitionFailure(
          settings,
          'INVALID_SCHEMA',
          appendErrorDetails(
            error.message,
            responsePreview ? `原始返回：${responsePreview}` : ''
          ),
          diagnostics
        )
      }
      logDiagnostic('error', 'recognition.invalid_response', diagnostics)
      return createRecognitionFailure(
        settings,
        'INVALID_RESPONSE',
        appendErrorDetails(
          error?.message || '图像识别返回内容不符合要求',
          responsePreview ? `原始返回：${responsePreview}` : ''
        ),
        diagnostics
      )
    }
    logDiagnostic(
      'info',
      'recognition.success',
      buildRecognitionDiagnostics({
        settings,
        requestBody,
        responseSummary,
        parseSummary,
        diagnosticContext,
        resultSummary: summarizeRecognitionResult(result)
      })
    )
    return {
      ok: true,
      provider: settings.provider,
      model: settings.model,
      result,
      rawText
    }
  } catch (error) {
    const providerErrorSummary = extractProviderErrorSummary(error)
    const diagnostics = buildRecognitionDiagnostics({
      settings,
      requestBody,
      diagnosticContext,
      errorSummary: summarizeError(error)
    })
    if (error && /timeout|timed out/i.test(error.message || '')) {
      logDiagnostic('error', 'recognition.request_timeout', diagnostics)
      return createRecognitionFailure(
        settings,
        'REQUEST_TIMEOUT',
        appendErrorDetails('图像识别请求超时', providerErrorSummary.detailText),
        diagnostics
      )
    }
    logDiagnostic('error', 'recognition.request_failed', diagnostics)
    return createRecognitionFailure(
      settings,
      'REQUEST_FAILED',
      appendErrorDetails(
        providerErrorSummary.message || '图像识别请求失败',
        providerErrorSummary.detailText
      ),
      diagnostics
    )
  }
}

async function createConfiguredImageRecognitionClient() {
  const settings = await aiSettingsService.getImageRecognitionRuntimeSettings()
  return { settings }
}

module.exports = {
  buildRecognitionRequest,
  createConfiguredImageRecognitionClient,
  recognizeCoverTitle
}
