import { getSystemConfig } from '../config/globalConfig.js'

/**
 * 原站博客 API 客户端
 * 所有请求都通过 system.sourceBlogApiBaseUrl 配置发出
 */

/**
 * 检查原站接口是否已配置
 * @returns {{ ok: boolean, message: string }}
 */
function checkConfig() {
  const config = getSystemConfig()
  if (!config.sourceBlogApiBaseUrl) {
    return {
      ok: false,
      message: '原站接口地址 (system.sourceBlogApiBaseUrl) 未配置'
    }
  }
  return { ok: true, message: '' }
}

/**
 * 调用原站文章详情接口
 * @param {string} identifier - 文章 ID 或别名
 * @param {number[]} [typeFilter] - 类型过滤，如 [1,2]
 * @returns {Promise<{ post: object|null, status: number, error: string|null }>}
 */
export async function fetchSourcePost(identifier, typeFilter = null) {
  const check = checkConfig()
  if (!check.ok) {
    throw new Error(check.message)
  }

  const config = getSystemConfig()
  const baseUrl = config.sourceBlogApiBaseUrl.replace(/\/$/, '')
  const timeoutMs = config.sourceBlogRequestTimeoutMs || 10000

  const params = new URLSearchParams({ id: identifier })
  if (typeFilter && typeFilter.length > 0) {
    typeFilter.forEach(t => params.append('type[]', t))
  }

  const url = `${baseUrl}/post/detail?${params.toString()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    clearTimeout(timer)

    if (response.status === 404) {
      return { post: null, status: 404, error: null }
    }

    if (!response.ok) {
      return {
        post: null,
        status: response.status,
        error: `原站返回 HTTP ${response.status}`
      }
    }

    const json = await response.json()
    const post = json?.data || null
    return { post, status: 200, error: null }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('原站接口请求超时')
    }
    throw err
  }
}

/**
 * 按计划 2.2 节规则确认文章类型
 * 1. 先带 type=[1,2] 请求
 * 2. 404 则不带 type 再次请求
 * 3. 若第二次返回 type=3 则报错"页面不支持导入"
 * 4. 若第二次仍 404 则报错"文章不存在"
 *
 * @param {string} identifier
 * @returns {Promise<object>} 文章数据
 * @throws 包含明确错误信息
 */
export async function resolveSourcePost(identifier) {
  // 第一步：限定类型查询
  const { post: postTyped, status: s1 } = await fetchSourcePost(
    identifier,
    [1, 2]
  )
  if (postTyped) {
    return postTyped
  }

  // 第二步：不限类型查询
  const { post: postAny, status: s2 } = await fetchSourcePost(identifier, null)
  if (!postAny) {
    throw new Error('文章不存在')
  }
  if (postAny.type === 3) {
    throw new Error('页面类型文章不支持导入')
  }
  throw new Error(`该文章类型 (type=${postAny.type}) 不在允许导入范围内`)
}
