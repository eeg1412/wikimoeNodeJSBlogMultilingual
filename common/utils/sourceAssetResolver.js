const { isSourceRelativePath } = require('./sourceUrlNormalizer')

/**
 * 把"相对路径资源"在运行时拼接为最终访问地址。
 * 规则：
 *   - 路径以白名单前缀开头（/upload /content /ucloudImg /up_works /web_demo）
 *     → 用 sourceBlogPublicOrigin 拼接
 *   - 路径以 localizedPublicBasePath 开头 → 用多语言站自身 origin（默认保持相对即可）
 *   - 其它 / 开头路径 → 原样保留
 *   - http(s):// 开头 → 原样保留
 *
 * @param {string} relativeOrAbsolute
 * @param {{
 *   sourceBlogPublicOrigin: string,
 *   localizedPublicBasePath?: string,
 *   localSiteOrigin?: string
 * }} options
 */
function resolveAssetUrl(relativeOrAbsolute, options) {
  if (!relativeOrAbsolute || typeof relativeOrAbsolute !== 'string') {
    return relativeOrAbsolute
  }
  const opts = options || {}
  const value = relativeOrAbsolute

  if (/^https?:\/\//i.test(value) || value.indexOf('//') === 0) {
    return value
  }
  if (value.charAt(0) !== '/') {
    return value
  }

  // 翻译站本地附件
  const localPrefix = opts.localizedPublicBasePath
  if (
    localPrefix &&
    (value === localPrefix || value.indexOf(localPrefix + '/') === 0)
  ) {
    if (opts.localSiteOrigin) {
      return trimTrailingSlash(opts.localSiteOrigin) + value
    }
    return value
  }

  // 原站内部资源白名单
  if (isSourceRelativePath(value.split('?')[0].split('#')[0])) {
    const origin = trimTrailingSlash(opts.sourceBlogPublicOrigin || '')
    if (!origin) {
      return value
    }
    return origin + value
  }

  // 其它 / 开头路径 → 原样保留
  return value
}

function trimTrailingSlash(str) {
  if (!str) return ''
  return str.replace(/\/+$/, '')
}

module.exports = {
  resolveAssetUrl
}
