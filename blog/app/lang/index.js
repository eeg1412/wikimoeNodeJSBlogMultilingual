import zhCNCommon from './zh-CN/common'
import zhCNAlmanac from './zh-CN/almanac'
import zhCNSeeking from './zh-CN/seeking'
import zhHKCommon from './zh-HK/common'
import zhHKAlmanac from './zh-HK/almanac'
import zhHKSeeking from './zh-HK/seeking'
import zhTWCommon from './zh-TW/common'
import zhTWAlmanac from './zh-TW/almanac'
import zhTWSeeking from './zh-TW/seeking'
import zhSGCommon from './zh-SG/common'
import zhSGAlmanac from './zh-SG/almanac'
import zhSGSeeking from './zh-SG/seeking'
import jaJPCommon from './ja-JP/common'
import jaJPAlmanac from './ja-JP/almanac'
import jaJPSeeking from './ja-JP/seeking'
import enUSCommon from './en-US/common'
import enUSAlmanac from './en-US/almanac'
import enUSSeeking from './en-US/seeking'

export const SUPPORTED_LANGUAGE_CODES = [
  'zh-CN',
  'zh-HK',
  'zh-TW',
  'zh-SG',
  'ja-JP',
  'en-US'
]
export const DEFAULT_LANGUAGE_CODE = 'zh-CN'

export const LANGUAGE_CODE_MAP = SUPPORTED_LANGUAGE_CODES.reduce(
  (map, code) => {
    map[code.toLowerCase()] = code
    return map
  },
  {}
)

const LANGUAGE_TEXT_MAP = {
  'zh-CN': {
    common: zhCNCommon,
    almanac: zhCNAlmanac,
    seeking: zhCNSeeking
  },
  'zh-HK': {
    common: zhHKCommon,
    almanac: zhHKAlmanac,
    seeking: zhHKSeeking
  },
  'zh-TW': {
    common: zhTWCommon,
    almanac: zhTWAlmanac,
    seeking: zhTWSeeking
  },
  'zh-SG': {
    common: zhSGCommon,
    almanac: zhSGAlmanac,
    seeking: zhSGSeeking
  },
  'ja-JP': {
    common: jaJPCommon,
    almanac: jaJPAlmanac,
    seeking: jaJPSeeking
  },
  'en-US': {
    common: enUSCommon,
    almanac: enUSAlmanac,
    seeking: enUSSeeking
  }
}

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
