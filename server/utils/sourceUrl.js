const { SOURCE_ASSET_PATH_PREFIXES } = require('../../common/constants')

function ensureLeadingSlash(pathname) {
  if (!pathname) {
    return pathname
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function canUseUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function isInternalSourceUrl(value, sourceOrigin) {
  if (!canUseUrl(value)) {
    return false
  }

  try {
    const current = new URL(value)
    const source = new URL(sourceOrigin)
    return current.origin === source.origin
  } catch (error) {
    return false
  }
}

function isSourceAssetRelativePath(value) {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = ensureLeadingSlash(value)
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

function normalizeSourceUrl(value, sourceOrigin) {
  if (typeof value !== 'string' || !value.trim()) {
    return value
  }

  if (value.startsWith('//')) {
    return value
  }

  if (value.startsWith('/')) {
    return ensureLeadingSlash(value)
  }

  if (!isInternalSourceUrl(value, sourceOrigin)) {
    return value
  }

  const parsed = new URL(value)
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

function normalizeSourceValueDeep(input, sourceOrigin) {
  if (Array.isArray(input)) {
    return input.map(item => normalizeSourceValueDeep(item, sourceOrigin))
  }

  if (input && typeof input === 'object') {
    return Object.keys(input).reduce((result, key) => {
      result[key] = normalizeSourceValueDeep(input[key], sourceOrigin)
      return result
    }, {})
  }

  if (typeof input === 'string') {
    return normalizeSourceUrl(input, sourceOrigin)
  }

  return input
}

function resolveSourceAssetUrl(pathOrUrl, sourceOrigin) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return pathOrUrl
  }
  if (canUseUrl(pathOrUrl)) {
    return pathOrUrl
  }
  if (!pathOrUrl.startsWith('/')) {
    return pathOrUrl
  }
  return `${sourceOrigin.replace(/\/$/, '')}${pathOrUrl}`
}

module.exports = {
  isInternalSourceUrl,
  isSourceAssetRelativePath,
  normalizeSourceUrl,
  normalizeSourceValueDeep,
  resolveSourceAssetUrl
}