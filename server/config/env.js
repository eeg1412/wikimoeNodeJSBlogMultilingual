const path = require('path')
const dotenv = require('dotenv')

// 加载根目录 .env（若存在）
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
// 再加载 server 目录 .env（允许覆盖）
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true })

function str(name, defaultValue) {
  const v = process.env[name]
  if (v === undefined || v === null || v === '') {
    return defaultValue
  }
  return String(v)
}

function num(name, defaultValue) {
  const v = process.env[name]
  if (v === undefined || v === null || v === '') return defaultValue
  const n = Number(v)
  return Number.isFinite(n) ? n : defaultValue
}

function requireStr(name) {
  const v = str(name, '')
  if (!v) {
    throw new Error(`环境变量 ${name} 未配置`)
  }
  return v
}

const env = {
  PORT: num('PORT', 3100),
  DB_HOST: requireStr('DB_HOST'),
  JSON_LIMIT: str('JSON_LIMIT', '20mb'),
  URLENCODED_LIMIT: str('URLENCODED_LIMIT', '20mb'),
  MAX_HISTORYLOGS_SIZE: num('MAX_HISTORYLOGS_SIZE', 100),
  IP2LOCATION_FILE_NAME: str('IP2LOCATION_FILE_NAME', ''),

  SOURCE_BLOG_API_BASE_URL: requireStr('SOURCE_BLOG_API_BASE_URL'),
  SOURCE_BLOG_PUBLIC_ORIGIN: requireStr('SOURCE_BLOG_PUBLIC_ORIGIN'),

  LOCAL_ATTACHMENT_STORAGE_DIR: str(
    'LOCAL_ATTACHMENT_STORAGE_DIR',
    './public/localized'
  ),
  LOCAL_ATTACHMENT_PUBLIC_BASE_PATH: str(
    'LOCAL_ATTACHMENT_PUBLIC_BASE_PATH',
    '/localized'
  ),

  JWT_SECRET_ADMIN: str('JWT_SECRET_ADMIN', ''),

  GEMINI_API_KEY: str('GEMINI_API_KEY', ''),
  GEMINI_MODEL: str('GEMINI_MODEL', 'gemini-2.5-flash'),
  GEMINI_THINKING_BUDGET: num('GEMINI_THINKING_BUDGET', 0),
  AI_GATEWAY_URL: str('AI_GATEWAY_URL', ''),

  INIT_ADMIN_USERNAME: str('INIT_ADMIN_USERNAME', 'admin'),
  INIT_ADMIN_PASSWORD: str('INIT_ADMIN_PASSWORD', ''),
  INIT_ADMIN_NICKNAME: str('INIT_ADMIN_NICKNAME', 'Admin')
}

module.exports = env
