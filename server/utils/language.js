const SUPPORTED_LANGUAGE_CODES = [
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'zh-SG',
  'ja-JP',
  'en-US'
]
const DEFAULT_LANGUAGE_CODE = 'zh-CN'
const LANGUAGE_TEXT_MAP = {
  'zh-CN': '简体中文',
  'zh-HK': '繁体中文（香港）',
  'zh-TW': '繁体中文（台湾）',
  'zh-SG': '简体中文（新加坡）',
  'ja-JP': '日本語',
  'en-US': 'English'
}

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

function getLanguageText(input) {
  const languageCode = normalizeLanguageCode(input)
  if (!languageCode) {
    return input || ''
  }

  return LANGUAGE_TEXT_MAP[languageCode] || languageCode
}

module.exports = {
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODE_MAP,
  LANGUAGE_TEXT_MAP,
  getLanguageText,
  normalizeLanguageCode,
  isSupportedLanguageCode
}
