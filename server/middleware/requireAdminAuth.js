const adminUsersUtils = require('../mongodb/utils/adminUsers')
const {
  extractBearerToken,
  verifyAdminJwt
} = require('../security/adminJwtToken')

function buildErrorResponse(res, statusCode, message) {
  res.status(statusCode).json({
    errors: [
      {
        message
      }
    ]
  })
}

function requireAdminAuth(options) {
  const finalOptions = options || {}
  const requiredRoles = finalOptions.roles || []

  return async function (req, res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization)

      if (!token) {
        buildErrorResponse(res, 401, '缺少后台登录凭证')
        return
      }

      let decodedToken = null

      try {
        decodedToken = verifyAdminJwt(token)
      } catch (error) {
        buildErrorResponse(res, 401, '后台登录凭证已失效')
        return
      }

      const adminUser = await adminUsersUtils.findOne({
        _id: decodedToken.id
      })

      if (!adminUser) {
        buildErrorResponse(res, 401, '后台账号不存在')
        return
      }

      if (adminUser.disabled) {
        buildErrorResponse(res, 403, '该后台账号已被禁用')
        return
      }

      if (decodedToken.pwversion !== adminUser.pwversion) {
        buildErrorResponse(res, 401, '后台登录凭证已失效')
        return
      }

      if (requiredRoles.length > 0 && !requiredRoles.includes(adminUser.role)) {
        buildErrorResponse(res, 403, '权限不足')
        return
      }

      req.adminUser = adminUser
      req.adminToken = decodedToken
      next()
    } catch (error) {
      next(error)
    }
  }
}

module.exports = requireAdminAuth
