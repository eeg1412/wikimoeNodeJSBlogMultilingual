const log4js = require('log4js')
const {
  ERROR_CODES,
  sendError
} = require('../../utils/multilingualAdminResponse')

const adminApiLog = log4js.getLogger('adminApi')

module.exports = function handleApiError(res, error, logMessage) {
  if (error && error.name === 'ApiError') {
    return sendError(
      res,
      error.status,
      error.code,
      error.message,
      error.field,
      error.extra
    )
  }

  let errorText = String(error)
  if (global.logErrorToText) {
    errorText = global.logErrorToText(error)
  } else if (error && error.message) {
    errorText = error.message
  }

  adminApiLog.error(`${logMessage}: ${errorText}`)
  return sendError(res, 500, ERROR_CODES.INTERNAL_ERROR)
}
