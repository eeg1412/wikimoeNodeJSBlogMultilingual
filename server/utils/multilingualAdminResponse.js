const log4js = require('log4js')

const ERROR_CODES = {
  LANGUAGE_CODE_UNSUPPORTED: 'LANGUAGE_CODE_UNSUPPORTED',
  SOURCE_POST_ID_OR_ALIAS_REQUIRED: 'SOURCE_POST_ID_OR_ALIAS_REQUIRED',
  SOURCE_ID_INVALID: 'SOURCE_ID_INVALID',
  SOURCE_POST_NOT_FOUND: 'SOURCE_POST_NOT_FOUND',
  SOURCE_EXISTS: 'SOURCE_EXISTS',
  SOURCE_SNAPSHOT_NOT_FOUND: 'SOURCE_SNAPSHOT_NOT_FOUND',
  TRANSLATION_EXISTS: 'TRANSLATION_EXISTS',
  ALIAS_CONFLICT_IN_LANGUAGE: 'ALIAS_CONFLICT_IN_LANGUAGE',
  RELATION_LANGUAGE_MISMATCH: 'RELATION_LANGUAGE_MISMATCH',
  MEDIA_MODE_INVALID: 'MEDIA_MODE_INVALID',
  SETTINGS_FIELD_INVALID: 'SETTINGS_FIELD_INVALID',
  SETTINGS_VALUES_INVALID: 'SETTINGS_VALUES_INVALID',
  AI_SETTINGS_INVALID: 'AI_SETTINGS_INVALID',
  AI_PROVIDER_CONFIG_REQUIRED: 'AI_PROVIDER_CONFIG_REQUIRED',
  AI_TRANSLATION_FAILED: 'AI_TRANSLATION_FAILED',
  CONTENT_ID_INVALID: 'CONTENT_ID_INVALID',
  CONTENT_FIELD_INVALID: 'CONTENT_FIELD_INVALID',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  CONFIRM_TEXT_REQUIRED: 'CONFIRM_TEXT_REQUIRED',
  LOCAL_FILE_DELETE_FAILED: 'LOCAL_FILE_DELETE_FAILED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_TOO_MANY_ATTEMPTS: 'AUTH_TOO_MANY_ATTEMPTS',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BACKUP_IN_PROGRESS: 'BACKUP_IN_PROGRESS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
}

const ERROR_MESSAGES = {
  [ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED]: '不支持的语言 code',
  [ERROR_CODES.SOURCE_POST_ID_OR_ALIAS_REQUIRED]:
    'sourceId 和 alias 必须提供一个',
  [ERROR_CODES.SOURCE_ID_INVALID]: '源 ID 格式错误',
  [ERROR_CODES.SOURCE_POST_NOT_FOUND]: '源文章不存在',
  [ERROR_CODES.SOURCE_EXISTS]: '源文章快照已存在',
  [ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND]: '源文章快照不存在',
  [ERROR_CODES.TRANSLATION_EXISTS]: '该语言翻译文章已存在',
  [ERROR_CODES.ALIAS_CONFLICT_IN_LANGUAGE]: '当前语言下 alias 已被占用',
  [ERROR_CODES.RELATION_LANGUAGE_MISMATCH]: '关联内容语言不匹配',
  [ERROR_CODES.MEDIA_MODE_INVALID]: '媒体模式不允许执行当前操作',
  [ERROR_CODES.SETTINGS_FIELD_INVALID]: '多语言配置字段不允许写入',
  [ERROR_CODES.SETTINGS_VALUES_INVALID]: '多语言配置 values 必须是对象',
  [ERROR_CODES.AI_SETTINGS_INVALID]: 'AI 设置校验失败',
  [ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED]: 'AI 服务配置不完整',
  [ERROR_CODES.AI_TRANSLATION_FAILED]: 'AI 翻译失败',
  [ERROR_CODES.CONTENT_ID_INVALID]: '内容 ID 格式错误',
  [ERROR_CODES.CONTENT_FIELD_INVALID]: '内容字段校验失败',
  [ERROR_CODES.CONTENT_NOT_FOUND]: '内容不存在',
  [ERROR_CODES.CONFIRM_TEXT_REQUIRED]: '请确认本地文件删除操作',
  [ERROR_CODES.LOCAL_FILE_DELETE_FAILED]: '本地文件删除失败',
  [ERROR_CODES.AUTH_REQUIRED]: '认证失败',
  [ERROR_CODES.AUTH_FAILED]: '认证失败',
  [ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS]: '登录失败次数过多，请稍后再试',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '服务暂不可用',
  [ERROR_CODES.BACKUP_IN_PROGRESS]: '系统正在进行备份或还原操作，请稍后再试',
  [ERROR_CODES.INTERNAL_ERROR]: '请求处理失败'
}

class ApiError extends Error {
  constructor(code, message, field, status, extra = {}) {
    super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR)
    this.name = 'ApiError'
    this.code = code
    this.field = field || null
    this.status = status || 400
    this.extra = extra
  }
}

function buildErrorItem(code, message, field) {
  return {
    code,
    message: message || ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR,
    field: field || null
  }
}

function sendError(res, status, code, message, field, extra = {}) {
  return res.status(status).json({
    errorList: [buildErrorItem(code, message, field)],
    ...extra
  })
}

function handleApiError(
  res,
  error,
  logMessage = 'multilingual admin api fail'
) {
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

  const adminApiLog = log4js.getLogger('adminApi')
  adminApiLog.error(`${logMessage}: ${errorText}`)
  return sendError(res, 500, ERROR_CODES.INTERNAL_ERROR)
}

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  ApiError,
  sendError,
  handleApiError
}
