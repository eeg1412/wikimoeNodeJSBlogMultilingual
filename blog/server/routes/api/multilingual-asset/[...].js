export default defineEventHandler(event => {
  const config = useRuntimeConfig()
  const apiDomain = config.apiDomain

  if (!apiDomain) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Multilingual API domain is not configured'
    })
  }

  const originalUrl = event.node.req.url || ''
  const assetUrl = originalUrl.replace(
    '/api/multilingual-asset',
    '/multilingual-assets'
  )

  return proxyRequest(event, `${apiDomain}${assetUrl}`)
})
