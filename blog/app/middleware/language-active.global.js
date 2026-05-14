import { DEFAULT_LANGUAGE_CODE, normalizeLanguageCode } from '@/lang'

function getRouteCode(route) {
  const code = route.params.code

  if (Array.isArray(code)) {
    return code[0]
  }

  return code
}

function getRouteLanguageCode(route) {
  const routeCode = getRouteCode(route)

  if (!routeCode) {
    return DEFAULT_LANGUAGE_CODE
  }

  return normalizeLanguageCode(routeCode)
}

function getErrorStatusCode(error) {
  return (
    error?.statusCode ||
    error?.status ||
    error?.response?.status ||
    error?.data?.statusCode
  )
}

function createLanguageNotFoundError() {
  return createError({ statusCode: 404, statusMessage: 'Language not found' })
}

export default defineNuxtRouteMiddleware(async to => {
  const languageCode = getRouteLanguageCode(to)

  if (!languageCode) {
    throw createLanguageNotFoundError()
  }

  const { getOptions } = useOptions()

  try {
    await getOptions({ languageCode, force: true })
  } catch (error) {
    if (getErrorStatusCode(error) === 404) {
      throw error
    }

    throw error
  }
})
