// Nuxt server route：将 /sitemap.xml 代理到后端 /api/blog/sitemap.xml
// 由后端根据本地多语言数据库动态生成。
export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const apiDomain = config.public.apiDomain
  const xml = await $fetch('/api/blog/sitemap.xml', {
    baseURL: apiDomain,
    responseType: 'text'
  })
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return xml
})
