const log4js = require('log4js')
const utils = require('../../../utils/utils')
const {
  ERROR_CODES,
  sendError
} = require('../../../utils/multilingualAdminResponse')

const adminApiLog = log4js.getLogger('adminApi')

const LOGIN_LIMIT_DEFAULTS = {
  siteAdminLoginAttemptTime: 5,
  siteAdminLoginMaxAttempts: 3
}

function normalizeLoginLimitNumber(value, defaultValue) {
  const numberValue = Number(value)
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return numberValue
  }

  return defaultValue
}

async function getLoginAttemptLimitSettings() {
  const settings = { ...LOGIN_LIMIT_DEFAULTS }
  const optionRepository = global.$mongodDB.source.repositories.options
  const optionList = await optionRepository.find(
    {
      name: {
        $in: Object.keys(LOGIN_LIMIT_DEFAULTS)
      }
    },
    'name value',
    { lean: true }
  )

  optionList.forEach(item => {
    if (!Object.prototype.hasOwnProperty.call(settings, item.name)) {
      return
    }

    settings[item.name] = normalizeLoginLimitNumber(
      item.value,
      LOGIN_LIMIT_DEFAULTS[item.name]
    )
  })

  return settings
}

function getUserLoginLogModel() {
  return global.$mongodDB.multilingual.repositories.userLoginLogs.model
}

async function saveLoginLog(username, ip, ipInfo, deviceInfo, success, msg) {
  await new (getUserLoginLogModel())({
    username,
    ip,
    ipInfo,
    deviceInfo,
    success,
    msg
  }).save()
}

function isSourceAdmin(user) {
  return user && Number(user.role) >= 990
}

module.exports = async function multilingualAdminLogin(req, res) {
  await utils.executeInLock('multilingualAdminLogin', async () => {
    const username = req.body.username
    const password = req.body.password
    const remember = req.body.remember === true
    const ip = utils.getUserIp(req)
    const limitedUsername = utils.limitStr(String(username || ''), 50)
    const deviceInfo = utils.deviceUAInfoUtils(req)

    const { siteAdminLoginAttemptTime, siteAdminLoginMaxAttempts } =
      await getLoginAttemptLimitSettings()
    const timeThreshold = new Date(
      Date.now() - siteAdminLoginAttemptTime * 60 * 1000
    )
    const recentAttempts = await getUserLoginLogModel().countDocuments({
      ip,
      success: false,
      date: { $gte: timeThreshold }
    })

    if (recentAttempts >= siteAdminLoginMaxAttempts) {
      adminApiLog.warn(
        `multilingual admin:${limitedUsername} from IP:${ip} try login but too many attempts`
      )
      sendError(
        res,
        429,
        ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS,
        '登录失败次数过多，请稍后再试'
      )
      return
    }

    const ipInfo = await utils.IP2LocationUtils(ip, null, null, false)

    if (typeof username !== 'string' || typeof password !== 'string') {
      await saveLoginLog(
        limitedUsername,
        ip,
        ipInfo,
        deviceInfo,
        false,
        '参数错误'
      )
      sendError(res, 400, ERROR_CODES.AUTH_FAILED, '用户名或密码不正确')
      return
    }

    const admin = await global.$mongodDB.source.repositories.users.findOne(
      { username },
      undefined,
      { lean: true }
    )
    if (!admin || !isSourceAdmin(admin)) {
      adminApiLog.warn(
        `multilingual admin:${limitedUsername} not found or not admin`
      )
      await saveLoginLog(
        limitedUsername,
        ip,
        ipInfo,
        deviceInfo,
        false,
        '用户不存在或非管理员'
      )
      sendError(res, 400, ERROR_CODES.AUTH_FAILED, '用户名或密码不正确')
      return
    }

    if (!utils.checkBcryptStr(password, admin.password)) {
      adminApiLog.warn(
        `multilingual admin:${limitedUsername} password is not correct`
      )
      await saveLoginLog(
        limitedUsername,
        ip,
        ipInfo,
        deviceInfo,
        false,
        '密码错误'
      )
      sendError(res, 400, ERROR_CODES.AUTH_FAILED, '用户名或密码不正确')
      return
    }

    if (admin.disabled) {
      await saveLoginLog(
        limitedUsername,
        ip,
        ipInfo,
        deviceInfo,
        false,
        '账号被禁用'
      )
      sendError(res, 400, ERROR_CODES.AUTH_FAILED, '该账号已被禁用')
      return
    }

    const token = utils.creatJWT(
      {
        id: admin._id,
        username: admin.username,
        pwversion: admin.pwversion,
        version: 1
      },
      remember ? '365d' : '1h'
    )
    adminApiLog.info(`multilingual admin:${limitedUsername} login, IP:${ip}`)
    await saveLoginLog(
      limitedUsername,
      ip,
      ipInfo,
      deviceInfo,
      true,
      '登录成功'
    )
    res.send({ token })
  })
}
