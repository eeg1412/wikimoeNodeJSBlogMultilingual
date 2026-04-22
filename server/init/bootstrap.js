const bcrypt = require('bcryptjs')

const {
  SITE_SETTING_DEFINITIONS,
  SYSTEM_SETTING_DEFINITIONS
} = require('../../common/constants/settings')
const adminUsersUtils = require('../mongodb/utils/adminUsers')
const settingsUtils = require('../mongodb/utils/settings')

function buildSettingUpsert(definition) {
  const updatePayload = {
    $set: {
      namespace: definition.namespace,
      key: definition.key,
      fullKey: definition.fullKey,
      valueType: definition.valueType,
      isSecret: definition.isSecret,
      isPublic: definition.isPublic,
      description: definition.description
    },
    $setOnInsert: {
      value: null
    }
  }

  if (Object.prototype.hasOwnProperty.call(definition, 'defaultValue')) {
    updatePayload.$setOnInsert.value = definition.defaultValue
  }

  return updatePayload
}

async function ensureSettingDefinitions(definitions) {
  let createdCount = 0

  for (const definition of definitions) {
    const existingDocument = await settingsUtils.findByFullKey(
      definition.fullKey
    )

    await settingsUtils.findOneAndUpdate(
      { fullKey: definition.fullKey },
      buildSettingUpsert(definition),
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    )

    if (!existingDocument) {
      createdCount += 1
    }
  }

  return createdCount
}

async function ensureInitialAdminUser() {
  const adminCount = await adminUsersUtils.countDocuments({})

  if (adminCount > 0) {
    return null
  }

  const username = String(process.env.INIT_ADMIN_USERNAME).trim().toLowerCase()
  const nickname = String(process.env.INIT_ADMIN_NICKNAME).trim()
  const passwordHash = await bcrypt.hash(process.env.INIT_ADMIN_PASSWORD, 12)

  return adminUsersUtils.save({
    username,
    password: passwordHash,
    nickname,
    role: 'super_admin',
    disabled: false,
    pwversion: 1,
    IP: null,
    ipInfo: null
  })
}

async function runBootstrap() {
  const systemSettingCreatedCount = await ensureSettingDefinitions(
    SYSTEM_SETTING_DEFINITIONS
  )
  const siteSettingCreatedCount = await ensureSettingDefinitions(
    SITE_SETTING_DEFINITIONS
  )
  const initialAdminUser = await ensureInitialAdminUser()

  console.info(
    `Bootstrap 完成，新增 ${systemSettingCreatedCount} 条 system 配置，新增 ${siteSettingCreatedCount} 条 site 配置`
  )

  if (initialAdminUser) {
    console.info(`已创建初始管理员：${initialAdminUser.username}`)
  }

  return {
    systemSettingCreatedCount,
    siteSettingCreatedCount,
    initialAdminCreated: Boolean(initialAdminUser)
  }
}

module.exports = {
  runBootstrap
}
