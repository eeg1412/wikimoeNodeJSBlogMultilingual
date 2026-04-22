import { SOURCE_ASSET_PATH_PREFIXES } from '../../common/constants/index.js'
import { creatSha256Str } from '../utils/utils.js'

/**
 * 判断一个 URL 是否属于原站内部资源
 * @param {string} url
 * @param {string} sourceBlogPublicOrigin - 原站域名（可包含协议，如 https://example.com）
 */
export function isSourceBlogInternalUrl(url, sourceBlogPublicOrigin) {
  if (!url || !sourceBlogPublicOrigin) return false
  try {
    const normalized = sourceBlogPublicOrigin.replace(/\/$/, '')
    return url.startsWith(normalized + '/')
  } catch {
    return false
  }
}

/**
 * 判断一个相对路径是否以原站资源路径前缀开头
 * @param {string} path
 */
export function isSourceAssetRelativePath(path) {
  if (!path) return false
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
}

/**
 * 把原站内部绝对 URL 转换为相对路径
 * 若 url 不属于原站域名，则原样返回
 * @param {string} url
 * @param {string} sourceBlogPublicOrigin
 * @returns {string} 相对路径或原 url
 */
export function normalizeSourceUrl(url, sourceBlogPublicOrigin) {
  if (!url) return url
  // 已经是相对路径
  if (url.startsWith('/')) return url
  // 无协议 URL (//example.com/...)
  if (url.startsWith('//')) {
    const withProto = 'https:' + url
    return normalizeSourceUrl(withProto, sourceBlogPublicOrigin)
  }
  if (!sourceBlogPublicOrigin) return url
  try {
    const origin = sourceBlogPublicOrigin.replace(/\/$/, '')
    if (url.startsWith(origin + '/')) {
      return url.slice(origin.length)
    }
  } catch {
    // ignore
  }
  return url
}

/**
 * 递归遍历一个 JSON 对象/数组，把所有命中原站域名的字符串字段转为相对路径
 * @param {*} data
 * @param {string} sourceBlogPublicOrigin
 * @returns {*}
 */
export function normalizeObjectUrls(data, sourceBlogPublicOrigin) {
  if (!data) return data
  if (typeof data === 'string') {
    return normalizeSourceUrl(data, sourceBlogPublicOrigin)
  }
  if (Array.isArray(data)) {
    return data.map(item => normalizeObjectUrls(item, sourceBlogPublicOrigin))
  }
  if (typeof data === 'object') {
    const result = {}
    for (const [k, v] of Object.entries(data)) {
      result[k] = normalizeObjectUrls(v, sourceBlogPublicOrigin)
    }
    return result
  }
  return data
}

/**
 * 计算相对路径的哈希，用于 sourcePathHash 去重
 * @param {string} relativePath
 */
export function computeSourcePathHash(relativePath) {
  if (!relativePath) return ''
  return creatSha256Str(relativePath)
}

/**
 * 计算外部 URL 的哈希，用于 externalUrlHash 去重
 * @param {string} url
 */
export function computeExternalUrlHash(url) {
  if (!url) return ''
  return creatSha256Str(url)
}
