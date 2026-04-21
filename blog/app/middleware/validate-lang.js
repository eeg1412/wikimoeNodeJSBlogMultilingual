import { ensureSupportedLanguage } from '@/utils/site'

export default defineNuxtRouteMiddleware(to => {
  const languageCode = Array.isArray(to.params.lang)
    ? to.params.lang[0]
    : to.params.lang

  if (!ensureSupportedLanguage(languageCode)) {
    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Not Found' }))
  }
})