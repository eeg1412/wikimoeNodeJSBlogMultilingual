const settingsUtils = require('../mongodb/utils/settings')

function isEmptySettingValue(value) {
  if (value === null || typeof value === 'undefined') {
    return true
  }

  if (typeof value === 'string' && !value.trim()) {
    return true
  }

  return false
}

async function getSettingValue(namespace, key, fallbackValue) {
  const fullKey = `${namespace}.${key}`
  const record = await settingsUtils.findByFullKey(fullKey, null, {
    lean: true
  })

  if (!record) {
    return fallbackValue
  }

  if (isEmptySettingValue(record.value)) {
    return fallbackValue
  }

  return record.value
}

async function getSystemSettingValue(key, fallbackValue) {
  return getSettingValue('system', key, fallbackValue)
}

async function getSiteSettingValue(key, fallbackValue) {
  return getSettingValue('site', key, fallbackValue)
}

module.exports = {
  getSettingValue,
  getSiteSettingValue,
  getSystemSettingValue,
  isEmptySettingValue
}
