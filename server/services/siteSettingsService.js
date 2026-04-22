const { SUPPORTED_LANGUAGE_CODES } = require('../../common/constants/app')
const { getSiteSettingValue } = require('./settingsService')
const settingsUtils = require('../mongodb/utils/settings')

function normalizePublicSettings(records) {
  const settingsObject = {}

  for (const record of records) {
    settingsObject[record.key] = record.value
  }

  return settingsObject
}

async function getPublicSiteSettings() {
  const records = await settingsUtils.find(
    {
      namespace: 'site',
      isPublic: true
    },
    null,
    {
      sort: { fullKey: 1 },
      lean: true
    }
  )

  return normalizePublicSettings(records)
}

async function getDefaultLanguageCode() {
  const languageCode = await getSiteSettingValue('defaultLanguageCode', 'en')

  if (!languageCode) {
    return 'en'
  }

  if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
    return 'en'
  }

  return languageCode
}

module.exports = {
  getDefaultLanguageCode,
  getPublicSiteSettings
}
