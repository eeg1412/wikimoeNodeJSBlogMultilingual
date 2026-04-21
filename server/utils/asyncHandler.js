/**
 * 统一异步错误捕获：用于路由 handler。
 * 用法：router.post('/x', asyncHandler(async (req, res) => { ... }))
 */
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
