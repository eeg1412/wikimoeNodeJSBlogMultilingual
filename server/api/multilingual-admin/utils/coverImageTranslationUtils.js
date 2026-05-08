const crypto = require('crypto')

const COVER_IMAGE_ARTIFACT_TYPE = 'cover-image-translation'
const COVER_IMAGE_ENTRY_TYPE = 'coverImageTranslation'
const COVER_IMAGE_RECOGNITION_SCHEMA =
  'wikimoe.ai.cover-image-recognition.result'
const COVER_IMAGE_RECOGNITION_VERSION = 1
const SUPPORTED_COVER_POST_TYPES = new Set([1, 3])

const GEMINI_IMAGE_RATIO_CANDIDATES = [
  { provider: 'gemini', value: '1:1', ratio: 1, pixels: 1024 * 1024 },
  {
    provider: 'gemini',
    value: '16:9',
    ratio: 16 / 9,
    pixels: 1376 * 768
  },
  {
    provider: 'gemini',
    value: '9:16',
    ratio: 9 / 16,
    pixels: 768 * 1376
  },
  {
    provider: 'gemini',
    value: '4:3',
    ratio: 4 / 3,
    pixels: 1200 * 896
  },
  {
    provider: 'gemini',
    value: '3:4',
    ratio: 3 / 4,
    pixels: 896 * 1200
  },
  {
    provider: 'gemini',
    value: '3:2',
    ratio: 3 / 2,
    pixels: 1264 * 848
  },
  {
    provider: 'gemini',
    value: '2:3',
    ratio: 2 / 3,
    pixels: 848 * 1264
  },
  {
    provider: 'gemini',
    value: '21:9',
    ratio: 21 / 9,
    pixels: 1584 * 672
  }
]

function normalizeTitleForImageReuse(title) {
  return String(title || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function buildStableHash(parts) {
  const text = (Array.isArray(parts) ? parts : [parts])
    .map(part => String(part || ''))
    .join('\n')
  return crypto.createHash('sha256').update(text).digest('hex')
}

function buildBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function buildTargetTitleHash(targetTitle) {
  return buildStableHash([normalizeTitleForImageReuse(targetTitle)])
}

function buildCoverRecognitionKey(sourceCoverKey, sourceTitle) {
  return buildStableHash([
    'cover-recognition-v1',
    sourceCoverKey,
    normalizeTitleForImageReuse(sourceTitle)
  ])
}

function buildCoverGenerationKey(sourceCoverKey, targetTitle) {
  return buildStableHash([
    'cover-generation-v1',
    sourceCoverKey,
    buildTargetTitleHash(targetTitle)
  ])
}

function isCoverSupportedPostType(postType) {
  return SUPPORTED_COVER_POST_TYPES.has(Number(postType || 0))
}

function normalizeIdValue(value) {
  if (value && typeof value.toHexString === 'function') {
    return value.toHexString()
  }
  return String(value || '').trim()
}

function resolveFirstCoverImage(post) {
  const coverImages = Array.isArray(post?.coverImages) ? post.coverImages : []
  const attachment = coverImages.find(Boolean)
  if (!attachment) {
    return null
  }
  if (typeof attachment === 'object') {
    return attachment
  }
  return { _id: attachment }
}

function getAttachmentId(attachment) {
  return normalizeIdValue(attachment?._id || attachment?.id || attachment)
}

function getAttachmentPreviewUrl(attachment) {
  return String(
    attachment?.localThumbnailPath ||
      attachment?.thumfor ||
      attachment?.localFilepath ||
      attachment?.filepath ||
      attachment?.remoteFilepath ||
      ''
  ).trim()
}

function getPreferredSourceImageDimensions(attachment) {
  let width = Number(attachment?.thumWidth || 0)
  let height = Number(attachment?.thumHeight || 0)
  if (!width || !height) {
    width = Number(attachment?.width || 0)
    height = Number(attachment?.height || 0)
  }
  if (!width || !height) {
    return null
  }
  return {
    width,
    height,
    ratio: width / height
  }
}

function getRatioCandidates(provider) {
  if (provider === 'gemini') {
    return GEMINI_IMAGE_RATIO_CANDIDATES
  }
  return GEMINI_IMAGE_RATIO_CANDIDATES
}

function calculateCropLoss(sourceRatio, candidateRatio) {
  if (!sourceRatio || !candidateRatio) {
    return Number.POSITIVE_INFINITY
  }
  if (candidateRatio >= sourceRatio) {
    return 1 - sourceRatio / candidateRatio
  }
  return 1 - candidateRatio / sourceRatio
}

function selectNearestImageRatio(provider, sourceRatio) {
  const ratio = Number(sourceRatio)
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return null
  }

  const candidates = getRatioCandidates(provider)
  let selected = null
  candidates.forEach(candidate => {
    const distance = Math.abs(Math.log(ratio / candidate.ratio))
    const cropLoss = calculateCropLoss(ratio, candidate.ratio)
    const normalizedCandidate = {
      ...candidate,
      distance,
      cropLoss
    }
    if (!selected) {
      selected = normalizedCandidate
      return
    }
    if (distance < selected.distance) {
      selected = normalizedCandidate
      return
    }
    if (distance === selected.distance && cropLoss < selected.cropLoss) {
      selected = normalizedCandidate
      return
    }
    if (
      distance === selected.distance &&
      cropLoss === selected.cropLoss &&
      candidate.pixels > selected.pixels
    ) {
      selected = normalizedCandidate
    }
  })
  return selected
}

function sanitizeSafePathPart(value, fieldName = 'value') {
  const text = String(value || '').trim()
  if (!/^[a-zA-Z0-9_-]+$/.test(text)) {
    throw new Error(`${fieldName} contains unsafe characters`)
  }
  return text
}

function normalizeTitleRegion(value) {
  const region = value && typeof value === 'object' ? value : {}
  const result = {
    x: Number(region.x || 0),
    y: Number(region.y || 0),
    width: Number(region.width || 0),
    height: Number(region.height || 0)
  }
  Object.keys(result).forEach(key => {
    if (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > 1) {
      throw new Error(`titleRegion.${key} 必须是 0 到 1 的数字`)
    }
  })
  return result
}

function assertBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} 必须是 boolean`)
  }
}

function assertString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} 必须是 string`)
  }
}

function assertConfidence(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('confidence 必须是 0 到 1 的数字')
  }
}

function parseStrictJson(text) {
  const trimmedText = String(text || '').trim()
  if (
    !trimmedText ||
    !trimmedText.startsWith('{') ||
    !trimmedText.endsWith('}')
  ) {
    throw new Error('图像识别返回内容不是合法 JSON')
  }
  return JSON.parse(trimmedText)
}

function parseImageRecognitionResult(rawResult, confidenceThreshold) {
  const result =
    typeof rawResult === 'string' ? parseStrictJson(rawResult) : rawResult
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('图像识别结果必须是对象')
  }
  if (result.schema !== COVER_IMAGE_RECOGNITION_SCHEMA) {
    throw new Error('图像识别 schema 不匹配')
  }
  if (Number(result.version) !== COVER_IMAGE_RECOGNITION_VERSION) {
    throw new Error('图像识别 version 不匹配')
  }

  assertBoolean(result.containsTitle, 'containsTitle')
  assertString(result.recognizedTitleText, 'recognizedTitleText')
  const confidence = Number(result.confidence)
  assertConfidence(confidence)
  assertString(result.reason, 'reason')
  assertBoolean(result.shouldTranslate, 'shouldTranslate')

  const threshold = Number(confidenceThreshold || 0.75)
  const normalizedResult = {
    schema: COVER_IMAGE_RECOGNITION_SCHEMA,
    version: COVER_IMAGE_RECOGNITION_VERSION,
    containsTitle: result.containsTitle,
    recognizedTitleText: result.recognizedTitleText,
    confidence,
    titleRegion: normalizeTitleRegion(result.titleRegion),
    reason: result.reason,
    shouldTranslate: result.shouldTranslate
  }

  if (
    !normalizedResult.containsTitle ||
    normalizedResult.confidence < threshold
  ) {
    normalizedResult.shouldTranslate = false
  }
  return normalizedResult
}

module.exports = {
  COVER_IMAGE_ARTIFACT_TYPE,
  COVER_IMAGE_ENTRY_TYPE,
  COVER_IMAGE_RECOGNITION_SCHEMA,
  COVER_IMAGE_RECOGNITION_VERSION,
  buildBufferHash,
  buildCoverGenerationKey,
  buildCoverRecognitionKey,
  buildStableHash,
  buildTargetTitleHash,
  getAttachmentId,
  getAttachmentPreviewUrl,
  getPreferredSourceImageDimensions,
  isCoverSupportedPostType,
  normalizeIdValue,
  normalizeTitleForImageReuse,
  parseImageRecognitionResult,
  resolveFirstCoverImage,
  sanitizeSafePathPart,
  selectNearestImageRatio
}
