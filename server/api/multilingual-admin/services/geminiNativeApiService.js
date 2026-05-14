const { truncateText } = require('./coverImageAiDiagnosticService')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const GEMINI_NATIVE_FETCH_TIMEOUT_MS = 180000

function normalizeTimeout(timeoutSeconds) {
  const seconds = Number(timeoutSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return GEMINI_NATIVE_FETCH_TIMEOUT_MS
  }
  return Math.round(seconds * 1000)
}

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function isCloudflareAiGatewayEnabled(settings) {
  return settings?.useCloudflareAiGateway === true
}

function normalizeGeminiBaseUrl(baseUrl, settings = {}) {
  const configuredBaseUrl = normalizeText(baseUrl)
  if (isCloudflareAiGatewayEnabled(settings)) {
    if (!configuredBaseUrl) {
      throw new Error('Cloudflare AI Gateway 的 Gemini Base URL 不能为空')
    }
    const normalizedGatewayBaseUrl = configuredBaseUrl
      .replace(/\/+$/, '')
      .replace(/\/v1beta$/i, '')
      .replace(/\/v1$/i, '')
    if (/\/compat(\/|$)/i.test(normalizedGatewayBaseUrl)) {
      throw new Error(
        'Gemini 使用 Cloudflare AI Gateway 时，Base URL 必须填写 /google-ai-studio 地址，不能填写 /compat。'
      )
    }
    if (/\/models\//i.test(normalizedGatewayBaseUrl)) {
      throw new Error(
        'Gemini 使用 Cloudflare AI Gateway 时，Base URL 只填写到 /google-ai-studio，不要包含 /v1beta/models。'
      )
    }
    if (!/\/google-ai-studio(\/|$)/i.test(normalizedGatewayBaseUrl)) {
      throw new Error(
        'Gemini 使用 Cloudflare AI Gateway 时，Base URL 必须填写 /google-ai-studio 地址。'
      )
    }
    return normalizedGatewayBaseUrl
  }

  if (!configuredBaseUrl) {
    return 'https://generativelanguage.googleapis.com/v1beta'
  }
  return configuredBaseUrl
    .replace(/\/+$/, '')
    .replace(/\/openai\/v\d+$/i, '')
    .replace(/\/openai$/i, '')
}

function buildGeminiNativeGenerateContentUrl(settings) {
  const normalizedBaseUrl = normalizeGeminiBaseUrl(settings?.baseUrl, settings)
  const model = encodeURIComponent(normalizeText(settings?.model))
  const apiKey = encodeURIComponent(normalizeText(settings?.apiKey))
  if (!model || !apiKey) {
    throw new Error('Gemini 原生请求缺少 model 或 apiKey')
  }
  if (isCloudflareAiGatewayEnabled(settings)) {
    return `${normalizedBaseUrl}/v1beta/models/${model}:generateContent`
  }
  return `${normalizedBaseUrl}/models/${model}:generateContent?key=${apiKey}`
}

function buildGeminiNativeRequestHeaders(settings) {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (isCloudflareAiGatewayEnabled(settings)) {
    headers['cf-aig-authorization'] = `Bearer ${normalizeText(
      settings?.apiKey
    )}`
  }
  return headers
}

function createGeminiCancelledError(reason, retryable = true) {
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    String(reason || '').trim() || 'AI 翻译已停止',
    'gemini',
    499,
    { retryable }
  )
}

function createGeminiTimeoutError() {
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    'Gemini 请求超时',
    'gemini',
    504
  )
}

function createRequestAbortController(settings, options = {}) {
  const controller = new AbortController()
  const timeoutMs = normalizeTimeout(settings?.timeoutSeconds)
  const timeoutTimer = setTimeout(() => {
    controller.abort(createGeminiTimeoutError())
  }, timeoutMs)
  let unbindCancellation = () => {}
  const cancellation = options.cancellation
  if (cancellation && typeof cancellation.onCancel === 'function') {
    unbindCancellation = cancellation.onCancel(reason => {
      controller.abort(
        createGeminiCancelledError(reason, cancellation.retryable !== false)
      )
    })
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutTimer)
      unbindCancellation()
    }
  }
}

function summarizeGeminiNativeRequestBody(requestBody, requestUrl = '') {
  return {
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

async function sendGeminiNativeGenerateContentRequest(
  settings,
  requestBody,
  requestUrl = '',
  options = {}
) {
  const targetUrl = requestUrl || buildGeminiNativeGenerateContentUrl(settings)
  const payloadText = JSON.stringify(requestBody)
  const abortController = createRequestAbortController(settings, options)
  let response = null
  let responseText = ''
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: buildGeminiNativeRequestHeaders(settings),
      body: payloadText,
      signal: abortController.signal
    })
    responseText = await response.text()
  } catch (error) {
    if (abortController.signal.aborted && abortController.signal.reason) {
      throw abortController.signal.reason
    }
    throw error
  } finally {
    abortController.cleanup()
  }
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
    throw new Error('Gemini 原生请求返回了非 JSON 响应')
  }
  return responseJson
}

function extractImagePayloadFromUrlValue(value, sourcePath = '') {
  const text = normalizeText(value)
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

function buildInlineDataPartFromDataUrl(dataUrl, sourceName = 'image') {
  const imagePayload = extractImagePayloadFromUrlValue(dataUrl, sourceName)
  if (!imagePayload || !imagePayload.base64) {
    throw new Error('Gemini 原生请求要求传入 data URL 图片')
  }
  return {
    inlineData: {
      mimeType: imagePayload.mimeType || 'image/png',
      data: imagePayload.base64
    }
  }
}

function buildTextPart(text) {
  const normalizedPrompt = normalizeText(text)
  if (!normalizedPrompt) {
    throw new Error('Gemini 原生请求文本不能为空')
  }
  return {
    text: normalizedPrompt
  }
}

function applyGeminiThinkingConfig(generationConfig, settings) {
  const outputGenerationConfig = { ...(generationConfig || {}) }
  const thinkingConfig = settings?.requestOptions?.thinkingConfig
  if (
    !thinkingConfig ||
    typeof thinkingConfig !== 'object' ||
    Array.isArray(thinkingConfig)
  ) {
    return outputGenerationConfig
  }

  const thinkingLevel = normalizeText(thinkingConfig.thinkingLevel)
  if (!thinkingLevel) {
    return outputGenerationConfig
  }

  outputGenerationConfig.thinkingConfig = {
    thinkingLevel
  }
  return outputGenerationConfig
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

function extractTextFromGeminiNativeResponse(response) {
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
      if (typeof part?.text === 'string' && part.text.trim()) {
        return {
          text: part.text.trim(),
          sourcePath: `candidates[${candidateIndex}].content.parts[${partIndex}].text`
        }
      }
    }
  }
  return null
}

module.exports = {
  applyGeminiThinkingConfig,
  buildGeminiNativeGenerateContentUrl,
  buildInlineDataPartFromDataUrl,
  buildTextPart,
  extractBase64FromGeminiNativeResponse,
  extractImagePayloadFromUrlValue,
  extractTextFromGeminiNativeResponse,
  normalizeGeminiBaseUrl,
  normalizeText,
  normalizeTimeout,
  sendGeminiNativeGenerateContentRequest,
  summarizeGeminiNativeRequestBody,
  summarizeGeminiNativeResponse
}
