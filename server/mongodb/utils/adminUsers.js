import AdminUser from '../models/adminUser.js'
import AdminLoginLog from '../models/adminLoginLog.js'
import { getIpInfo, getDeviceInfo } from '../../utils/utils.js'

/**
 * 记录登录日志
 */
export async function logLogin({ username, adminId, IP, ua, success, reason }) {
  try {
    const ipInfo = getIpInfo(IP)
    const deviceInfo = getDeviceInfo(ua)
    await AdminLoginLog.create({
      username,
      adminId: adminId || null,
      IP,
      ipInfo,
      deviceInfo,
      success,
      reason: reason || ''
    })
  } catch (err) {
    console.error('[AdminLoginLog] 写入失败:', err.message)
  }
}

/**
 * 按 IP 统计最近窗口期内的失败次数
 * @param {string} IP
 * @param {number} windowMinutes
 * @returns {Promise<number>}
 */
export async function countRecentFailsByIp(IP, windowMinutes = 15) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000)
  return AdminLoginLog.countDocuments({
    IP,
    success: false,
    createdAt: { $gte: since }
  })
}

/**
 * 查询管理员信息
 * @param {string} username
 */
export async function findAdminByUsername(username) {
  return AdminUser.findOne({ username }).lean()
}

/**
 * 分页查询登录日志
 */
export async function findLoginLogs({
  page = 1,
  limit = 20,
  sort = { createdAt: -1 }
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    AdminLoginLog.find().sort(sort).skip(skip).limit(limit).lean(),
    AdminLoginLog.countDocuments()
  ])
  return { list, total }
}
