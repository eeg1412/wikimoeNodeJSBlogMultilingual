const bcrypt = require('bcryptjs')
const env = require('../config/env')
const { AdminUsers } = require('../mongodb/models')
const log4js = require('log4js')
const logger = log4js.getLogger()

/**
 * 首次启动时若 adminUsers 空且已设置 INIT_ADMIN_PASSWORD，则创建初始管理员
 */
async function ensureInitialAdmin() {
  const count = await AdminUsers.estimatedDocumentCount()
  if (count > 0) return
  if (!env.INIT_ADMIN_PASSWORD) {
    logger.warn('adminUsers 为空，且未设置 INIT_ADMIN_PASSWORD，跳过初始化')
    return
  }
  const hashed = await bcrypt.hash(env.INIT_ADMIN_PASSWORD, 10)
  await AdminUsers.create({
    username: env.INIT_ADMIN_USERNAME,
    password: hashed,
    nickname: env.INIT_ADMIN_NICKNAME,
    role: 1,
    disabled: false,
    pwversion: 0
  })
  logger.info(`初始管理员已创建: ${env.INIT_ADMIN_USERNAME}`)
}

module.exports = {
  ensureInitialAdmin
}
