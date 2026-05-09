const AI_JSON_LOG_SCHEMA = 'wikimoe.ai.translation.json_log'
const AI_JSON_LOG_VERSION = 1
const MAX_SANITIZE_DEPTH = 12

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value)
}

function isObjectIdLike(value) {
  return value && typeof value.toHexString === 'function'
}

function getBase64DataUrlSummary(key, value) {
  if (typeof value !== 'string') {
    return null
  }
  const match = value.match(/^data:([^;]+);base64,(.*)$/i)
  if (!match) {
    return null
  }
  return {
    omitted: true,
    reason: 'base64-data-url',
    field: normalizeString(key) || 'value',
    contentType: match[1],
    encoding: 'base64',
    charLength: value.length,
    base64Length: match[2].length
  }
}

function looksLikeRawBase64(value) {
  if (typeof value !== 'string') {
    return false
  }
  const text = value.trim()
  if (text.length < 512) {
    return false
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(text)
}

function getOmittedValueSummary(key, value) {
  const normalizedKey = normalizeString(key).toLowerCase()
  if (normalizedKey === 'promise') {
    return {
      omitted: true,
      reason: 'promise',
      field: normalizeString(key) || 'value'
    }
  }
  if (Buffer.isBuffer(value)) {
    return {
      omitted: true,
      reason: 'binary-buffer',
      field: normalizeString(key) || 'value',
      byteLength: value.length
    }
  }
  if (ArrayBuffer.isView(value)) {
    return {
      omitted: true,
      reason: 'binary-array-buffer-view',
      field: normalizeString(key) || 'value',
      byteLength: value.byteLength
    }
  }
  const dataUrlSummary = getBase64DataUrlSummary(key, value)
  if (dataUrlSummary) {
    return dataUrlSummary
  }
  if (
    normalizedKey === 'dataurl' ||
    normalizedKey.includes('dataurl') ||
    normalizedKey.includes('base64') ||
    normalizedKey.includes('b64') ||
    looksLikeRawBase64(value)
  ) {
    return {
      omitted: true,
      reason: 'base64-data',
      field: normalizeString(key) || 'value',
      contentType: 'unknown',
      encoding: 'base64',
      charLength: typeof value === 'string' ? value.length : 0
    }
  }
  return null
}

function sanitizeAiJsonValue(value, depth = 0, key = '') {
  const omittedSummary = getOmittedValueSummary(key, value)
  if (omittedSummary) {
    return omittedSummary
  }
  if (value === null || typeof value === 'undefined') {
    return value
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (isObjectIdLike(value)) {
    return value.toHexString()
  }
  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[omitted:depth-limit]'
  }
  if (Array.isArray(value)) {
    return value.map(item => {
      return sanitizeAiJsonValue(item, depth + 1)
    })
  }
  if (typeof value === 'object') {
    const result = {}
    Object.entries(value).forEach(([childKey, childValue]) => {
      result[childKey] = sanitizeAiJsonValue(childValue, depth + 1, childKey)
    })
    return result
  }
  return normalizeString(value)
}

function createAiJsonLog({
  operation,
  stage,
  provider,
  model,
  requestId,
  sourceLanguageCode,
  targetLanguageCode,
  meta,
  json
}) {
  return {
    schema: AI_JSON_LOG_SCHEMA,
    version: AI_JSON_LOG_VERSION,
    operation: normalizeString(operation),
    stage: normalizeString(stage),
    provider: normalizeString(provider),
    model: normalizeString(model),
    requestId: normalizeString(requestId),
    sourceLanguageCode: normalizeString(sourceLanguageCode),
    targetLanguageCode: normalizeString(targetLanguageCode),
    createdAt: new Date(),
    meta: sanitizeAiJsonValue(meta || {}),
    json: sanitizeAiJsonValue(json || {})
  }
}

function mergeAiJsonLogs(...logLists) {
  const logs = []
  logLists.forEach(logList => {
    if (!Array.isArray(logList)) {
      return
    }
    logList.forEach(log => {
      if (!log || typeof log !== 'object' || Array.isArray(log)) {
        return
      }
      logs.push(sanitizeAiJsonValue(log))
    })
  })
  return logs
}

function buildCoverImageAiJsonLogs({
  snapshot,
  sourceLanguageCode,
  targetLanguageCode,
  meta = {}
}) {
  const logs = []
  const recognitionMap = snapshot?.coverImageRecognitionMap || {}
  const generationMap = snapshot?.coverImageGenerationMap || {}
  const artifactList = Array.isArray(snapshot?.coverImageArtifacts)
    ? snapshot.coverImageArtifacts
    : []

  const recognitionEntries = Object.entries(recognitionMap)
  if (recognitionEntries.length > 0) {
    logs.push(
      createAiJsonLog({
        operation: 'cover-image.recognition',
        stage: 'CoverImageRecognition',
        provider: 'gemini',
        model: '',
        requestId: meta.requestId || '',
        sourceLanguageCode,
        targetLanguageCode,
        meta: {
          ...meta,
          recognitionCount: recognitionEntries.length
        },
        json: recognitionEntries.map(([recognitionKey, value]) => {
          return {
            recognitionKey,
            ...value
          }
        })
      })
    )
  }

  const generationEntries = Object.entries(generationMap)
  if (generationEntries.length > 0) {
    logs.push(
      createAiJsonLog({
        operation: 'cover-image.generation',
        stage: 'CoverImageGeneration',
        provider: 'gemini',
        model: '',
        requestId: meta.requestId || '',
        sourceLanguageCode,
        targetLanguageCode,
        meta: {
          ...meta,
          generationCount: generationEntries.length
        },
        json: generationEntries.map(([generationKey, value]) => {
          return {
            generationKey,
            ...value
          }
        })
      })
    )
  }

  if (artifactList.length > 0) {
    logs.push(
      createAiJsonLog({
        operation: 'cover-image.artifact',
        stage: 'CoverImageArtifact',
        provider: 'gemini',
        model: '',
        requestId: meta.requestId || '',
        sourceLanguageCode,
        targetLanguageCode,
        meta: {
          ...meta,
          artifactCount: artifactList.length
        },
        json: artifactList
      })
    )
  }

  return logs
}

module.exports = {
  createAiJsonLog,
  mergeAiJsonLogs,
  buildCoverImageAiJsonLogs,
  sanitizeAiJsonValue
}
