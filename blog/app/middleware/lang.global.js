// 语言前缀校验：任何访问 /:lang/* 的页面都必须走这个中间件。
// 根路径 / 由 pages/index.vue 负责重定向到 siteDefaultLanguageCode。
export default defineNuxtRouteMiddleware(to => {
  const lang = to.params?.lang
  if (!lang) return
  if (!isSupportedLang(lang)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Unsupported language',
      fatal: true
    })
  }
})
