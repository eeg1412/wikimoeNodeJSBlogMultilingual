class AppError extends Error {
  constructor(message, statusCode, code, details) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode || 400
    this.code = code || 'APP_ERROR'
    this.details = details || null
  }
}

function badRequest(message, details) {
  return new AppError(message, 400, 'BAD_REQUEST', details)
}
function unauthorized(message) {
  return new AppError(message || '未授权', 401, 'UNAUTHORIZED')
}
function forbidden(message) {
  return new AppError(message || '无权限', 403, 'FORBIDDEN')
}
function notFound(message) {
  return new AppError(message || '资源不存在', 404, 'NOT_FOUND')
}
function conflict(message, details) {
  return new AppError(message, 409, 'CONFLICT', details)
}
function serverError(message, details) {
  return new AppError(message || '服务器错误', 500, 'SERVER_ERROR', details)
}

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError
}
