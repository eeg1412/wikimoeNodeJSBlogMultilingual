import { loginSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { checkBcryptStr, signJwt } from '../../../utils/utils.js'
import { getAdminJwtSecret } from '../../../middleware/adminAuth.js'
import { getSystemConfig } from '../../../config/globalConfig.js'
import {
  findAdminByUsername,
  logLogin,
  countRecentFailsByIp
} from '../../../mongodb/utils/adminUsers.js'

export default async function loginHandler(req, res, next) {
  try {
    const { value, error } = validateData(loginSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }

    const { username, password, rememberMe } = value
    const IP =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      ''
    const ua = req.headers['user-agent'] || ''

    // 限流：按 IP 检查最近窗口期失败次数
    const systemConfig = getSystemConfig()
    const windowMinutes = systemConfig.adminLoginAttemptWindowMinutes ?? 15
    const maxAttempts = systemConfig.adminLoginMaxAttempts ?? 5
    const recentFails = await countRecentFailsByIp(IP, windowMinutes)
    if (recentFails >= maxAttempts) {
      await logLogin({
        username,
        IP,
        ua,
        success: false,
        reason: 'ip_rate_limit'
      })
      return res
        .status(429)
        .json({ message: `登录失败次数过多，请 ${windowMinutes} 分钟后再试` })
    }

    const admin = await findAdminByUsername(username)
    if (!admin) {
      await logLogin({
        username,
        IP,
        ua,
        success: false,
        reason: 'user_not_found'
      })
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    if (admin.disabled) {
      await logLogin({
        username,
        adminId: admin._id,
        IP,
        ua,
        success: false,
        reason: 'disabled'
      })
      return res.status(403).json({ message: '账号已被禁用' })
    }

    const passwordMatch = checkBcryptStr(password, admin.password)
    if (!passwordMatch) {
      await logLogin({
        username,
        adminId: admin._id,
        IP,
        ua,
        success: false,
        reason: 'wrong_password'
      })
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    // 登录成功
    await logLogin({
      username,
      adminId: admin._id,
      IP,
      ua,
      success: true,
      reason: ''
    })

    const defaultTtlHours = systemConfig.adminTokenDefaultTtlHours ?? 8
    const rememberMeTtlDays = systemConfig.adminTokenRememberMeTtlDays ?? 30
    const expiresIn = rememberMe
      ? `${rememberMeTtlDays}d`
      : `${defaultTtlHours}h`

    const payload = {
      adminId: String(admin._id),
      username: admin.username,
      role: admin.role,
      pwversion: admin.pwversion
    }

    const token = signJwt(payload, getAdminJwtSecret(), { expiresIn })

    const userInfo = {
      _id: admin._id,
      username: admin.username,
      nickname: admin.nickname,
      role: admin.role
    }

    return res.json({
      data: {
        token,
        userInfo,
        // 保留旧字段，避免已有前端缓存或旧调用方立即失效。
        adminInfo: userInfo
      }
    })
  } catch (err) {
    next(err)
  }
}
