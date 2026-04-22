import { verifyJwt } from '../utils/utils.js'
import AdminUser from '../mongodb/models/adminUser.js'

/**
 * 全局进程内 JWT 密钥引用
 * 启动时由 app.js 注入，密钥轮换后立即更新
 */
let _jwtSecret = null

export function setAdminJwtSecret(secret) {
  _jwtSecret = secret
}

export function getAdminJwtSecret() {
  return _jwtSecret
}

/**
 * 后台鉴权中间件
 * 依次校验：JWT 签名 → pwversion → adminUser 存在 → disabled → role
 *
 * @param {string[]} [allowedRoles] - 允许的角色列表，默认 ['admin', 'superadmin']
 */
export function requireAdminAuth(allowedRoles = ['admin', 'superadmin']) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '未提供认证凭据' })
    }

    const token = authHeader.slice(7)
    let payload
    try {
      payload = verifyJwt(token, _jwtSecret)
    } catch (err) {
      return res.status(401).json({ message: 'Token 无效或已过期' })
    }

    // 查询管理员当前状态
    let adminUser
    try {
      adminUser = await AdminUser.findById(payload.adminId).lean()
    } catch {
      return res.status(401).json({ message: '鉴权查询失败' })
    }

    if (!adminUser) {
      return res.status(401).json({ message: '账号不存在' })
    }
    if (adminUser.disabled) {
      return res.status(403).json({ message: '账号已被禁用' })
    }
    if (adminUser.pwversion !== payload.pwversion) {
      return res.status(401).json({ message: '密码已修改，请重新登录' })
    }
    if (!allowedRoles.includes(adminUser.role)) {
      return res.status(403).json({ message: '权限不足' })
    }

    req.adminUser = adminUser
    next()
  }
}

/**
 * 仅允许超管访问的快捷中间件
 */
export const requireSuperAdmin = requireAdminAuth(['superadmin'])
