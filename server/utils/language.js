const { LANGUAGE_CONFIG_LIST } = require('../config/languages')

function assertValidLanguageConfigList(languageConfigList) {
  if (!Array.isArray(languageConfigList) || languageConfigList.length === 0) {
    throw new Error('LANGUAGE_CONFIG_LIST must be a non-empty array')
  }

  const languageCodeSet = new Set()
  let defaultLanguageConfig = null

  for (const languageConfig of languageConfigList) {
    if (!languageConfig || typeof languageConfig !== 'object') {
      throw new Error('Language config must be an object')
    }

    if (
      typeof languageConfig.code !== 'string' ||
      !languageConfig.code.trim()
    ) {
      throw new Error('Language config code is required')
    }

    if (languageConfig.code !== languageConfig.code.trim()) {
      throw new Error(
        `Language config code has extra whitespace: ${languageConfig.code}`
      )
    }

    if (languageCodeSet.has(languageConfig.code)) {
      throw new Error(`Duplicate language code: ${languageConfig.code}`)
    }

    if (
      typeof languageConfig.label !== 'string' ||
      !languageConfig.label.trim()
    ) {
      throw new Error(`Language label is required: ${languageConfig.code}`)
    }

    languageCodeSet.add(languageConfig.code)

    if (languageConfig.isDefault) {
      if (defaultLanguageConfig) {
        throw new Error('Only one default language is allowed')
      }

      defaultLanguageConfig = languageConfig
    }
  }

  if (!defaultLanguageConfig) {
    throw new Error('Default language config is required')
  }
}

assertValidLanguageConfigList(LANGUAGE_CONFIG_LIST)

const DEFAULT_LANGUAGE_CONFIG = LANGUAGE_CONFIG_LIST.find(languageConfig => {
  return languageConfig.isDefault
})
const SUPPORTED_LANGUAGE_CODES = LANGUAGE_CONFIG_LIST.map(languageConfig => {
  return languageConfig.code
})
const DEFAULT_LANGUAGE_CODE = DEFAULT_LANGUAGE_CONFIG.code
const LANGUAGE_TEXT_MAP = LANGUAGE_CONFIG_LIST.reduce(
  (languageTextMap, languageConfig) => {
    languageTextMap[languageConfig.code] = languageConfig.label
    return languageTextMap
  },
  {}
)

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
  LANGUAGE_CONFIG_LIST,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODE_MAP,
  LANGUAGE_TEXT_MAP,
  getLanguageText,
  normalizeLanguageCode,
  isSupportedLanguageCode
}
