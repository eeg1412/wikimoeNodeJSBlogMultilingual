const log4js = require('log4js')

const adminApiLog = log4js.getLogger('adminApi')
const MAX_TEXT_PREVIEW = 240
const MAX_LIST_ITEMS = 5

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function truncateText(value, maxLength = MAX_TEXT_PREVIEW) {
  const text = normalizeText(value)
  if (!text) {
    return ''
  }
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

function summarizeDataUrl(value) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }
  const dataUrlMatch = text.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrlMatch) {
    return {
      kind: 'data-url',
      mimeType: dataUrlMatch[1],
      dataLength: dataUrlMatch[2].length
    }
  }
  return {
    kind: 'url',
    urlPreview: truncateText(text, 180)
  }
}

function summarizePart(part) {
  if (!part || typeof part !== 'object') {
    return {
      type: '',
      keys: []
    }
  }
  const summary = {
    type: normalizeText(part.type || ''),
    keys: Object.keys(part).sort().slice(0, 10)
  }
  if (typeof part.text === 'string') {
    summary.textLength = part.text.length
    summary.textPreview = truncateText(part.text)
  }
  if (part.image_url && typeof part.image_url === 'object') {
    summary.imageUrl = summarizeDataUrl(part.image_url.url)
    if (part.image_url.detail) {
      summary.imageUrlDetail = normalizeText(part.image_url.detail)
    }
  }
  if (part.inline_data && typeof part.inline_data === 'object') {
    summary.inlineData = {
      mimeType: normalizeText(part.inline_data.mime_type),
      dataLength: normalizeText(part.inline_data.data).length
    }
  }
  if (part.b64_json) {
    summary.base64Length = normalizeText(part.b64_json).length
  }
  if (part.result) {
    summary.resultLength = normalizeText(part.result).length
  }
  return summary
}

function summarizeContent(content) {
  if (typeof content === 'string') {
    return {
      contentType: 'string',
      textLength: content.length,
      textPreview: truncateText(content)
    }
  }
  if (Array.isArray(content)) {
    return {
      contentType: 'array',
      partCount: content.length,
      parts: content.slice(0, MAX_LIST_ITEMS).map(summarizePart)
    }
  }
  if (!content || typeof content !== 'object') {
    return {
      contentType: typeof content
    }
  }
  return {
    contentType: 'object',
    keys: Object.keys(content).sort().slice(0, 10)
  }
}

function summarizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return []
  }
  return messages.slice(0, MAX_LIST_ITEMS).map(message => {
    return {
      role: normalizeText(message?.role),
      ...summarizeContent(message?.content)
    }
  })
}

function summarizeResponseFormat(responseFormat) {
  if (!responseFormat) {
    return null
  }
  if (typeof responseFormat === 'string') {
    return {
      type: 'string',
      value: normalizeText(responseFormat)
    }
  }
  if (typeof responseFormat !== 'object') {
    return {
      type: typeof responseFormat
    }
  }
  const summary = {
    type: normalizeText(responseFormat.type),
    keys: Object.keys(responseFormat).sort().slice(0, 10)
  }
  if (
    responseFormat.json_schema &&
    typeof responseFormat.json_schema === 'object'
  ) {
    summary.jsonSchema = {
      name: normalizeText(responseFormat.json_schema.name),
      strict: responseFormat.json_schema.strict === true,
      schemaKeys: Object.keys(responseFormat.json_schema.schema || {})
        .sort()
        .slice(0, 10),
      propertyKeys: Object.keys(
        responseFormat.json_schema.schema?.properties || {}
      )
        .sort()
        .slice(0, 20)
    }
  }
  return summary
}

function summarizeExtraBody(extraBody) {
  if (!extraBody || typeof extraBody !== 'object') {
    return null
  }
  const summary = {
    keys: Object.keys(extraBody).sort().slice(0, 10)
  }
  if (extraBody.google && typeof extraBody.google === 'object') {
    summary.google = {
      keys: Object.keys(extraBody.google).sort().slice(0, 10)
    }
    if (Array.isArray(extraBody.google.response_modalities)) {
      summary.google.responseModalities =
        extraBody.google.response_modalities.slice(0, 10)
    }
    if (
      extraBody.google.image_config &&
      typeof extraBody.google.image_config === 'object'
    ) {
      summary.google.imageConfig = {
        ...extraBody.google.image_config
      }
    }
  }
  return summary
}

function summarizeRequestBody(requestBody) {
  if (!requestBody || typeof requestBody !== 'object') {
    return null
  }
  const summary = {
    model: normalizeText(requestBody.model)
  }
  if (typeof requestBody.prompt === 'string') {
    summary.promptLength = requestBody.prompt.length
    summary.promptPreview = truncateText(requestBody.prompt)
  }
  if (Array.isArray(requestBody.messages)) {
    summary.messages = summarizeMessages(requestBody.messages)
  }
  if (requestBody.response_format) {
    summary.responseFormat = summarizeResponseFormat(
      requestBody.response_format
    )
  }
  if (requestBody.extra_body) {
    summary.extraBody = summarizeExtraBody(requestBody.extra_body)
  }
  if (typeof requestBody.n !== 'undefined') {
    summary.n = Number(requestBody.n)
  }
  ;[
    'size',
    'quality',
    'output_format',
    'output_compression',
    'background',
    'service_tier'
  ].forEach(key => {
    if (typeof requestBody[key] !== 'undefined' && requestBody[key] !== '') {
      summary[key] = requestBody[key]
    }
  })
  if (requestBody.image && typeof requestBody.image === 'object') {
    summary.image = {
      type: requestBody.image.constructor?.name || 'Object',
      path: normalizeText(requestBody.image.path)
    }
  }
  return summary
}

function summarizeUsage(usage) {
  if (!usage || typeof usage !== 'object') {
    return null
  }
  const summary = {}
  ;[
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'input_tokens',
    'output_tokens'
  ].forEach(key => {
    const value = Number(usage[key])
    if (Number.isFinite(value) && value >= 0) {
      summary[key] = value
    }
  })
  if (Object.keys(summary).length > 0) {
    return summary
  }
  return {
    keys: Object.keys(usage).sort().slice(0, 20)
  }
}

function summarizeChoice(choice) {
  const message = choice?.message || {}
  return {
    finishReason: normalizeText(choice?.finish_reason),
    index: Number.isInteger(choice?.index) ? choice.index : undefined,
    messageKeys: Object.keys(message).sort().slice(0, 10),
    parsedPresent: typeof message.parsed !== 'undefined',
    content: summarizeContent(message.content),
    images: Array.isArray(message.images)
      ? message.images.slice(0, MAX_LIST_ITEMS).map(summarizePart)
      : []
  }
}

function summarizeOutputEntry(output) {
  return {
    type: normalizeText(output?.type),
    keys: Object.keys(output || {})
      .sort()
      .slice(0, 10),
    resultLength: normalizeText(output?.result).length,
    content: Array.isArray(output?.content)
      ? output.content.slice(0, MAX_LIST_ITEMS).map(summarizePart)
      : []
  }
}

function summarizeResponse(response) {
  if (!response || typeof response !== 'object') {
    return null
  }
  const summary = {
    id: normalizeText(response.id),
    model: normalizeText(response.model),
    usage: summarizeUsage(response.usage)
  }
  if (Array.isArray(response.data)) {
    summary.dataCount = response.data.length
    summary.data = response.data.slice(0, MAX_LIST_ITEMS).map(item => {
      return {
        keys: Object.keys(item || {})
          .sort()
          .slice(0, 10),
        b64Length: normalizeText(item?.b64_json).length,
        urlPreview: truncateText(item?.url, 180)
      }
    })
  }
  if (Array.isArray(response.output)) {
    summary.outputCount = response.output.length
    summary.output = response.output
      .slice(0, MAX_LIST_ITEMS)
      .map(summarizeOutputEntry)
  }
  if (Array.isArray(response.choices)) {
    summary.choiceCount = response.choices.length
    summary.choices = response.choices
      .slice(0, MAX_LIST_ITEMS)
      .map(summarizeChoice)
  }
  return summary
}

function summarizeError(error) {
  const status = Number(error?.status || error?.response?.status || 0)
  const nestedError =
    error?.error || error?.response?.data?.error || error?.body?.error || {}
  const headers = error?.headers || error?.response?.headers || {}
  const requestId =
    normalizeText(error?.request_id) ||
    normalizeText(headers?.['x-request-id']) ||
    normalizeText(headers?.['request-id'])
  return {
    name: normalizeText(error?.name),
    message: truncateText(error?.message, 500),
    status: status > 0 ? status : null,
    code: normalizeText(error?.code || nestedError?.code),
    type: normalizeText(error?.type || nestedError?.type),
    param: normalizeText(nestedError?.param),
    requestId
  }
}

function summarizeRuntimeSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return null
  }
  return {
    provider: normalizeText(settings.provider),
    model: normalizeText(settings.model),
    baseUrl: truncateText(settings.baseUrl, 180),
    timeoutSeconds: Number(settings.timeoutSeconds) || 0,
    requestOptions:
      settings.requestOptions && typeof settings.requestOptions === 'object'
        ? { ...settings.requestOptions }
        : {}
  }
}

function createDiagnosticError(message, diagnostics) {
  const error = new Error(message)
  error.diagnostics = diagnostics || null
  return error
}

function attachDiagnostics(target, diagnostics) {
  if (target && typeof target === 'object') {
    target.diagnostics = diagnostics || null
  }
  return target
}

function logDiagnostic(level, event, diagnostics) {
  const payload = {
    scope: 'cover-image-ai',
    event,
    diagnostics: diagnostics || null
  }
  const message = JSON.stringify(payload, null, 2)
  if (level === 'info') {
    adminApiLog.info(message)
    return
  }
  if (level === 'warn') {
    adminApiLog.warn(message)
    return
  }
  adminApiLog.error(message)
}

module.exports = {
  attachDiagnostics,
  createDiagnosticError,
  logDiagnostic,
  summarizeError,
  summarizeRequestBody,
  summarizeResponse,
  summarizeRuntimeSettings,
  truncateText
}
