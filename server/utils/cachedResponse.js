// Express 中间件：在 handler 调用 res.json 前拦截并缓存响应体。
// 不修改现有 handler 代码。

const cache = require('./cache')

/**
 * @param {function(req):{scope:string,key:string,ttlMs?:number}|null} resolver
 *   根据请求返回 scope/key/ttl；返回 null 表示不缓存。
 */
function cachedJsonMiddleware(resolver) {
  return function (req, res, next) {
    const desc = resolver(req)
    if (!desc) return next()
    const hit = cache.get(desc.scope, desc.key)
    if (hit !== undefined) {
      return res.json(hit)
    }
    const originalJson = res.json.bind(res)
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(desc.scope, desc.key, body, desc.ttlMs)
      }
      return originalJson(body)
    }
    next()
  }
}

/**
 * 类似 cachedJsonMiddleware，但用于 res.send 返回的文本类型响应。
 */
function cachedTextMiddleware(resolver) {
  return function (req, res, next) {
    const desc = resolver(req)
    if (!desc) return next()
    const hit = cache.get(desc.scope, desc.key)
    if (hit !== undefined) {
      if (desc.contentType) res.type(desc.contentType)
      return res.send(hit)
    }
    const originalSend = res.send.bind(res)
    res.send = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(desc.scope, desc.key, body, desc.ttlMs)
      }
      return originalSend(body)
    }
    next()
  }
}

module.exports = {
  cachedJsonMiddleware,
  cachedTextMiddleware
}
