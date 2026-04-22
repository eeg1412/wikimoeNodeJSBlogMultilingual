const { isDangerousUrl, trimTrailingSlash } = require('./sourceUrlNormalizer')

function resolveSourceAssetUrl(rawValue, sourceBlogPublicOrigin) {
  if (rawValue === null || typeof rawValue === 'undefined') {
    return rawValue
  }

  if (typeof rawValue !== 'string') {
    return rawValue
  }

  const trimmedValue = rawValue.trim()

  if (!trimmedValue) {
    return trimmedValue
  }

  if (isDangerousUrl(trimmedValue)) {
    throw new Error(`检测到危险 URL：${trimmedValue}`)
  }

  if (
    trimmedValue.startsWith('http://') ||
    trimmedValue.startsWith('https://')
  ) {
    return trimmedValue
  }

  if (!trimmedValue.startsWith('/')) {
    return trimmedValue
  }

  if (!sourceBlogPublicOrigin) {
    return trimmedValue
  }

  const normalizedOrigin = trimTrailingSlash(sourceBlogPublicOrigin)
  return `${normalizedOrigin}${trimmedValue}`
}

module.exports = {
  resolveSourceAssetUrl
}
