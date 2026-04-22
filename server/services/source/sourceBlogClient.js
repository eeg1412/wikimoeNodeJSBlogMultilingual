const { getSystemSettingValue } = require('../settingsService')
const {
  normalizeSourceUrl,
  trimTrailingSlash
} = require('../../../common/utils/sourceUrlNormalizer')

function unwrapResponseData(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    return payload.data
  }

  return payload
}

function normalizeApiBaseUrl(apiBaseUrl) {
  const normalizedApiBaseUrl = trimTrailingSlash(apiBaseUrl)
  return `${normalizedApiBaseUrl}/`
}

function buildApiUrl(apiBaseUrl, pathname, queryParams) {
  const url = new URL(pathname, normalizeApiBaseUrl(apiBaseUrl))

  if (queryParams && typeof queryParams === 'object') {
    for (const [key, value] of Object.entries(queryParams)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item))
        }
        continue
      }

      if (value === null || typeof value === 'undefined') {
        continue
      }

      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(function () {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    })
    const responseText = await response.text()
    let data = null

    if (responseText) {
      data = JSON.parse(responseText)
    }

    return {
      status: response.status,
      ok: response.ok,
      data
    }
  } finally {
    clearTimeout(timer)
  }
}

function extractErrorMessage(result) {
  const errors = result.data && result.data.errors

  if (Array.isArray(errors) && errors.length > 0 && errors[0].message) {
    return errors[0].message
  }

  return `请求原站失败，状态码 ${result.status}`
}

async function getClientConfig() {
  const sourceBlogApiBaseUrl = await getSystemSettingValue(
    'sourceBlogApiBaseUrl',
    null
  )
  const sourceBlogPublicOrigin = await getSystemSettingValue(
    'sourceBlogPublicOrigin',
    null
  )
  const sourceBlogRequestTimeoutMs = await getSystemSettingValue(
    'sourceBlogRequestTimeoutMs',
    10000
  )

  if (!sourceBlogApiBaseUrl) {
    throw new Error('system.sourceBlogApiBaseUrl 未配置')
  }

  return {
    sourceBlogApiBaseUrl,
    sourceBlogPublicOrigin,
    sourceBlogRequestTimeoutMs
  }
}

async function fetchPostDetail(sourceIdentifier, types) {
  const clientConfig = await getClientConfig()
  const url = buildApiUrl(clientConfig.sourceBlogApiBaseUrl, 'post/detail', {
    id: sourceIdentifier,
    type: types
  })
  const result = await fetchJson(url, clientConfig.sourceBlogRequestTimeoutMs)

  return {
    ...result,
    payload: unwrapResponseData(result.data),
    clientConfig
  }
}

async function resolveImportablePostDetail(sourceIdentifier) {
  const typedResult = await fetchPostDetail(sourceIdentifier, [1, 2])

  if (typedResult.ok) {
    return typedResult
  }

  if (typedResult.status !== 404) {
    throw new Error(extractErrorMessage(typedResult))
  }

  const fallbackResult = await fetchPostDetail(sourceIdentifier)

  if (fallbackResult.status === 404) {
    throw new Error('文章不存在')
  }

  if (!fallbackResult.ok) {
    throw new Error(extractErrorMessage(fallbackResult))
  }

  if (fallbackResult.payload && fallbackResult.payload.type === 3) {
    throw new Error('页面不支持导入')
  }

  return fallbackResult
}

function normalizeSourceAssetPath(rawValue, clientConfig) {
  return normalizeSourceUrl(rawValue, {
    sourceBlogApiBaseUrl: clientConfig.sourceBlogApiBaseUrl,
    sourceBlogPublicOrigin: clientConfig.sourceBlogPublicOrigin
  })
}

module.exports = {
  buildApiUrl,
  fetchPostDetail,
  normalizeSourceAssetPath,
  resolveImportablePostDetail,
  unwrapResponseData
}
