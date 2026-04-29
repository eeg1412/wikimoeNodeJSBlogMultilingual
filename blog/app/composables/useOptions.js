import { getMultilingualOptionsApi, getOptionsApi } from '~/api/option'

const SOURCE_ASSET_PATH_PREFIXES = [
  '/content/',
  '/upload/',
  '/ucloudImg/',
  '/up_works/',
  '/web_demo/'
]

const MULTILINGUAL_SERVER_ASSET_PATH_PREFIXES = [
  '/multilingual-assets/upload/',
  '/multilingual-assets/content/',
  '/multilingual-assets/ucloudImg/',
  '/multilingual-assets/up_works/',
  '/multilingual-assets/web_demo/'
]

const MULTILINGUAL_SERVER_ASSET_PREFIX = '/multilingual-assets'
const MULTILINGUAL_SERVER_ASSET_PROXY_PREFIX = '/api/multilingual-asset'

const MULTILINGUAL_SERVER_ASSET_PATH_SET = new Set([
  '/multilingual-assets/sitemap.xsl'
])

function parseUrlParts(value) {
  if (!value || typeof value !== 'string') {
    return null
  }

  let normalizedValue = value.trim()

  if (!normalizedValue) {
    return null
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalizedValue)) {
    if (!/^https?:\/\//i.test(normalizedValue)) {
      return null
    }

    const pathnameStartIndex = normalizedValue.indexOf(
      '/',
      normalizedValue.indexOf('://') + 3
    )
    normalizedValue =
      pathnameStartIndex >= 0 ? normalizedValue.slice(pathnameStartIndex) : '/'
  } else if (normalizedValue.startsWith('//')) {
    const pathnameStartIndex = normalizedValue.indexOf('/', 2)
    normalizedValue =
      pathnameStartIndex >= 0 ? normalizedValue.slice(pathnameStartIndex) : '/'
  }

  let hash = ''
  const hashIndex = normalizedValue.indexOf('#')
  if (hashIndex >= 0) {
    hash = normalizedValue.slice(hashIndex)
    normalizedValue = normalizedValue.slice(0, hashIndex)
  }

  let search = ''
  const searchIndex = normalizedValue.indexOf('?')
  if (searchIndex >= 0) {
    search = normalizedValue.slice(searchIndex)
    normalizedValue = normalizedValue.slice(0, searchIndex)
  }

  return {
    pathname: normalizedValue || '/',
    search,
    hash
  }
}

function isSourceAssetPath(pathname) {
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function isMultilingualServerAssetPath(pathname) {
  if (MULTILINGUAL_SERVER_ASSET_PATH_SET.has(pathname)) {
    return true
  }

  return MULTILINGUAL_SERVER_ASSET_PATH_PREFIXES.some(prefix => {
    return pathname.startsWith(prefix)
  })
}

function normalizeMultilingualServerAssetUrl(value) {
  if (!value || typeof value !== 'string') {
    return value
  }

  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('#')
  ) {
    return value
  }

  const url = parseUrlParts(value)

  if (!url || !isMultilingualServerAssetPath(url.pathname)) {
    return value
  }

  const proxyPath = url.pathname.startsWith(MULTILINGUAL_SERVER_ASSET_PREFIX)
    ? url.pathname.slice(MULTILINGUAL_SERVER_ASSET_PREFIX.length)
    : url.pathname

  return `${MULTILINGUAL_SERVER_ASSET_PROXY_PREFIX}${proxyPath}${url.search}${url.hash}`
}

function normalizeSourceAssetUrl(value) {
  if (!value || typeof value !== 'string') {
    return value
  }

  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('#')
  ) {
    return value
  }

  const url = parseUrlParts(value)

  if (!url || !isSourceAssetPath(url.pathname)) {
    return value
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function normalizeAssetUrl(value) {
  const multilingualServerAssetUrl = normalizeMultilingualServerAssetUrl(value)

  if (multilingualServerAssetUrl !== value) {
    return multilingualServerAssetUrl
  }

  return normalizeSourceAssetUrl(value)
}

function normalizeAssetCss(css) {
  if (!css || typeof css !== 'string') {
    return css
  }

  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    const normalizedUrl = normalizeAssetUrl(url.trim())
    return `url(${quote}${normalizedUrl}${quote})`
  })
}

function normalizeOptions(data) {
  const normalizedOptions = { ...data }
  const assetFieldList = [
    'siteLogo',
    'siteDarkLogo',
    'siteDefaultCover',
    'siteFavicon'
  ]

  assetFieldList.forEach(field => {
    normalizedOptions[field] = normalizeAssetUrl(normalizedOptions[field])
  })
  normalizedOptions.siteExtraCss = normalizeAssetCss(
    normalizedOptions.siteExtraCss
  )

  return normalizedOptions
}

function mergeOptions(sourceOptions, multilingualOptions) {
  const mergedOptions = { ...sourceOptions }

  Object.keys(multilingualOptions).forEach(name => {
    mergedOptions[name] = multilingualOptions[name]
  })

  return mergedOptions
}

export function useOptions() {
  const options = useState('options', () => null)

  async function getOptions() {
    const [sourceRes, multilingualRes] = await Promise.all([
      getOptionsApi(),
      getMultilingualOptionsApi()
    ])
    const sourceOptions = sourceRes.data || {}
    const multilingualOptions = multilingualRes.data || {}

    options.value = normalizeOptions(
      mergeOptions(sourceOptions, multilingualOptions)
    )
  }

  return { options, getOptions }
}
