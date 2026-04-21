const log4js = require('../config/log4js-config')
const db = require('../mongodb')
const { hashPassword } = require('../utils/auth')
const optionsService = require('./optionsService')
const env = require('../config/env')

const bootstrapLog = log4js.getLogger('default')

async function ensureInitialAdminUser() {
  const existing = await db.utils.adminUsers.findOne({
    username: env.INIT_ADMIN_USERNAME
  })

  if (existing) {
    return existing
  }

  return db.utils.adminUsers.save({
    username: env.INIT_ADMIN_USERNAME,
    password: hashPassword(env.INIT_ADMIN_PASSWORD),
    nickname: env.INIT_ADMIN_NICKNAME,
    role: 'superadmin',
    disabled: false,
    pwversion: 0
  })
}

async function initializeApplicationState() {
  await db.connect()
  await optionsService.ensureDefaultOptions()
  await ensureInitialAdminUser()
  global.$cacheData = { public: new Map() }
  global.$isReady = true
  bootstrapLog.info('application bootstrap completed')
}

module.exports = {
  initializeApplicationState
}