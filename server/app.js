global.$cacheData = {}
global.$isReady = false
global.$isBackuping = false
global.$secret = {}
var express = require('express')
const utils = require('./utils/utils')
const JWTSecretAdmin = utils.ensureJWTSecretAdmin()
global.$secret.JWTSecretAdmin = JWTSecretAdmin
const JWTSecretBlog = utils.ensureJWTSecretBlog()
global.$secret.JWTSecretBlog = JWTSecretBlog
const log4js = require('log4js')
var path = require('path')
var cookieParser = require('cookie-parser')
// var logger = require('morgan');
const $mongodDB = require('./mongodb')
const {
  ERROR_CODES,
  sendError,
  handleApiError
} = require('./utils/multilingualAdminResponse')
global.$mongodDB = $mongodDB
const translationJobWorker = require('./api/multilingual-admin/services/translationJobWorker')
translationJobWorker.startTranslationJobWorker()
var history = require('connect-history-api-fallback')

var multilingualAdminRouter = require('./routes/multilingualAdmin')
const multilingualBlogRouter = require('./routes/blog')
const multilingualRssRouter = require('./routes/multilingualRss')
const sitemapToolUtils = require('./utils/sitemap')

var app = express()

app.use(log4js.connectLogger(log4js.getLogger('access'), { level: 'auto' }))

// app.use(logger('dev'));
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }))
app.use(
  express.urlencoded({
    extended: false,
    limit: process.env.URLENCODED_LIMIT || '10mb'
  })
)
app.use(cookieParser())

const upLoadFolder = path.join(__dirname, 'public/upload')
app.use(
  '/multilingual-assets/upload',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(upLoadFolder, { maxAge: '365d' })
)

const contentFolder = path.join(__dirname, 'public/content')
app.use(
  '/multilingual-assets/content',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(contentFolder, { maxAge: '365d' })
)

// up_works referrerRecord
const upWorksFolder = path.join(__dirname, 'public/up_works')
app.use(
  '/multilingual-assets/up_works',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(upWorksFolder, { maxAge: '365d' })
)

// web_demo referrerRecord
const webDemoFolder = path.join(__dirname, 'public/web_demo')
app.use(
  '/multilingual-assets/web_demo',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(webDemoFolder, { maxAge: '365d' })
)

// ucloudImg referrerRecord
const ucloudImgFolder = path.join(__dirname, 'public/ucloudImg')
app.use(
  '/multilingual-assets/ucloudImg',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(ucloudImgFolder, { maxAge: '365d' })
)

const blogPublicAssetFolder = path.join(__dirname, '../blog/public')
app.use(
  '/multilingual-assets',
  function (req, res, next) {
    utils.referrerRecord(req.headers.referer, 'assets')
    next()
  },
  express.static(blogPublicAssetFolder, { maxAge: '365d' })
)
// app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('传入非法JSON格式')
    if (req.path.startsWith('/api/multilingual-admin')) {
      return sendError(res, 400, ERROR_CODES.REQUEST_BODY_INVALID)
    }

    return res.status(400).send('Bad request')
  }
  next()
})
app.use('/api/multilingual-admin', multilingualAdminRouter)
app.use('/api/multilingual-admin', function (req, res) {
  return sendError(res, 404, ERROR_CODES.API_NOT_FOUND)
})
app.use('/api/multilingual-admin', function (error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  if (error && error.name === 'MulterError') {
    sendError(res, 400, ERROR_CODES.UPLOAD_INVALID, error.message)
    return
  }

  handleApiError(res, error, 'multilingual admin route fail')
})
app.use('/api/multilingual-blog', multilingualBlogRouter)
app.use('/:code/rss', multilingualRssRouter)
// language sitemap.xml
app.get('/:code/sitemap.xml', async function (req, res) {
  sitemapToolUtils.getLanguageSitemap(req, res)
})
// sitemap.xsl
app.use('/multilingual-assets/sitemap.xsl', function (req, res) {
  res.sendFile(path.join(__dirname, 'seo/sitemap/sitemap.xsl'))
})
// 多语言 server 只处理多语言后台静态资源，源站路径留给源站处理
app.use((req, res, next) => {
  const firstLevelPath = req.path.split('/')[1]
  if (firstLevelPath !== 'multilingual-admin') {
    res.status(404).send('Not found')
  } else {
    next()
  }
})
app.use(
  history({
    index: '/multilingual-admin/index.html'
  })
)
app.use(
  '/multilingual-admin',
  express.static(path.join(__dirname, 'front/multilingual-admin'))
)

// setInterval(() => {
//   const memoryUsage = process.memoryUsage();
//   const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
//   const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
//   const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
//   console.log(`RSS: ${rss} MB, Heap Total: ${heapTotal} MB, Heap Used: ${heapUsed} MB`);
// }, 1000);

console.info('Express应用初始化完成')

module.exports = app
