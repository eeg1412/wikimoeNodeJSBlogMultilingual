import AdminUser from '../mongodb/models/adminUser.js'
import { creatBcryptStr } from '../utils/utils.js'
import {
  INIT_ADMIN_USERNAME,
  INIT_ADMIN_PASSWORD,
  INIT_ADMIN_NICKNAME
} from './env.js'

/**
 * 首次启动时初始化超管账号
 * 若数据库中已存在任何 adminUser，则跳过创建；但始终执行角色迁移
 */
export async function initAdminUser() {
  // 迁移：将旧 'super_admin' 角色修正为 'superadmin'
  const migrateResult = await AdminUser.updateMany(
    { role: 'super_admin' },
    { $set: { role: 'superadmin' } }
  )
  if (migrateResult.modifiedCount > 0) {
    console.info(
      `[AdminInit] 已将 ${migrateResult.modifiedCount} 个账号的 role 从 'super_admin' 迁移为 'superadmin'`
    )
  }

  const count = await AdminUser.countDocuments()
  if (count > 0) {
    return
  }

  const username = INIT_ADMIN_USERNAME()
  const password = INIT_ADMIN_PASSWORD()
  const nickname = INIT_ADMIN_NICKNAME()

  if (!username || !password || !nickname) {
    console.warn(
      '[AdminInit] INIT_ADMIN_* 环境变量未完整配置，跳过管理员初始化'
    )
    return
  }

  const hashedPassword = creatBcryptStr(password)
  await AdminUser.create({
    username,
    password: hashedPassword,
    nickname,
    role: 'superadmin',
    disabled: false,
    pwversion: 0
  })

  console.info(`[AdminInit] 初始管理员账号已创建: ${username}`)
}
