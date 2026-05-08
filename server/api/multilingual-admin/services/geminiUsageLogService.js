const aiUsageService = require('./aiUsageService')

function cloneSerializableValue(value) {
  if (value === null || typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value).trim()
}

function getObjectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value
}

function getGeminiUsageMetadata(response) {
  const usageMetadata = getObjectValue(response?.usageMetadata)
  if (!usageMetadata) {
    return {}
  }

  return cloneSerializableValue(usageMetadata) || {}
}

function buildGeminiRawResponse(response, error) {
  if (response && typeof response === 'object') {
    return cloneSerializableValue(response) || {}
  }

  const errorResponse = getObjectValue(error?.response?.data)
  if (errorResponse) {
    return cloneSerializableValue(errorResponse) || {}
  }

  const errorPayload = {
    error: {
      message: normalizeText(error?.message),
      code: normalizeText(error?.code),
      type: normalizeText(error?.type)
    }
  }

  const status = Number(error?.status || error?.response?.status || 0)
  if (status > 0) {
    errorPayload.error.status = status
  }

  const responseText = normalizeText(error?.response?.text)
  if (responseText) {
    errorPayload.responseText = responseText
  }

  return errorPayload
}

function buildGeminiRequestId(response, error) {
  const responseId = normalizeText(response?.responseId)
  if (responseId) {
    return responseId
  }

  const errorResponseId = normalizeText(error?.response?.data?.responseId)
  if (errorResponseId) {
    return errorResponseId
  }

  return normalizeText(error?.request_id)
}

async function recordGeminiUsageLog(options = {}) {
  const response = getObjectValue(options.response)
  const error = options.error
  const context = getObjectValue(options.context) || {}
  const meta = cloneSerializableValue(options.meta || {}) || {}

  if (Object.keys(context).length > 0) {
    meta.context = context
  }

  const statusCode = Number(
    options.statusCode || error?.response?.status || error?.status || 0
  )
  if (statusCode > 0) {
    meta.httpStatusCode = statusCode
  }

  if (response?.modelVersion) {
    meta.modelVersion = response.modelVersion
  }
  if (response?.modelStatus && typeof response.modelStatus === 'object') {
    meta.modelStatus = cloneSerializableValue(response.modelStatus)
  }
  if (response?.promptFeedback && typeof response.promptFeedback === 'object') {
    meta.promptFeedback = cloneSerializableValue(response.promptFeedback)
  }
  if (normalizeText(options.failureCode)) {
    meta.failureCode = normalizeText(options.failureCode)
  }
  if (normalizeText(options.failureReason)) {
    meta.failureReason = normalizeText(options.failureReason)
  }
  if (normalizeText(options.resultType)) {
    meta.resultType = normalizeText(options.resultType)
  }

  await aiUsageService.recordAiUsageLog({
    provider: 'gemini',
    model:
      normalizeText(options.model) ||
      normalizeText(options.settings?.model) ||
      normalizeText(response?.modelVersion),
    operation: normalizeText(options.operation),
    status: normalizeText(options.status) || 'success',
    requestId: buildGeminiRequestId(response, error),
    postId: options.postId || context.targetPostId || context.sourcePostId,
    sourceLanguageCode:
      normalizeText(options.sourceLanguageCode) ||
      normalizeText(context.sourceLanguageCode),
    targetLanguageCode:
      normalizeText(options.targetLanguageCode) ||
      normalizeText(context.targetLanguageCode),
    usage: getGeminiUsageMetadata(response || error?.response?.data),
    rawResponse: buildGeminiRawResponse(response, error),
    meta
  })
}

module.exports = {
  getGeminiUsageMetadata,
  recordGeminiUsageLog
}
