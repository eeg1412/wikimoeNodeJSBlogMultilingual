const SUPPORTED_LANGUAGE_CODES = [
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'zh-SG',
  'ja-JP',
  'en-US'
]
const DEFAULT_LANGUAGE_CODE = 'zh-CN'

const LANGUAGE_CODE_MAP = SUPPORTED_LANGUAGE_CODES.reduce((map, code) => {
  map[code.toLowerCase()] = code
  return map
}, {})

function normalizeLanguageCode(input) {
  if (typeof input !== 'string') {
    return null
  }

  const key = input.trim().toLowerCase()
  if (!key) {
    return null
  }

  return LANGUAGE_CODE_MAP[key] || null
}

function isSupportedLanguageCode(input) {
  return Boolean(normalizeLanguageCode(input))
}

module.exports = {
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODE_MAP,
  normalizeLanguageCode,
  isSupportedLanguageCode
}
