const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const cookieParser = require('cookie-parser')
const env = require('./config/env')
const log4js = require('./config/log4js-config')
const HttpError = require('./utils/httpError')
const adminRouter = require('./routes/admin')
const blogRouter = require('./routes/blog')
const optionsService = require('./services/optionsService')

const app = express()

app.use(log4js.connectLogger(log4js.getLogger('access'), { level: 'auto' }))
app.use(express.json({ limit: env.JSON_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.URLENCODED_LIMIT }))
app.use(cookieParser())

fs.ensureDirSync(env.LOCAL_ATTACHMENT_STORAGE_ABS_DIR)
app.use(
  env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH,
  express.static(env.LOCAL_ATTACHMENT_STORAGE_ABS_DIR, { maxAge: '365d' })
)

app.get('/health', (req, res) => {
  res.json({ data: { ready: Boolean(global.$isReady) } })
})

app.get('/robots.txt', async (req, res) => {
  const optionsMap = await optionsService.getOptionMap()
  res.type('text/plain').send(optionsMap.siteRobotsTxt || '')
})

app.get('/ads.txt', async (req, res) => {
  const optionsMap = await optionsService.getOptionMap()
  res.type('text/plain').send(optionsMap.AdAdsTxt || '')
})

app.use('/api/admin', adminRouter)
app.use('/api/blog', blogRouter)

if (fs.pathExistsSync(env.ADMIN_BUILD_DIR)) {
  app.use('/multilingual-admin', express.static(env.ADMIN_BUILD_DIR))
  app.get('/multilingual-admin/*', (req, res) => {
    res.sendFile(path.join(env.ADMIN_BUILD_DIR, 'index.html'))
  })
}

app.use((req, res, next) => {
  next(new HttpError(404, 'Not Found'))
})

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    res.status(400).json({ errors: [{ message: '传入非法 JSON 格式' }] })
    return
  }

  const status = error.status || 500
  const message = error.message || '服务器内部错误'
  if (status >= 500) {
    log4js.getLogger('default').error(error)
  }

  res.status(status).json({
    errors: [
      {
        details: error.details || null,
        message
      }
    ]
  })
})

module.exports = app