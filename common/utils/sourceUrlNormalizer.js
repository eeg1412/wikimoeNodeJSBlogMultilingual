function trimTrailingSlash(url) {
  let normalizedUrl = String(url).trim()

  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1)
  }

  return normalizedUrl
}

function isDangerousUrl(value) {
  const normalizedValue = String(value).trim().toLowerCase()

  if (normalizedValue.startsWith('javascript:')) {
    return true
  }

  if (normalizedValue.startsWith('vbscript:')) {
    return true
  }

  if (normalizedValue.startsWith('data:text/html')) {
    return true
  }

  return false
}

function normalizeSourceOrigins(options) {
  const finalOptions = options || {}
  const sourceOrigins = []

  if (finalOptions.sourceBlogApiBaseUrl) {
    sourceOrigins.push(finalOptions.sourceBlogApiBaseUrl)
  }

  if (finalOptions.sourceBlogPublicOrigin) {
    sourceOrigins.push(finalOptions.sourceBlogPublicOrigin)
  }

  if (Array.isArray(finalOptions.extraOrigins)) {
    sourceOrigins.push(...finalOptions.extraOrigins)
  }

  const normalizedOrigins = []

  for (const sourceOrigin of sourceOrigins) {
    if (!sourceOrigin) {
      continue
    }

    try {
      const url = new URL(String(sourceOrigin).trim())
      normalizedOrigins.push(trimTrailingSlash(url.origin + url.pathname))
      normalizedOrigins.push(trimTrailingSlash(url.origin))
    } catch (error) {
      continue
    }
  }

  return Array.from(new Set(normalizedOrigins))
}

function buildRelativePathFromUrl(url) {
  let relativePath = url.pathname

  if (!relativePath.startsWith('/')) {
    relativePath = `/${relativePath}`
  }

  if (url.search) {
    relativePath += url.search
  }

  if (url.hash) {
    relativePath += url.hash
  }

  return relativePath
}

function normalizeSourceUrl(rawValue, options) {
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

  if (trimmedValue.startsWith('/') || trimmedValue.startsWith('#')) {
    return trimmedValue
  }

  let parsedUrl = null

  try {
    parsedUrl = new URL(trimmedValue)
  } catch (error) {
    return trimmedValue
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return trimmedValue
  }

  const normalizedOrigins = normalizeSourceOrigins(options)
  const normalizedUrlWithoutTrailingSlash = trimTrailingSlash(
    parsedUrl.origin + parsedUrl.pathname
  )
  const normalizedOrigin = trimTrailingSlash(parsedUrl.origin)

  if (normalizedOrigins.includes(normalizedUrlWithoutTrailingSlash)) {
    return buildRelativePathFromUrl(parsedUrl)
  }

  if (normalizedOrigins.includes(normalizedOrigin)) {
    return buildRelativePathFromUrl(parsedUrl)
  }

  return trimmedValue
}

module.exports = {
  isDangerousUrl,
  normalizeSourceOrigins,
  normalizeSourceUrl,
  trimTrailingSlash
}
