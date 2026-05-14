import {
  LANGUAGE_CONFIG_LIST,
  REQUIRED_LANGUAGE_MODULE_NAMES
} from '../../shared/languages'

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

export const SUPPORTED_LANGUAGE_CODES = LANGUAGE_CONFIG_LIST.map(
  languageConfig => {
    return languageConfig.code
  }
)
export const DEFAULT_LANGUAGE_CODE = DEFAULT_LANGUAGE_CONFIG.code

export const LANGUAGE_CODE_MAP = SUPPORTED_LANGUAGE_CODES.reduce(
  (map, code) => {
    map[code.toLowerCase()] = code
    return map
  },
  {}
)

const translationModules = import.meta.glob('./*/*.js', {
  eager: true,
  import: 'default'
})

function discoverLanguageTextMap() {
  const discoveredLanguageTextMap = {}

  for (const [modulePath, moduleText] of Object.entries(translationModules)) {
    const match = modulePath.match(/^\.\/([^/]+)\/([^/]+)\.js$/)
    if (!match) {
      throw new Error(`Invalid language file path: ${modulePath}`)
    }

    const languageCode = match[1]
    const moduleName = match[2]

    if (!discoveredLanguageTextMap[languageCode]) {
      discoveredLanguageTextMap[languageCode] = {}
    }

    discoveredLanguageTextMap[languageCode][moduleName] = moduleText
  }

  return discoveredLanguageTextMap
}

function buildLanguageTextMap() {
  const discoveredLanguageTextMap = discoverLanguageTextMap()
  const languageTextMap = {}

  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    const languageText = discoveredLanguageTextMap[languageCode]
    if (!languageText) {
      throw new Error(`Missing translation directory: ${languageCode}`)
    }

    for (const moduleName of REQUIRED_LANGUAGE_MODULE_NAMES) {
      if (!languageText[moduleName]) {
        throw new Error(
          `Missing translation file: ${languageCode}/${moduleName}.js`
        )
      }
    }

    languageTextMap[languageCode] = languageText
  }

  for (const languageCode of Object.keys(discoveredLanguageTextMap)) {
    if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
      throw new Error(`Unexpected translation directory: ${languageCode}`)
    }
  }

  return languageTextMap
}

const LANGUAGE_TEXT_MAP = buildLanguageTextMap()

export function normalizeLanguageCode(input) {
  if (typeof input !== 'string') {
    return null
  }

  const key = input.trim().toLowerCase()
  if (!key) {
    return null
  }

  return LANGUAGE_CODE_MAP[key] || null
}

export function assertLanguageCode(input) {
  const languageCode = normalizeLanguageCode(input)
  if (languageCode) {
    return languageCode
  }

  if (typeof showError === 'function') {
    showError({ statusCode: 404, statusMessage: 'Language code unsupported' })
  }

  throw new Error('LANGUAGE_CODE_UNSUPPORTED')
}

function readPath(source, path) {
  const keys = path.split('.')
  let value = source

  for (const key of keys) {
    if (!value || typeof value !== 'object' || !(key in value)) {
      return undefined
    }

    value = value[key]
  }

  return value
}

function interpolateText(text, params) {
  if (typeof text !== 'string' || !params || typeof params !== 'object') {
    return text
  }

  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key])
    }

    return match
  })
}

export function getLanguageText(languageCode, path, params = {}) {
  const canonicalCode =
    normalizeLanguageCode(languageCode) || DEFAULT_LANGUAGE_CODE
  const currentText = readPath(LANGUAGE_TEXT_MAP[canonicalCode], path)
  const fallbackText = readPath(LANGUAGE_TEXT_MAP[DEFAULT_LANGUAGE_CODE], path)
  const text = currentText === undefined ? fallbackText : currentText

  if (text === undefined) {
    return path
  }

  return interpolateText(text, params)
}

export function getLanguageTextMap(languageCode) {
  const canonicalCode =
    normalizeLanguageCode(languageCode) || DEFAULT_LANGUAGE_CODE
  return LANGUAGE_TEXT_MAP[canonicalCode]
}
