const { request } = require('undici')
const env = require('../config/env')
const logger = require('log4js').getLogger('import')
const {
  IMPORTABLE_POST_TYPES,
  POST_TYPE_PAGE
} = require('@wikimoe-ml/common/constants')
const { badRequest, notFound, serverError } = require('../utils/errors')

const DEFAULT_TIMEOUT_MS = 20000

function trimTrailingSlash(str) {
  if (!str) return ''
  return String(str).replace(/\/+$/, '')
}

function buildDetailUrl(id, withTypeWhitelist) {
  const base = trimTrailingSlash(env.SOURCE_BLOG_API_BASE_URL)
  const params = new URLSearchParams()
  params.set('id', id)
  if (withTypeWhitelist) {
    IMPORTABLE_POST_TYPES.forEach(t => {
      params.append('type[]', String(t))
    })
  }
  return base + '/blog/post/detail?' + params.toString()
}

async function doRequest(url) {
  const res = await request(url, {
    method: 'GET',
    headersTimeout: DEFAULT_TIMEOUT_MS,
    bodyTimeout: DEFAULT_TIMEOUT_MS,
    headers: {
      accept: 'application/json'
    }
  })
  let bodyText = ''
  try {
    bodyText = await res.body.text()
  } catch (err) {
    throw serverError('读取原站响应失败: ' + err.message)
  }
  let json = null
  if (bodyText) {
    try {
      json = JSON.parse(bodyText)
    } catch (err) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        throw serverError('原站响应不是合法 JSON')
      }
    }
  }
  return { statusCode: res.statusCode, body: json, rawText: bodyText }
}

/**
 * 按原站逻辑获取文章详情：
 *  1. 先以 type=[1,2] 精确查询（过滤掉页面与非法类型）
 *  2. 若返回 404，再发起一次不带 type 的回查，用以判断是否因类型不符被过滤
 *     - 回查仍 404 → 视作不存在
 *     - 回查命中且 type == 3 → 明确拒绝（页面类型禁止导入）
 *     - 回查命中其它类型 → 视作不支持的类型
 * 返回的 data 保持原站 populate 后的结构。
 *
 * @param {string} sourceIdentifier 原站文章 _id 或 alias
 * @returns {Promise<{ post: object, resolvedId: string }>}
 */
async function fetchPostDetail(sourceIdentifier) {
  if (!sourceIdentifier || typeof sourceIdentifier !== 'string') {
    throw badRequest('sourceIdentifier 不能为空')
  }
  const identifier = sourceIdentifier.trim()
  if (!identifier) {
    throw badRequest('sourceIdentifier 不能为空')
  }

  const firstUrl = buildDetailUrl(identifier, true)
  logger.info('[sourceBlogClient] GET', firstUrl)
  const first = await doRequest(firstUrl)

  if (first.statusCode >= 200 && first.statusCode < 300) {
    const post = extractPostFromResponse(first.body)
    if (!post) {
      throw serverError('原站响应未包含文章数据')
    }
    validateImportableType(post)
    return { post, resolvedId: extractResolvedId(post, identifier) }
  }

  if (first.statusCode === 404) {
    // 可能是类型被白名单过滤。发起无 type 回查以便给出明确错误。
    const fallbackUrl = buildDetailUrl(identifier, false)
    logger.warn('[sourceBlogClient] 404 on typed query, fallback', fallbackUrl)
    const second = await doRequest(fallbackUrl)
    if (second.statusCode === 404) {
      throw notFound('原站未找到对应文章')
    }
    if (second.statusCode >= 200 && second.statusCode < 300) {
      const post = extractPostFromResponse(second.body)
      if (!post) {
        throw notFound('原站未找到对应文章')
      }
      validateImportableType(post)
      // 到这里说明类型其实在白名单里但首查异常，保持与首查一致地返回
      return { post, resolvedId: extractResolvedId(post, identifier) }
    }
    throw serverError('原站回查失败，状态码: ' + second.statusCode)
  }

  throw serverError('原站请求失败，状态码: ' + first.statusCode)
}

function extractPostFromResponse(body) {
  if (!body) return null
  // 原站 getPostDetail 直接 res.json({ data: ... })
  if (body.data && typeof body.data === 'object') {
    // 可能直接是 post，也可能是 { post, randomSimilarPostList }
    if (body.data.post && typeof body.data.post === 'object') {
      return body.data.post
    }
    return body.data
  }
  return null
}

function extractResolvedId(post, fallback) {
  if (post && post._id) return String(post._id)
  return fallback
}

function validateImportableType(post) {
  const type = Number(post.type)
  if (type === POST_TYPE_PAGE) {
    throw badRequest('禁止导入页面类型（type=3）文章')
  }
  if (!IMPORTABLE_POST_TYPES.includes(type)) {
    throw badRequest('不支持的文章类型: ' + post.type)
  }
}

module.exports = {
  fetchPostDetail
}
