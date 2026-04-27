import { getMultilingualOptionsApi, getOptionsApi } from '~/api/option'

const SOURCE_ASSET_PATH_PREFIXES = [
  '/content/',
  '/upload/',
  '/ucloudImg/',
  '/up_works/',
  '/web_demo/'
]

function isSourceAssetPath(pathname) {
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))
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

  try {
    const url = new URL(value, 'http://source.local')

    if (!isSourceAssetPath(url.pathname)) {
      return value
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch (error) {
    return value
  }
}

function normalizeSourceAssetCss(css) {
  if (!css || typeof css !== 'string') {
    return css
  }

  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
    const normalizedUrl = normalizeSourceAssetUrl(url.trim())
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
    normalizedOptions[field] = normalizeSourceAssetUrl(normalizedOptions[field])
  })
  normalizedOptions.siteExtraCss = normalizeSourceAssetCss(
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
