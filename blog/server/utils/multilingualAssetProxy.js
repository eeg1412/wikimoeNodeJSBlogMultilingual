function getMultilingualServerDomain(config) {
  const multilingualServerDomain = config.apiDomain

  if (!multilingualServerDomain) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Multilingual server domain is not configured'
    })
  }

  return multilingualServerDomain
}

export function buildMultilingualAssetUrl(config, assetPath) {
  if (!assetPath || !assetPath.startsWith('/multilingual-assets')) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Invalid multilingual asset path'
    })
  }

  return `${getMultilingualServerDomain(config)}${assetPath}`
}

export function proxyMultilingualAsset(event, assetPath) {
  const config = useRuntimeConfig()
  const requestPath = assetPath || event.node.req.url || ''

  return proxyRequest(event, buildMultilingualAssetUrl(config, requestPath))
}
