// 支持的语言枚举
// 注意：严格按照 plan 要求使用 en / jp / tw，不使用 ISO ja
const SUPPORTED_LANGUAGE_CODES = ['en', 'jp', 'tw']

const LANGUAGE_LABELS = {
  en: 'English',
  jp: '日本語',
  tw: '繁體中文'
}

function isSupportedLanguage(code) {
  return SUPPORTED_LANGUAGE_CODES.indexOf(code) !== -1
}

module.exports = {
  SUPPORTED_LANGUAGE_CODES,
  LANGUAGE_LABELS,
  isSupportedLanguage
}
