const path = require('path')
const fs = require('fs')
const express = require('express')
const helmet = require('helmet')

const { ADMIN_BASE_PATH } = require('../common/constants/app')
const createAdminRouter = require('./routes/admin')
const createBlogRouter = require('./routes/blog')
const { getDefaultLanguageCode } = require('./services/siteSettingsService')

function createApp(options) {
  const finalOptions = options || {}
  const bootstrapEnv = finalOptions.bootstrapEnv || {}
  const app = express()
  const blogPublicDir = path.resolve(__dirname, '..', 'blog', 'public')
  const adminBuildDir = path.resolve(__dirname, 'front', 'admin')
  const adminIndexPath = path.join(adminBuildDir, 'index.html')

  app.disable('x-powered-by')
  app.set('trust proxy', true)
  app.set('view engine', 'ejs')
  app.set('views', path.resolve(__dirname, '..', 'blog', 'views'))

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))

  app.use('/assets', express.static(blogPublicDir))

  if (bootstrapEnv.LOCAL_ATTACHMENT_STORAGE_DIR) {
    const localAttachmentDir = path.resolve(
      __dirname,
      '..',
      bootstrapEnv.LOCAL_ATTACHMENT_STORAGE_DIR
    )
    app.use('/localized', express.static(localAttachmentDir))
  }

  app.use('/api/admin', createAdminRouter())

  app.get('/healthz', function (req, res) {
    res.json({ status: 'ok' })
  })

  app.get('/', async function (req, res, next) {
    try {
      const defaultLanguageCode = await getDefaultLanguageCode()
      res.redirect(302, `/${defaultLanguageCode}`)
    } catch (error) {
      next(error)
    }
  })

  app.use(ADMIN_BASE_PATH, express.static(adminBuildDir))

  app.get(`${ADMIN_BASE_PATH}`, function (req, res) {
    if (!fs.existsSync(adminIndexPath)) {
      res.status(503).json({
        message: 'Admin frontend has not been built yet'
      })
      return
    }

    res.sendFile(adminIndexPath)
  })

  app.get(`${ADMIN_BASE_PATH}/*`, function (req, res) {
    if (!fs.existsSync(adminIndexPath)) {
      res.status(503).json({
        message: 'Admin frontend has not been built yet'
      })
      return
    }

    res.sendFile(adminIndexPath)
  })

  app.use(createBlogRouter())

  app.use(function (req, res) {
    res.status(404).json({ message: 'Not found' })
  })

  app.use(function (error, req, res, next) {
    const errorMessage =
      error && error.message ? error.message : 'Internal server error'
    const statusCode = error && error.statusCode ? error.statusCode : 500
    console.error(error && error.stack ? error.stack : error)

    if (req.path.startsWith('/api/')) {
      res.status(statusCode).json({
        errors: [
          {
            message: errorMessage
          }
        ]
      })
      return
    }

    res.status(statusCode).json({ message: errorMessage })
  })

  return app
}

module.exports = createApp
