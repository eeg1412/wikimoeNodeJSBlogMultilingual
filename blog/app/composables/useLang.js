import {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES,
  assertLanguageCode,
  getLanguageText,
  normalizeLanguageCode
} from '@/lang'

function getRouteCode(route) {
  const code = route.params.code

  if (Array.isArray(code)) {
    return code[0]
  }

  return code
}

function isExternalPath(path) {
  return (
    /^(https?:)?\/\//i.test(path) || /^(mailto|tel|javascript):/i.test(path)
  )
}

function splitPath(path) {
  const match = path.match(/^([^?#]*)([?#].*)?$/)

  return {
    pathname: match?.[1] || '/',
    suffix: match?.[2] || ''
  }
}

export function buildLanguagePath(languageCode, path = '/') {
  if (typeof path !== 'string' || !path) {
    return `/${languageCode}`
  }

  if (isExternalPath(path) || path.startsWith('#')) {
    return path
  }

  const { pathname, suffix } = splitPath(path)
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const pathList = normalizedPath.split('/')
  const existingCode = normalizeLanguageCode(pathList[1])

  if (existingCode) {
    pathList[1] = existingCode
    return pathList.join('/') + suffix
  }

  if (normalizedPath === '/') {
    return `/${languageCode}${suffix}`
  }

  return `/${languageCode}${normalizedPath}${suffix}`
}

export function useLang() {
  const route = useRoute()
  const languageCode = computed(() => {
    const routeCode = getRouteCode(route)
    if (!routeCode) {
      return DEFAULT_LANGUAGE_CODE
    }

    return assertLanguageCode(routeCode)
  })
  languageCode.value

  const t = (path, params = {}) => {
    return getLanguageText(languageCode.value, path, params)
  }

  const localePath = path => buildLanguagePath(languageCode.value, path)

  const localeUrl = (siteUrl, path) => {
    return `${siteUrl || ''}${localePath(path)}`
  }

  return {
    languageCode,
    supportedLanguageCodes: SUPPORTED_LANGUAGE_CODES,
    normalizeLanguageCode,
    localePath,
    localeUrl,
    t
  }
}
