const crypto = require('crypto')

const RESPONSE_SUMMARY_SCHEMA = 'wikimoe.ai.usage.response-summary'
const RESPONSE_SUMMARY_VERSION = 1
const MAX_SUMMARY_ITEMS = 8
const MAX_SUMMARY_KEYS = 30

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value).trim()
}

function createSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function cloneSerializableValue(value) {
  if (value === null || typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function getLimitedKeys(value) {
  if (!isPlainObject(value)) {
    return []
  }

  return Object.keys(value).sort().slice(0, MAX_SUMMARY_KEYS)
}

function getSerializedPayloadMetrics(value) {
  if (typeof value === 'undefined') {
    return {
      payloadSizeBytes: 0,
      payloadSha256: ''
    }
  }

  const jsonText = JSON.stringify(value)
  return {
    payloadSizeBytes: Buffer.byteLength(jsonText, 'utf8'),
    payloadSha256: createSha256(jsonText)
  }
}

function buildValueShape(value) {
  if (value === null) {
    return { type: 'null' }
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      itemCount: value.length
    }
  }

  if (isPlainObject(value)) {
    return {
      type: 'object',
      fieldCount: Object.keys(value).length,
      keys: getLimitedKeys(value)
    }
  }

  if (typeof value === 'string') {
    return {
      type: 'string',
      length: value.length,
      sizeBytes: Buffer.byteLength(value, 'utf8'),
      sha256: createSha256(value)
    }
  }

  return {
    type: typeof value,
    value
  }
}

function buildJsonTextShape(value) {
  const text = normalizeText(value)
  if (!text) {
    return null
  }

  const firstChar = text[0]
  if (firstChar !== '{' && firstChar !== '[') {
    return null
  }

  try {
    return buildValueShape(JSON.parse(text))
  } catch (error) {
    return null
  }
}

function buildTextSummary(value) {
  if (typeof value !== 'string') {
    return null
  }

  const summary = {
    length: value.length,
    sizeBytes: Buffer.byteLength(value, 'utf8')
  }
  if (value.length > 0) {
    summary.sha256 = createSha256(value)
  }

  const jsonShape = buildJsonTextShape(value)
  if (jsonShape) {
    summary.jsonShape = jsonShape
  }

  return summary
}

function appendTextField(target, key, value) {
  const text = normalizeText(value)
  if (text) {
    target[key] = text
  }
}

function appendNumberField(target, key, value) {
  const numberValue = Number(value)
  if (Number.isFinite(numberValue)) {
    target[key] = numberValue
  }
}

function getFirstPlainObject(...values) {
  for (const value of values) {
    if (isPlainObject(value)) {
      return value
    }
  }
  return null
}

function buildProviderErrorSummary(response) {
  const error = getFirstPlainObject(
    response?.error,
    response?.response?.data?.error,
    response?.body?.error
  )
  if (!error) {
    return null
  }

  const summary = {}
  appendTextField(summary, 'message', error.message)
  appendTextField(summary, 'code', error.code)
  appendTextField(summary, 'type', error.type)
  appendTextField(summary, 'param', error.param)
  appendNumberField(summary, 'status', error.status)
  appendNumberField(summary, 'statusCode', response?.statusCode)
  appendNumberField(summary, 'httpStatus', response?.status)

  if (typeof response?.responseText === 'string') {
    summary.responseText = buildTextSummary(response.responseText)
  }
  if (Array.isArray(error.details)) {
    summary.detailCount = error.details.length
    summary.detailsShape = buildValueShape(error.details)
  }

  if (Object.keys(summary).length === 0) {
    return null
  }
  return summary
}

function buildOpenAiContentPartSummary(part) {
  if (typeof part === 'string') {
    return {
      type: 'text',
      text: buildTextSummary(part)
    }
  }

  if (!isPlainObject(part)) {
    return buildValueShape(part)
  }

  const summary = {
    type: normalizeText(part.type) || 'object',
    keys: getLimitedKeys(part)
  }
  if (typeof part.text === 'string') {
    summary.text = buildTextSummary(part.text)
  }
  if (typeof part.input_text === 'string') {
    summary.inputText = buildTextSummary(part.input_text)
  }
  if (typeof part.output_text === 'string') {
    summary.outputText = buildTextSummary(part.output_text)
  }
  if (isPlainObject(part.image_url)) {
    summary.imageUrl = {
      detail: normalizeText(part.image_url.detail),
      url: buildTextSummary(part.image_url.url || '')
    }
  }
  if (isPlainObject(part.inlineData)) {
    summary.inlineData = buildGeminiInlineDataSummary(part.inlineData)
  }

  return summary
}

function buildOpenAiContentSummary(content) {
  if (typeof content === 'string') {
    return {
      type: 'text',
      text: buildTextSummary(content)
    }
  }

  if (Array.isArray(content)) {
    return {
      type: 'array',
      itemCount: content.length,
      items: content
        .slice(0, MAX_SUMMARY_ITEMS)
        .map(buildOpenAiContentPartSummary)
    }
  }

  if (typeof content === 'undefined' || content === null) {
    return null
  }

  return buildValueShape(content)
}

function buildOpenAiToolCallSummary(toolCall) {
  if (!isPlainObject(toolCall)) {
    return buildValueShape(toolCall)
  }

  const summary = {}
  appendTextField(summary, 'id', toolCall.id)
  appendTextField(summary, 'type', toolCall.type)

  if (isPlainObject(toolCall.function)) {
    summary.function = {}
    appendTextField(summary.function, 'name', toolCall.function.name)
    if (typeof toolCall.function.arguments === 'string') {
      summary.function.arguments = buildTextSummary(toolCall.function.arguments)
    }
  }

  return summary
}

function buildOpenAiMessageSummary(message) {
  if (!isPlainObject(message)) {
    return null
  }

  const summary = {}
  appendTextField(summary, 'role', message.role)

  const contentSummary = buildOpenAiContentSummary(message.content)
  if (contentSummary) {
    summary.content = contentSummary
  }
  if (typeof message.reasoning_content === 'string') {
    summary.reasoningContent = buildTextSummary(message.reasoning_content)
  }
  if (typeof message.refusal === 'string') {
    summary.refusal = buildTextSummary(message.refusal)
  }
  if (Array.isArray(message.tool_calls)) {
    summary.toolCallCount = message.tool_calls.length
    summary.toolCalls = message.tool_calls
      .slice(0, MAX_SUMMARY_ITEMS)
      .map(buildOpenAiToolCallSummary)
  }

  const knownKeys = new Set([
    'role',
    'content',
    'reasoning_content',
    'refusal',
    'tool_calls'
  ])
  const extraKeys = Object.keys(message)
    .filter(key => !knownKeys.has(key))
    .sort()
    .slice(0, MAX_SUMMARY_KEYS)
  if (extraKeys.length > 0) {
    summary.extraKeys = extraKeys
  }

  return summary
}

function buildOpenAiChoiceSummary(choice) {
  if (!isPlainObject(choice)) {
    return buildValueShape(choice)
  }

  const summary = {}
  appendNumberField(summary, 'index', choice.index)
  appendTextField(summary, 'finishReason', choice.finish_reason)
  appendTextField(summary, 'finishReason', choice.finishReason)

  const messageSummary = buildOpenAiMessageSummary(choice.message)
  if (messageSummary) {
    summary.message = messageSummary
  }

  const deltaSummary = buildOpenAiMessageSummary(choice.delta)
  if (deltaSummary) {
    summary.delta = deltaSummary
  }
  if (isPlainObject(choice.logprobs)) {
    summary.logprobsShape = buildValueShape(choice.logprobs)
  }

  return summary
}

function buildOpenAiResponseSummary(response) {
  const summary = { kind: 'chat-completion' }
  if (!isPlainObject(response)) {
    summary.shape = buildValueShape(response)
    return summary
  }

  appendTextField(summary, 'object', response.object)
  appendTextField(summary, 'id', response.id)
  appendTextField(summary, 'model', response.model)
  appendNumberField(summary, 'created', response.created)

  if (isPlainObject(response.usage)) {
    summary.usage = cloneSerializableValue(response.usage)
  }
  if (Array.isArray(response.choices)) {
    summary.choiceCount = response.choices.length
    summary.choices = response.choices
      .slice(0, MAX_SUMMARY_ITEMS)
      .map(buildOpenAiChoiceSummary)
  }
  if (Array.isArray(response.chunks)) {
    summary.kind = 'chat-completion-batch'
    summary.chunkCount = response.chunks.length
    summary.chunks = response.chunks
      .slice(0, MAX_SUMMARY_ITEMS)
      .map((chunk, index) => {
        let chunkData = chunk
        if (isPlainObject(chunk) && isPlainObject(chunk.data)) {
          chunkData = chunk.data
        }
        const chunkSummary = buildOpenAiResponseSummary(chunkData)
        chunkSummary.index = index
        return chunkSummary
      })
  }

  const errorSummary = buildProviderErrorSummary(response)
  if (errorSummary) {
    summary.error = errorSummary
  }
  return summary
}

function buildGeminiInlineDataSummary(inlineData) {
  if (!isPlainObject(inlineData)) {
    return null
  }

  const summary = {}
  appendTextField(summary, 'mimeType', inlineData.mimeType)
  if (typeof inlineData.data === 'string') {
    summary.data = buildTextSummary(inlineData.data)
  }
  return summary
}

function buildGeminiPartSummary(part) {
  if (!isPlainObject(part)) {
    return buildValueShape(part)
  }

  if (typeof part.text === 'string') {
    return {
      type: 'text',
      text: buildTextSummary(part.text)
    }
  }

  if (isPlainObject(part.inlineData)) {
    return {
      type: 'inlineData',
      inlineData: buildGeminiInlineDataSummary(part.inlineData)
    }
  }

  const summary = {
    type: 'object',
    keys: getLimitedKeys(part)
  }
  if (isPlainObject(part.functionCall)) {
    summary.functionCall = {
      name: normalizeText(part.functionCall.name),
      argsShape: buildValueShape(part.functionCall.args || {})
    }
  }
  if (isPlainObject(part.functionResponse)) {
    summary.functionResponse = {
      name: normalizeText(part.functionResponse.name),
      responseShape: buildValueShape(part.functionResponse.response || {})
    }
  }
  return summary
}

function buildGeminiGroundingSummary(groundingMetadata) {
  if (!isPlainObject(groundingMetadata)) {
    return null
  }

  const summary = {}
  if (Array.isArray(groundingMetadata.groundingChunks)) {
    summary.groundingChunkCount = groundingMetadata.groundingChunks.length
  }
  if (Array.isArray(groundingMetadata.groundingSupports)) {
    summary.groundingSupportCount = groundingMetadata.groundingSupports.length
  }
  if (Array.isArray(groundingMetadata.webSearchQueries)) {
    summary.webSearchQueryCount = groundingMetadata.webSearchQueries.length
  }
  if (isPlainObject(groundingMetadata.searchEntryPoint)) {
    summary.searchEntryPointShape = buildValueShape(
      groundingMetadata.searchEntryPoint
    )
  }
  if (Object.keys(summary).length === 0) {
    return null
  }
  return summary
}

function buildGeminiSafetyRatingSummary(rating) {
  if (!isPlainObject(rating)) {
    return buildValueShape(rating)
  }

  const summary = {}
  appendTextField(summary, 'category', rating.category)
  appendTextField(summary, 'probability', rating.probability)
  appendNumberField(summary, 'probabilityScore', rating.probabilityScore)
  if (typeof rating.blocked === 'boolean') {
    summary.blocked = rating.blocked
  }
  return summary
}

function buildGeminiCandidateSummary(candidate, index) {
  if (!isPlainObject(candidate)) {
    return buildValueShape(candidate)
  }

  const summary = { index }
  appendTextField(summary, 'finishReason', candidate.finishReason)
  if (typeof candidate.finishMessage === 'string') {
    summary.finishMessage = buildTextSummary(candidate.finishMessage)
  }
  appendNumberField(summary, 'avgLogprobs', candidate.avgLogprobs)

  if (isPlainObject(candidate.content)) {
    const content = candidate.content
    summary.content = {}
    appendTextField(summary.content, 'role', content.role)
    if (Array.isArray(content.parts)) {
      summary.content.partCount = content.parts.length
      summary.content.parts = content.parts
        .slice(0, MAX_SUMMARY_ITEMS)
        .map(buildGeminiPartSummary)
    }
  }
  if (Array.isArray(candidate.safetyRatings)) {
    summary.safetyRatingCount = candidate.safetyRatings.length
    summary.safetyRatings = candidate.safetyRatings
      .slice(0, MAX_SUMMARY_ITEMS)
      .map(buildGeminiSafetyRatingSummary)
  }

  const groundingSummary = buildGeminiGroundingSummary(
    candidate.groundingMetadata
  )
  if (groundingSummary) {
    summary.groundingMetadata = groundingSummary
  }
  if (isPlainObject(candidate.citationMetadata)) {
    summary.citationMetadataShape = buildValueShape(candidate.citationMetadata)
  }
  return summary
}

function buildGeminiResponseSummary(response) {
  const summary = { kind: 'gemini-generate-content' }
  if (!isPlainObject(response)) {
    summary.shape = buildValueShape(response)
    return summary
  }

  appendTextField(summary, 'responseId', response.responseId)
  appendTextField(summary, 'modelVersion', response.modelVersion)
  if (isPlainObject(response.usageMetadata)) {
    summary.usageMetadata = cloneSerializableValue(response.usageMetadata)
  }
  if (isPlainObject(response.promptFeedback)) {
    summary.promptFeedback = cloneSerializableValue(response.promptFeedback)
  }
  if (Array.isArray(response.candidates)) {
    summary.candidateCount = response.candidates.length
    summary.candidates = response.candidates
      .slice(0, MAX_SUMMARY_ITEMS)
      .map(buildGeminiCandidateSummary)
  }

  const errorSummary = buildProviderErrorSummary(response)
  if (errorSummary) {
    summary.error = errorSummary
  }
  return summary
}

function buildGenericResponseSummary(response) {
  const summary = {
    kind: 'generic',
    shape: buildValueShape(response)
  }
  if (!isPlainObject(response)) {
    return summary
  }

  summary.fieldCount = Object.keys(response).length
  summary.keys = getLimitedKeys(response)

  if (isPlainObject(response.usage)) {
    summary.usage = cloneSerializableValue(response.usage)
  }
  if (isPlainObject(response.usageMetadata)) {
    summary.usageMetadata = cloneSerializableValue(response.usageMetadata)
  }

  const errorSummary = buildProviderErrorSummary(response)
  if (errorSummary) {
    summary.error = errorSummary
  }
  return summary
}

function shouldUseGeminiSummary(provider, response) {
  if (provider === 'gemini') {
    return true
  }
  return Boolean(
    isPlainObject(response) &&
    (Array.isArray(response.candidates) ||
      isPlainObject(response.usageMetadata) ||
      normalizeText(response.modelVersion))
  )
}

function shouldUseOpenAiSummary(provider, response) {
  if (provider === 'deepseek' || provider === 'openai') {
    return true
  }
  return Boolean(
    isPlainObject(response) &&
    (Array.isArray(response.choices) || Array.isArray(response.chunks))
  )
}

function buildAiUsageResponseSummary(options = {}) {
  const rawResponse = options.rawResponse
  const summary = {
    schema: RESPONSE_SUMMARY_SCHEMA,
    version: RESPONSE_SUMMARY_VERSION
  }

  if (typeof rawResponse === 'undefined' || rawResponse === null) {
    summary.kind = 'empty'
    return summary
  }

  Object.assign(summary, getSerializedPayloadMetrics(rawResponse))

  const provider = normalizeText(options.provider).toLowerCase()
  let responseSummary = null
  if (shouldUseGeminiSummary(provider, rawResponse)) {
    responseSummary = buildGeminiResponseSummary(rawResponse)
  } else if (shouldUseOpenAiSummary(provider, rawResponse)) {
    responseSummary = buildOpenAiResponseSummary(rawResponse)
  } else {
    responseSummary = buildGenericResponseSummary(rawResponse)
  }

  return {
    ...summary,
    ...responseSummary
  }
}

module.exports = {
  buildAiUsageResponseSummary
}
