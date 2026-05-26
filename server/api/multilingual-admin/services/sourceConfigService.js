const {
  getSourceSeoSettingsCacheData,
  refreshSourceSeoSettingsCache
} = require('../../../utils/sourceSeoSettings')
const cacheDataUtils = require('../../../config/cacheData')
const rssUtils = require('../../../utils/rss')
const sitemapUtils = require('../../../utils/sitemap')
const {
  ERROR_CODES,
  ApiError
} = require('../../../utils/multilingualAdminResponse')

const SOURCE_DOMAIN_ENV_NAME = 'SOURCE_DOMAIN'
const SOURCE_ADMIN_TOKEN_CHECK_PATH = '/api/admin/token/check'
const SOURCE_ADMIN_AUTH_TIMEOUT = 5000

const SOURCE_CONFIG_EXTRA_DEFAULTS = {
  siteReferrerWhiteList: []
}

const SOURCE_CONFIG_EXTRA_NAMES = Object.keys(SOURCE_CONFIG_EXTRA_DEFAULTS)

function getSourceOptionRepository() {
  return global.$mongodDB?.source?.repositories?.options
}

function buildDefaultExtraValues() {
  const values = {}

  SOURCE_CONFIG_EXTRA_NAMES.forEach(name => {
    const defaultValue = SOURCE_CONFIG_EXTRA_DEFAULTS[name]
    values[name] = Array.isArray(defaultValue)
      ? [...defaultValue]
      : defaultValue
  })

  return values
}

function normalizeExtraValue(defaultValue, value) {
  if (Array.isArray(defaultValue)) {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean)
    }

    return String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return String(value || '')
}

async function getExtraSourceConfigValues() {
  const values = buildDefaultExtraValues()
  const repository = getSourceOptionRepository()

  if (!repository) {
    return values
  }

  const optionList = await repository.find(
    { name: { $in: SOURCE_CONFIG_EXTRA_NAMES } },
    'name value',
    { lean: true }
  )

  optionList.forEach(item => {
    if (!Object.prototype.hasOwnProperty.call(values, item.name)) {
      return
    }

    values[item.name] = normalizeExtraValue(
      SOURCE_CONFIG_EXTRA_DEFAULTS[item.name],
      item.value
    )
  })

  return values
}

function buildSourceConfigData(cacheData, extraValues) {
  const names = cacheData.names.slice()

  SOURCE_CONFIG_EXTRA_NAMES.forEach(name => {
    if (!names.includes(name)) {
      names.push(name)
    }
  })

  return {
    names,
    values: {
      ...cacheData.values,
      ...extraValues
    },
    updatedAt: cacheData.updatedAt || null
  }
}

async function getSourceConfigData() {
  const [cacheData, extraValues] = await Promise.all([
    getSourceSeoSettingsCacheData(),
    getExtraSourceConfigValues()
  ])

  return buildSourceConfigData(cacheData, extraValues)
}

async function refreshSourceConfigData() {
  await refreshSourceSeoSettingsCache()
  return getSourceConfigData()
}

/**
 * 刷新多语言站运行时依赖的源站配置和派生缓存。
 * 手动刷新和源站自动回调必须共用该流程，避免源站配置、页面缓存、RSS、Sitemap 状态不一致。
 * @returns {Promise<Object>} 最新源站配置数据
 */
async function refreshSourceConfigRuntimeData() {
  const data = await refreshSourceConfigData()
  await cacheDataUtils.refreshAllLanguageCache()
  await rssUtils.reflushRSS()
  await sitemapUtils.reflushSitemap()
  return data
}

/**
 * 读取并校验源站域名配置。
 * 该域名用于回调源站现有 admin JWT 校验接口。
 * @returns {string} 去除末尾斜杠后的源站域名
 * @throws {ApiError} SOURCE_DOMAIN 缺失、格式错误或协议非法时抛出
 */
function getSourceDomain() {
  const sourceDomain = String(process.env[SOURCE_DOMAIN_ENV_NAME] || '')
    .trim()
    .replace(/\/+$/, '')

  if (!sourceDomain) {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      'SOURCE_DOMAIN 未配置，无法校验源站认证',
      SOURCE_DOMAIN_ENV_NAME,
      500
    )
  }

  let parsedUrl = null
  try {
    parsedUrl = new URL(sourceDomain)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      'SOURCE_DOMAIN 配置无效，无法校验源站认证',
      SOURCE_DOMAIN_ENV_NAME,
      500
    )
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      'SOURCE_DOMAIN 协议无效，无法校验源站认证',
      SOURCE_DOMAIN_ENV_NAME,
      500
    )
  }

  return sourceDomain
}

/**
 * 构建源站 admin API URL。
 * @param {string} pathname - 源站 admin API 路径
 * @returns {URL} 完整源站接口 URL
 */
function buildSourceAdminApiUrl(pathname) {
  const sourceDomain = getSourceDomain()
  const normalizedPathname = String(pathname || '').replace(/^\/+/, '')
  return new URL(`${sourceDomain}/${normalizedPathname}`)
}

/**
 * 创建带清理方法的请求中止控制器。
 * @param {number} timeout - 超时时间，单位毫秒
 * @returns {{ signal: AbortSignal|undefined, cleanup: Function }} 请求中止控制器信息
 */
function createRequestAbortController(timeout) {
  if (typeof AbortController !== 'function') {
    return {
      signal: undefined,
      cleanup() {}
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, timeout)

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
    }
  }
}

/**
 * 将错误对象转换为日志可读文本。
 * @param {unknown} error - 待转换的错误对象
 * @returns {string} 错误文本
 */
function getErrorText(error) {
  if (global.logErrorToText) {
    return global.logErrorToText(error)
  }

  if (error && error.message) {
    return error.message
  }

  return String(error)
}

/**
 * 校验源站自动刷新请求携带的源站后台 Authorization。
 * 源站自动刷新传入的是源站后台 JWT，不能用多语言站自己的后台 JWT 直接校验。
 * @param {string} authorization - 源站转发的 Authorization 请求头
 * @returns {Promise<void>} 校验通过时不返回数据
 * @throws {ApiError} 缺少认证、认证失败、源站认证接口不可用或超时时抛出
 */
async function validateSourceAdminAuthorization(authorization) {
  const authorizationValue = String(authorization || '').trim()
  if (!authorizationValue) {
    throw new ApiError(
      ERROR_CODES.AUTH_REQUIRED,
      undefined,
      'Authorization',
      401
    )
  }

  if (typeof fetch !== 'function') {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      '当前 Node.js 运行时不支持 fetch，无法校验源站认证',
      'fetch',
      500
    )
  }

  const url = buildSourceAdminApiUrl(SOURCE_ADMIN_TOKEN_CHECK_PATH)
  const abortController = createRequestAbortController(
    SOURCE_ADMIN_AUTH_TIMEOUT
  )
  let response = null

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: authorizationValue
      },
      signal: abortController.signal
    })
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError(
        ERROR_CODES.INTERNAL_ERROR,
        '源站认证接口请求超时',
        'sourceAuth',
        504
      )
    }

    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      `源站认证接口请求失败：${getErrorText(error)}`,
      'sourceAuth',
      502
    )
  } finally {
    abortController.cleanup()
  }

  if (response.ok) {
    return
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      ERROR_CODES.AUTH_FAILED,
      undefined,
      'Authorization',
      response.status
    )
  }

  throw new ApiError(
    ERROR_CODES.INTERNAL_ERROR,
    `源站认证接口返回异常：${response.status}`,
    'sourceAuth',
    502
  )
}

module.exports = {
  getSourceConfigData,
  refreshSourceConfigData,
  refreshSourceConfigRuntimeData,
  validateSourceAdminAuthorization
}
