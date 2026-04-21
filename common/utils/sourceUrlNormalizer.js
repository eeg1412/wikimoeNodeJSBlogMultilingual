const {
  SOURCE_RELATIVE_PATH_PREFIXES
} = require('../constants/sourcePathWhitelist')

/**
 * 判断 pathname 是否是原站内部资源路径（白名单前缀）
 * @param {string} pathname 已解析的纯 path，例如 /upload/2024/xx.jpg
 */
function isSourceRelativePath(pathname) {
  if (!pathname || typeof pathname !== 'string') {
    return false
  }
  for (let i = 0; i < SOURCE_RELATIVE_PATH_PREFIXES.length; i++) {
    const prefix = SOURCE_RELATIVE_PATH_PREFIXES[i]
    if (pathname === prefix || pathname.indexOf(prefix + '/') === 0) {
      return true
    }
  }
  return false
}

/**
 * 从完整 URL 或相对地址中抽取 path（含 query 与 hash），忽略域名。
 * 用于把原站域名下的完整 URL 归一化为相对路径。
 * @param {string} urlLike
 * @returns {string|null}
 */
function extractPathWithQuery(urlLike) {
  if (!urlLike || typeof urlLike !== 'string') return null
  const trimmed = urlLike.trim()
  if (!trimmed) return null
  // 协议相对 //host/path
  if (trimmed.indexOf('//') === 0) {
    try {
      const u = new URL('http:' + trimmed)
      return u.pathname + u.search + u.hash
    } catch (err) {
      return null
    }
  }
  // 绝对路径 /path
  if (trimmed.charAt(0) === '/') {
    return trimmed
  }
  // 完整 URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      return u.pathname + u.search + u.hash
    } catch (err) {
      return null
    }
  }
  // 其它（例如 mailto:, tel:, 或相对相对路径）视为不是原站资源
  return null
}

/**
 * 判断给定 URL 是否属于原站（通过与 SOURCE_BLOG_PUBLIC_ORIGIN 或 SOURCE_BLOG_API_BASE_URL 对比）
 * @param {string} urlLike
 * @param {{ publicOrigin?: string, apiBaseUrl?: string }} options
 */
function belongsToSourceSite(urlLike, options) {
  if (!urlLike || typeof urlLike !== 'string') return false
  if (!/^https?:\/\//i.test(urlLike) && urlLike.indexOf('//') !== 0) {
    return false
  }
  const opts = options || {}
  const candidates = []
  if (opts.publicOrigin) candidates.push(opts.publicOrigin)
  if (opts.apiBaseUrl) candidates.push(opts.apiBaseUrl)
  try {
    const target = new URL(
      urlLike.indexOf('//') === 0 ? 'http:' + urlLike : urlLike
    )
    for (let i = 0; i < candidates.length; i++) {
      try {
        const c = new URL(candidates[i])
        if (c.host === target.host) {
          return true
        }
      } catch (err) {
        // 忽略非法配置
      }
    }
  } catch (err) {
    return false
  }
  return false
}

/**
 * 把可能指向原站的 URL 归一化为相对路径。
 *  - 属于原站的完整 URL，剥离域名，保留 path+query+hash
 *  - 本来就是 / 开头的相对路径，原样保留
 *  - 第三方外链（http(s)://其它域名），返回 { relative: null, external: 原 URL }
 *  - 其它（mailto 等），返回 { relative: null, external: null, original: 原值 }
 *
 * @param {string} urlLike
 * @param {{ publicOrigin?: string, apiBaseUrl?: string }} options
 * @returns {{ relative: string|null, external: string|null, original: string }}
 */
function normalizeSourceUrl(urlLike, options) {
  const original = urlLike == null ? '' : String(urlLike)
  if (!original) {
    return { relative: null, external: null, original: original }
  }
  const trimmed = original.trim()

  // / 开头的相对路径
  if (trimmed.charAt(0) === '/' && trimmed.indexOf('//') !== 0) {
    return { relative: trimmed, external: null, original: original }
  }

  // 属于原站的完整 URL
  if (belongsToSourceSite(trimmed, options)) {
    const path = extractPathWithQuery(trimmed)
    if (path) {
      return { relative: path, external: null, original: original }
    }
  }

  // 第三方外链
  if (/^https?:\/\//i.test(trimmed) || trimmed.indexOf('//') === 0) {
    return { relative: null, external: trimmed, original: original }
  }

  return { relative: null, external: null, original: original }
}

module.exports = {
  isSourceRelativePath,
  extractPathWithQuery,
  belongsToSourceSite,
  normalizeSourceUrl
}
