const aiSettingsService = require('./aiSettingsService')
const {
  logDiagnostic,
  summarizeError,
  summarizeRuntimeSettings,
  truncateText
} = require('./coverImageAiDiagnosticService')
const {
  buildGeminiNativeGenerateContentUrl,
  buildInlineDataPartFromDataUrl,
  buildTextPart,
  extractTextFromGeminiNativeResponse,
  sendGeminiNativeGenerateContentRequest,
  summarizeGeminiNativeRequestBody,
  summarizeGeminiNativeResponse
} = require('./geminiNativeApiService')
const { recordGeminiUsageLog } = require('./geminiUsageLogService')
const {
  COVER_IMAGE_RECOGNITION_SCHEMA,
  COVER_IMAGE_RECOGNITION_VERSION,
  parseImageRecognitionResult
} = require('../utils/coverImageTranslationUtils')

const coverImageRecognitionResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schema',
    'version',
    'containsTitle',
    'recognizedTitleText',
    'confidence',
    'titleRegion',
    'reason',
    'shouldTranslate'
  ],
  properties: {
    schema: {
      type: 'string',
      enum: [COVER_IMAGE_RECOGNITION_SCHEMA]
    },
    version: {
      type: 'integer',
      enum: [COVER_IMAGE_RECOGNITION_VERSION]
    },
    containsTitle: {
      type: 'boolean'
    },
    recognizedTitleText: {
      type: 'string'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    titleRegion: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'width', 'height'],
      properties: {
        x: {
          type: 'number',
          minimum: 0,
          maximum: 1
        },
        y: {
          type: 'number',
          minimum: 0,
          maximum: 1
        },
        width: {
          type: 'number',
          minimum: 0,
          maximum: 1
        },
        height: {
          type: 'number',
          minimum: 0,
          maximum: 1
        }
      }
    },
    reason: {
      type: 'string'
    },
    shouldTranslate: {
      type: 'boolean'
    }
  }
}

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
    request: options.requestSummary || null,
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

function buildRecognitionRequest(settings, prompt, imageDataUrl) {
  const generationConfig = {
    responseMimeType: 'application/json',
    responseJsonSchema: coverImageRecognitionResponseJsonSchema
  }
  const mediaResolution = settings.requestOptions?.mediaResolution
  if (mediaResolution) {
    generationConfig.mediaResolution = mediaResolution
  }
  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [
          buildTextPart(prompt),
          buildInlineDataPartFromDataUrl(imageDataUrl, 'image')
        ]
      }
    ],
    generationConfig
  }
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
  const operation = 'cover.image.recognition'
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

  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  const requestBody = buildRecognitionRequest(
    settings,
    options.prompt,
    options.imageDataUrl
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
    const extractedText = extractTextFromGeminiNativeResponse(response)
    const rawText = extractedText?.text || ''
    const parseSummary = {
      rawResultType: rawText ? 'text' : 'empty',
      rawTextLength: rawText.length,
      rawTextPreview: truncateText(rawText)
    }
    if (!rawText) {
      await recordGeminiUsageLog({
        settings,
        operation,
        status: 'error',
        response,
        context: diagnosticContext,
        meta: {
          confidenceThreshold:
            options.confidenceThreshold || settings.confidenceThreshold
        },
        failureCode: 'EMPTY_RESPONSE',
        resultType: 'empty'
      })
      const diagnostics = buildRecognitionDiagnostics({
        settings,
        requestSummary,
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
        rawText,
        options.confidenceThreshold || settings.confidenceThreshold
      )
    } catch (error) {
      let failureCode = 'INVALID_RESPONSE'
      if (error && error.name === 'SyntaxError') {
        failureCode = 'INVALID_JSON'
      } else if (
        error &&
        /schema|version|confidence|titleRegion|containsTitle|shouldTranslate/.test(
          error.message || ''
        )
      ) {
        failureCode = 'INVALID_SCHEMA'
      }
      await recordGeminiUsageLog({
        settings,
        operation,
        status: 'error',
        response,
        context: diagnosticContext,
        meta: {
          confidenceThreshold:
            options.confidenceThreshold || settings.confidenceThreshold
        },
        failureCode,
        failureReason: error?.message || '',
        resultType: 'text'
      })
      const responsePreview = buildResponsePreview(rawText)
      const diagnostics = buildRecognitionDiagnostics({
        settings,
        requestSummary,
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

    await recordGeminiUsageLog({
      settings,
      operation,
      status: 'success',
      response,
      context: diagnosticContext,
      meta: {
        confidenceThreshold:
          options.confidenceThreshold || settings.confidenceThreshold,
        containsTitle: result.containsTitle === true,
        shouldTranslate: result.shouldTranslate === true
      },
      resultType: 'text'
    })

    logDiagnostic(
      'info',
      'recognition.success',
      buildRecognitionDiagnostics({
        settings,
        requestSummary,
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
      rawText,
      requestSummary,
      responseSummary
    }
  } catch (error) {
    const providerErrorSummary = extractProviderErrorSummary(error)
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
    const diagnostics = buildRecognitionDiagnostics({
      settings,
      requestSummary,
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
