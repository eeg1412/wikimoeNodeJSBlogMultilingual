const bcrypt = require('bcryptjs')

const { adminLoginSchema } = require('../../../../common/validation/adminAuth')
const adminLoginLogsUtils = require('../../../mongodb/utils/adminLoginLogs')
const adminUsersUtils = require('../../../mongodb/utils/adminUsers')
const { signAdminJwt } = require('../../../security/adminJwtToken')
const { getSystemSettingValue } = require('../../../services/settingsService')
const {
  getRequestDeviceInfo,
  getRequestIp,
  getRequestIpInfo
} = require('../../../utils/requestMeta')

async function saveAdminLoginLog(logData) {
  await adminLoginLogsUtils.save(logData)
}

function buildErrorResponse(res, statusCode, message) {
  res.status(statusCode).json({
    errors: [
      {
        message
      }
    ]
  })
}

async function getRecentFailedAttempts(IP, windowMinutes) {
  const timeThreshold = new Date(Date.now() - windowMinutes * 60 * 1000)
  return adminLoginLogsUtils.countDocuments({
    IP,
    success: false,
    createdAt: {
      $gte: timeThreshold
    }
  })
}

async function buildTokenExpiresIn(remember) {
  if (remember) {
    const rememberMeTtlDays = await getSystemSettingValue(
      'adminTokenRememberMeTtlDays',
      365
    )
    return `${rememberMeTtlDays}d`
  }

  const defaultTtlHours = await getSystemSettingValue(
    'adminTokenDefaultTtlHours',
    1
  )
  return `${defaultTtlHours}h`
}

module.exports = async function (req, res, next) {
  try {
    const validatedPayload = await adminLoginSchema.validateAsync(req.body, {
      abortEarly: false,
      stripUnknown: true
    })
    const username = validatedPayload.username.trim().toLowerCase()
    const password = validatedPayload.password
    const remember = validatedPayload.remember
    const IP = getRequestIp(req)
    const ipInfo = getRequestIpInfo(IP)
    const deviceInfo = getRequestDeviceInfo(req)
    const loginAttemptWindowMinutes = await getSystemSettingValue(
      'adminLoginAttemptWindowMinutes',
      5
    )
    const loginMaxAttempts = await getSystemSettingValue(
      'adminLoginMaxAttempts',
      3
    )
    const recentFailedAttempts = await getRecentFailedAttempts(
      IP,
      loginAttemptWindowMinutes
    )

    if (recentFailedAttempts >= loginMaxAttempts) {
      await saveAdminLoginLog({
        username,
        adminId: null,
        IP,
        ipInfo,
        deviceInfo,
        success: false,
        reason: '登录失败次数过多'
      })
      buildErrorResponse(res, 429, '登录失败次数过多，请稍后再试')
      return
    }

    const adminUser = await adminUsersUtils.findByUsername(username)

    if (!adminUser) {
      await saveAdminLoginLog({
        username,
        adminId: null,
        IP,
        ipInfo,
        deviceInfo,
        success: false,
        reason: '用户不存在'
      })
      buildErrorResponse(res, 400, '用户名或密码不正确')
      return
    }

    const passwordMatched = await bcrypt.compare(password, adminUser.password)

    if (!passwordMatched) {
      await saveAdminLoginLog({
        username,
        adminId: adminUser._id,
        IP,
        ipInfo,
        deviceInfo,
        success: false,
        reason: '密码错误'
      })
      buildErrorResponse(res, 400, '用户名或密码不正确')
      return
    }

    if (adminUser.disabled) {
      await saveAdminLoginLog({
        username,
        adminId: adminUser._id,
        IP,
        ipInfo,
        deviceInfo,
        success: false,
        reason: '账号被禁用'
      })
      buildErrorResponse(res, 403, '该账号已被禁用')
      return
    }

    await adminUsersUtils.findOneAndUpdate(
      { _id: adminUser._id },
      {
        $set: {
          IP,
          ipInfo
        }
      },
      { new: true }
    )

    const token = signAdminJwt(
      {
        id: String(adminUser._id),
        username: adminUser.username,
        role: adminUser.role,
        pwversion: adminUser.pwversion,
        version: 1
      },
      await buildTokenExpiresIn(remember)
    )

    await saveAdminLoginLog({
      username,
      adminId: adminUser._id,
      IP,
      ipInfo,
      deviceInfo,
      success: true,
      reason: '登录成功'
    })

    res.json({
      token,
      admin: adminUser.toJSON()
    })
  } catch (error) {
    if (error && error.isJoi) {
      res.status(400).json({
        errors: error.details.map(function (detail) {
          return {
            message: detail.message
          }
        })
      })
      return
    }

    next(error)
  }
}
