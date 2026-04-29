function getBaseOrigin(baseUrl) {
  const text = String(baseUrl || '').trim()
  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).origin
    } catch (error) {
      return ''
    }
  }

  return ''
}

function normalizeUrlOptions(options) {
  if (typeof options === 'string') {
    return {
      sourceSiteUrl: options
    }
  }

  return {
    sourceSiteUrl: options?.sourceSiteUrl || ''
  }
}

function joinOriginPath(origin, path) {
  if (!origin) {
    return path
  }
  return `${origin}${path}`
}

function getAssetOrigin(options) {
  const urlOptions = normalizeUrlOptions(options)
  return getBaseOrigin(urlOptions.sourceSiteUrl)
}

function normalizeAssetUrl(value, options) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  if (
    text.startsWith('data:') ||
    text.startsWith('blob:') ||
    text.startsWith('#') ||
    /^https?:\/\//i.test(text)
  ) {
    return text
  }

  if (text.startsWith('//')) {
    if (typeof window !== 'undefined' && window.location?.protocol) {
      return `${window.location.protocol}${text}`
    }
    return `https:${text}`
  }

  if (text.startsWith('./')) {
    return normalizeAssetUrl(text.slice(2), options)
  }

  const path = text.startsWith('/') ? text : `/${text}`
  const origin = getAssetOrigin(options)

  return joinOriginPath(origin, path)
}

function appendCacheQuery(value, timestamp, options) {
  const url = normalizeAssetUrl(value, options)
  if (!url) {
    return ''
  }

  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('#')
  ) {
    return url
  }

  const hashIndex = url.indexOf('#')
  const urlWithoutHash = hashIndex > -1 ? url.slice(0, hashIndex) : url
  const hash = hashIndex > -1 ? url.slice(hashIndex) : ''
  const joiner = urlWithoutHash.includes('?') ? '&' : '?'

  return `${urlWithoutHash}${joiner}t=${timestamp}${hash}`
}

function getFirstPath(item, fieldList) {
  for (const fieldName of fieldList) {
    const value = item?.[fieldName]
    if (value) {
      return value
    }
  }
  return ''
}

export function getMediaOriginalPath(item) {
  return getFirstPath(item, ['localFilepath', 'filepath', 'remoteFilepath'])
}

export function getMediaPreviewPath(item) {
  return getFirstPath(item, [
    'localThumbnailPath',
    'thumfor',
    'localFilepath',
    'filepath',
    'remoteFilepath'
  ])
}

export function getMediaCoverPath(item) {
  return getFirstPath(item, ['localThumbnailPath', 'thumfor'])
}

export function getRichEditorMediaUrls(item, timestamp, options) {
  const originalPath = getMediaOriginalPath(item)
  const previewPath = getMediaPreviewPath(item)
  const coverPath = getMediaCoverPath(item)

  return {
    src: appendCacheQuery(previewPath || originalPath, timestamp, options),
    href: appendCacheQuery(originalPath || previewPath, timestamp, options),
    cover: appendCacheQuery(coverPath, timestamp, options),
    alt: item?.description || item?.filename || item?.name || ''
  }
}
