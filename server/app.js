import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import cookieParser from 'cookie-parser'
import log4js from 'log4js'
import helmet from 'helmet'
import history from 'connect-history-api-fallback'
import expressLayouts from 'express-ejs-layouts'

import log4jsConfig from './config/log4js.config.js'
import { validateEnv, LOCAL_ATTACHMENT_STORAGE_DIR } from './config/env.js'
import { connectMongoDB } from './mongodb/index.js'
import {
  ensureJWTSecretAdmin,
  setAdminJwtSecretGlobal
} from './utils/jwtManager.js'
import { globalErrorHandler, requireReady } from './middleware/errorHandler.js'

import adminRouter from './routes/admin.js'
import blogRouter from './routes/blog.js'
import blogPageRouter from './routes/blogPages.js'
import { getSiteConfig } from './config/globalConfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ────────────── 启动校验 ──────────────
validateEnv()

// ────────────── 日志配置 ──────────────
log4js.configure(log4jsConfig)
const logger = log4js.getLogger('system')

// ────────────── JWT 密钥 ──────────────
const jwtSecret = ensureJWTSecretAdmin()
setAdminJwtSecretGlobal(jwtSecret)

// ────────────── Express 应用 ──────────────
const app = express()

// 安全响应头
app.use(
  helmet({
    contentSecurityPolicy: false // EJS 模板会使用内联样式，暂时关闭 CSP；生产上线前应配置
  })
)

app.use(log4js.connectLogger(log4js.getLogger('access'), { level: 'auto' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '10mb' }))
app.use(cookieParser())

// JSON 解析错误处理
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: '非法 JSON 格式' })
  }
  next(err)
})

// ────────────── EJS 视图引擎（博客端） ──────────────
app.set('views', join(__dirname, '../blog/views'))
app.set('view engine', 'ejs')
app.use(expressLayouts)
app.set('layout', 'layouts/base')
app.set('layout extractScripts', false)
app.set('layout extractStyles', false)

// ────────────── 静态资源 ──────────────
// 博客端编译样式
app.use(
  '/assets',
  express.static(join(__dirname, '../blog/public/assets'), { maxAge: '7d' })
)
// 博客端其他公共资源
app.use(
  '/public',
  express.static(join(__dirname, '../blog/public'), { maxAge: '7d' })
)
// 翻译站本地附件
app.use(
  '/local-attachments',
  express.static(LOCAL_ATTACHMENT_STORAGE_DIR(), { maxAge: '30d' })
)

// ────────────── 路由 ──────────────
app.use('/api/admin', requireReady, adminRouter)
app.use('/api/blog', requireReady, blogRouter)

// robots.txt
app.use('/robots.txt', (req, res) => {
  res.type('text/plain')
  res.send(getSiteConfig().robotsTxt || 'User-agent: *\nDisallow:')
})

// ads.txt
app.use('/ads.txt', (req, res) => {
  res.type('text/plain')
  res.send(getSiteConfig().adsTxtContent || '')
})

// 管理端 SPA
app.use('/multilingual-admin', express.static(join(__dirname, 'front/admin')))
app.get('/multilingual-admin', (req, res) =>
  res.sendFile(join(__dirname, 'front/admin/index.html'))
)
app.get('/multilingual-admin/*', (req, res) =>
  res.sendFile(join(__dirname, 'front/admin/index.html'))
)

// 博客端页面路由（语言前缀路由，必须在 SPA 之后）
app.use('/', requireReady, blogPageRouter)

// ────────────── 全局错误处理 ──────────────
app.use(globalErrorHandler)

// ────────────── 启动数据库连接 ──────────────
connectMongoDB().catch(err => {
  logger.error('数据库连接失败:', err)
  process.exit(1)
})

logger.info('Express 应用初始化完成')

export default app
