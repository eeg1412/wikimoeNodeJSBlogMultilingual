/**
 * 统一错误响应格式
 */
export function errorResponse(res, statusCode, message, errors = null) {
  const body = { message }
  if (errors) body.errors = errors
  return res.status(statusCode).json(body)
}

/**
 * 全局错误处理中间件（挂在 Express app 末尾）
 */
export function globalErrorHandler(err, req, res, next) {
  console.error('[Error]', err)
  if (res.headersSent) {
    return next(err)
  }
  const status = err.status || err.statusCode || 500
  const message = err.message || '服务器内部错误'
  return res.status(status).json({ message })
}

/**
 * 服务未就绪中间件（数据库连接中时返回 503）
 */
export function requireReady(req, res, next) {
  if (!global.$isReady) {
    return res.status(503).json({ message: '服务正在初始化，请稍后再试' })
  }
  next()
}
