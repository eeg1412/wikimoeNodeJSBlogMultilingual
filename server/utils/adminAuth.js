const { verifyAdminToken } = require('./jwt')
const { unauthorized } = require('./errors')
const { AdminUsers } = require('../mongodb/models')

/**
 * 管理员鉴权中间件：
 *  - Authorization: Bearer <token>
 *  - 校验签名、过期、pwversion 一致
 */
module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const match = header.match(/^Bearer\s+(.+)$/i)
    if (!match) {
      return next(unauthorized('缺少身份凭证'))
    }
    const payload = verifyAdminToken(match[1])
    if (!payload || !payload.adminId) {
      return next(unauthorized('凭证无效或已过期'))
    }
    const admin = await AdminUsers.findById(payload.adminId).lean()
    if (!admin || admin.disabled) {
      return next(unauthorized('账号已禁用'))
    }
    if (
      typeof payload.pwv === 'number' &&
      payload.pwv !== (admin.pwversion || 0)
    ) {
      return next(unauthorized('凭证已失效'))
    }
    req.admin = admin
    next()
  } catch (err) {
    next(err)
  }
}
