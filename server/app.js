const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const historyApiFallback = require('connect-history-api-fallback')

const env = require('./config/env')
const log4js = require('./utils/logger')
const accessLogger = log4js.getLogger('access')
const logger = log4js.getLogger()

const adminRouter = require('./routes/admin')
const blogRouter = require('./routes/blog')
const { AppError } = require('./utils/errors')

const app = express()

app.use(log4js.connectLogger(accessLogger, { level: 'auto' }))
app.use(express.json({ limit: env.JSON_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.URLENCODED_LIMIT }))
app.use(cookieParser())

// === 翻译站附件静态托管 ===
const localAttachmentRoot = path.resolve(
  __dirname,
  env.LOCAL_ATTACHMENT_STORAGE_DIR
)
app.use(
  env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH,
  express.static(localAttachmentRoot, { maxAge: '365d', fallthrough: true })
)

// === API ===
app.use('/api/admin', adminRouter)
app.use('/api/blog', blogRouter)

// === 后台管理端静态托管 /multilingual-admin ===
const adminDist = path.resolve(__dirname, '../admin/dist')
app.use(
  '/multilingual-admin',
  historyApiFallback({
    index: '/index.html',
    rewrites: [
      {
        from: /^\/multilingual-admin\/?.*$/,
        to: '/multilingual-admin/index.html'
      }
    ]
  })
)
app.use('/multilingual-admin', express.static(adminDist, { maxAge: '1d' }))

// 404
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      errors: [{ code: 'NOT_FOUND', message: '接口不存在' }]
    })
  }
  next()
})

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.isJoi) {
    return res.status(400).json({
      errors: err.details.map(d => ({
        code: 'VALIDATION_ERROR',
        path: (d.path || []).join('.'),
        message: d.message
      }))
    })
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      errors: [{ code: err.code, message: err.message, details: err.details }]
    })
  }
  logger.error('未处理错误', err && err.stack ? err.stack : err)
  res.status(500).json({
    errors: [
      {
        code: 'SERVER_ERROR',
        message: err && err.message ? err.message : '服务器错误'
      }
    ]
  })
})

module.exports = app
