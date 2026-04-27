export default defineEventHandler(event => {
  const config = useRuntimeConfig()
  const sourceApiDomain = config.sourceApiDomain || config.apiDomain
  const originalUrl = event.node.req.url || ''
  const sourceUrl = originalUrl.replace(
    /^\/api\/source-blog(?=\/|$)/,
    '/api/blog'
  )
  const url = `${sourceApiDomain}${sourceUrl}`
  return proxyRequest(event, url)
})
