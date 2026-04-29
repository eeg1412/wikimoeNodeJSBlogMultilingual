const FORWARDED_SOURCE_ASSET_HEADERS = [
  'accept',
  'accept-language',
  'if-modified-since',
  'if-none-match',
  'range',
  'user-agent'
]
const MULTILINGUAL_LOCAL_PUBLIC_ASSET_PREFIX = '/_multilingual_public'

function getSourceAssetRequestHeaders(event) {
  return FORWARDED_SOURCE_ASSET_HEADERS.reduce((headers, key) => {
    const value = getRequestHeader(event, key)

    if (value) {
      headers[key] = value
    }

    return headers
  }, {})
}

function getFallbackAvatarPath(originalUrl) {
  const path = originalUrl.split('?')[0]

  if (!path.startsWith('/upload/avatar/')) {
    return ''
  }

  const seed = path.split('').reduce((sum, item) => {
    return sum + item.charCodeAt()
  }, 0)
  const avatarIndex = seed % 176
  return `${MULTILINGUAL_LOCAL_PUBLIC_ASSET_PREFIX}/img/avatar/${avatarIndex}.webp`
}

function getSourceAssetDomainList(config) {
  return [
    config.sourceAssetDomain,
    config.sourceApiDomain,
    config.apiDomain
  ].filter((domain, index, domainList) => {
    return domain && domainList.indexOf(domain) === index
  })
}

export async function proxySourceAsset(event) {
  const config = useRuntimeConfig()
  const sourceAssetDomainList = getSourceAssetDomainList(config)

  if (sourceAssetDomainList.length === 0) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Source asset domain is not configured'
    })
  }

  const originalUrl = event.node.req.url || ''
  const requestHeaders = getSourceAssetRequestHeaders(event)
  let response = null

  for (const sourceAssetDomain of sourceAssetDomainList) {
    response = await fetch(`${sourceAssetDomain}${originalUrl}`, {
      headers: requestHeaders
    })

    if (response.status !== 404) {
      return sendWebResponse(event, response)
    }
  }

  if (response?.status === 404) {
    const fallbackAvatarPath = getFallbackAvatarPath(originalUrl)

    if (fallbackAvatarPath) {
      return sendRedirect(event, fallbackAvatarPath, 302)
    }
  }

  return sendWebResponse(event, response)
}
