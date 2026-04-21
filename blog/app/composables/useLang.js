const SUPPORTED = ['en', 'jp', 'tw']

export function useSupportedLanguages() {
  return SUPPORTED
}

export function isSupportedLang(code) {
  return SUPPORTED.indexOf(code) !== -1
}

export function normalizeLangParam(code) {
  return isSupportedLang(code) ? code : null
}
