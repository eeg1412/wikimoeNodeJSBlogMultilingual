const path = require('path')
const dotenv = require('dotenv')
const Joi = require('joi')

const ROOT_DIR = path.resolve(__dirname, '../..')
const SERVER_DIR = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(ROOT_DIR, '.env') })

const schema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3100),
  DB_HOST: Joi.string().trim().required(),
  JSON_LIMIT: Joi.string().trim().default('20mb'),
  URLENCODED_LIMIT: Joi.string().trim().default('20mb'),
  MAX_HISTORYLOGS_SIZE: Joi.number().integer().min(1).default(100),
  IP2LOCATION_FILE_NAME: Joi.string().trim().default('IP2LOCATION-LITE-DB11.BIN'),
  NITRO_PORT: Joi.number().integer().min(1).max(65535).default(3101),
  NUXT_API_DOMAIN: Joi.string().uri().required(),
  SOURCE_BLOG_API_BASE_URL: Joi.string().uri().required(),
  SOURCE_BLOG_PUBLIC_ORIGIN: Joi.string().uri().required(),
  LOCAL_ATTACHMENT_STORAGE_DIR: Joi.string().trim().required(),
  LOCAL_ATTACHMENT_PUBLIC_BASE_PATH: Joi.string().trim().default('/localized'),
  JWT_SECRET_ADMIN: Joi.string().allow('').default(''),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_MODEL: Joi.string().trim().default('gemini-2.5-flash'),
  GEMINI_THINKING_BUDGET: Joi.number().integer().min(0).default(0),
  AI_GATEWAY_URL: Joi.string().allow('').default(''),
  INIT_ADMIN_USERNAME: Joi.string().trim().required(),
  INIT_ADMIN_PASSWORD: Joi.string().min(6).required(),
  INIT_ADMIN_NICKNAME: Joi.string().trim().required()
})

const { error, value } = schema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
  convert: true
})

if (error) {
  throw new Error(`env validation failed: ${error.message}`)
}

function resolveStoragePath(targetPath) {
  if (path.isAbsolute(targetPath)) {
    return targetPath
  }
  return path.resolve(SERVER_DIR, targetPath)
}

module.exports = {
  ...value,
  ADMIN_BUILD_DIR: path.join(SERVER_DIR, 'front', 'multilingual-admin'),
  LOG_DIR: path.join(SERVER_DIR, 'log'),
  ROOT_DIR,
  SERVER_DIR,
  SECRET_DIR: path.join(SERVER_DIR, 'secret'),
  LOCAL_ATTACHMENT_STORAGE_ABS_DIR: resolveStoragePath(
    value.LOCAL_ATTACHMENT_STORAGE_DIR
  )
}