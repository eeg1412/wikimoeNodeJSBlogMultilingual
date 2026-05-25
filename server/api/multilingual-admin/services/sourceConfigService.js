const {
  getSourceSeoSettingsCacheData,
  refreshSourceSeoSettingsCache
} = require('../../../utils/sourceSeoSettings')

const SOURCE_CONFIG_EXTRA_DEFAULTS = {
  siteReferrerWhiteList: []
}

const SOURCE_CONFIG_EXTRA_NAMES = Object.keys(SOURCE_CONFIG_EXTRA_DEFAULTS)

function getSourceOptionRepository() {
  return global.$mongodDB?.source?.repositories?.options
}

function buildDefaultExtraValues() {
  const values = {}

  SOURCE_CONFIG_EXTRA_NAMES.forEach(name => {
    const defaultValue = SOURCE_CONFIG_EXTRA_DEFAULTS[name]
    values[name] = Array.isArray(defaultValue)
      ? [...defaultValue]
      : defaultValue
  })

  return values
}

function normalizeExtraValue(defaultValue, value) {
  if (Array.isArray(defaultValue)) {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean)
    }

    return String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return String(value || '')
}

async function getExtraSourceConfigValues() {
  const values = buildDefaultExtraValues()
  const repository = getSourceOptionRepository()

  if (!repository) {
    return values
  }

  const optionList = await repository.find(
    { name: { $in: SOURCE_CONFIG_EXTRA_NAMES } },
    'name value',
    { lean: true }
  )

  optionList.forEach(item => {
    if (!Object.prototype.hasOwnProperty.call(values, item.name)) {
      return
    }

    values[item.name] = normalizeExtraValue(
      SOURCE_CONFIG_EXTRA_DEFAULTS[item.name],
      item.value
    )
  })

  return values
}

function buildSourceConfigData(cacheData, extraValues) {
  const names = cacheData.names.slice()

  SOURCE_CONFIG_EXTRA_NAMES.forEach(name => {
    if (!names.includes(name)) {
      names.push(name)
    }
  })

  return {
    names,
    values: {
      ...cacheData.values,
      ...extraValues
    },
    updatedAt: cacheData.updatedAt || null
  }
}

async function getSourceConfigData() {
  const [cacheData, extraValues] = await Promise.all([
    getSourceSeoSettingsCacheData(),
    getExtraSourceConfigValues()
  ])

  return buildSourceConfigData(cacheData, extraValues)
}

async function refreshSourceConfigData() {
  await refreshSourceSeoSettingsCache()
  return getSourceConfigData()
}

module.exports = {
  getSourceConfigData,
  refreshSourceConfigData
}
