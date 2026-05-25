const SOURCE_SEO_SETTING_DEFAULTS = {
  siteUrl: '',
  siteTimeZone: '',
  sitePageSize: 10,
  sitePostRandomSimilarCount: 0,
  sitePostRandomSimilarRange: [],
  sitePostRandomSimilarShowRange: []
}

const SOURCE_SEO_SETTING_NAMES = Object.keys(SOURCE_SEO_SETTING_DEFAULTS)
const SOURCE_SEO_SETTINGS_CACHE_KEY = '$sourceSeoSettings'
let sourceSeoSettingsCacheLoadPromise = null

function getSourceOptionRepository() {
  return global.$mongodDB?.source?.repositories?.options
}

function buildDefaultSourceSeoSettings() {
  const settings = { ...SOURCE_SEO_SETTING_DEFAULTS }
  SOURCE_SEO_SETTING_NAMES.forEach(name => {
    if (Array.isArray(SOURCE_SEO_SETTING_DEFAULTS[name])) {
      settings[name] = [...SOURCE_SEO_SETTING_DEFAULTS[name]]
    }
  })

  return settings
}

function cloneSourceSeoSettings(settings) {
  const clonedSettings = buildDefaultSourceSeoSettings()
  SOURCE_SEO_SETTING_NAMES.forEach(name => {
    const value = settings?.[name]
    if (Array.isArray(value)) {
      clonedSettings[name] = [...value]
      return
    }

    if (typeof value !== 'undefined') {
      clonedSettings[name] = value
    }
  })

  return clonedSettings
}

function normalizeSiteUrl(siteUrl) {
  const value = String(siteUrl || '')
    .trim()
    .replace(/\/+$/, '')
  if (!value) {
    return ''
  }

  try {
    new URL(value)
    return value
  } catch (error) {
    return ''
  }
}

function normalizeSourceOptionValue(defaultValue, value) {
  if (typeof defaultValue === 'boolean') {
    return value === true || value === 'true' || value === '1'
  }

  if (typeof defaultValue === 'number') {
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) {
      return numberValue
    }
    return defaultValue
  }

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

function getSourceSeoSettingsCache() {
  return global[SOURCE_SEO_SETTINGS_CACHE_KEY] || null
}

function setSourceSeoSettingsCache(settings) {
  global[SOURCE_SEO_SETTINGS_CACHE_KEY] = {
    values: cloneSourceSeoSettings(settings),
    updatedAt: new Date()
  }
}

async function loadSourceSeoSettingsFromDatabase() {
  const settings = buildDefaultSourceSeoSettings()
  const repository = getSourceOptionRepository()
  if (!repository) {
    return settings
  }

  const optionList = await repository.find(
    { name: { $in: SOURCE_SEO_SETTING_NAMES } },
    'name value',
    { lean: true }
  )

  optionList.forEach(item => {
    if (!Object.prototype.hasOwnProperty.call(settings, item.name)) {
      return
    }

    settings[item.name] = normalizeSourceOptionValue(
      SOURCE_SEO_SETTING_DEFAULTS[item.name],
      item.value
    )
  })

  settings.siteUrl = normalizeSiteUrl(settings.siteUrl)
  return settings
}

async function refreshSourceSeoSettingsCache() {
  const settings = await loadSourceSeoSettingsFromDatabase()
  setSourceSeoSettingsCache(settings)
  return getSourceSeoSettingsCacheData()
}

async function ensureSourceSeoSettingsCache() {
  const cacheData = getSourceSeoSettingsCache()
  if (cacheData) {
    return cacheData
  }

  if (!sourceSeoSettingsCacheLoadPromise) {
    sourceSeoSettingsCacheLoadPromise = refreshSourceSeoSettingsCache()
  }

  try {
    await sourceSeoSettingsCacheLoadPromise
  } finally {
    sourceSeoSettingsCacheLoadPromise = null
  }

  return getSourceSeoSettingsCache()
}

async function getSourceSeoSettings() {
  const cacheData = await ensureSourceSeoSettingsCache()
  return cloneSourceSeoSettings(cacheData?.values)
}

async function getSourceSeoSettingsCacheData() {
  const cacheData = await ensureSourceSeoSettingsCache()
  return {
    names: SOURCE_SEO_SETTING_NAMES.slice(),
    values: cloneSourceSeoSettings(cacheData?.values),
    updatedAt: cacheData?.updatedAt || null
  }
}

module.exports = {
  getSourceSeoSettings,
  getSourceSeoSettingsCacheData,
  refreshSourceSeoSettingsCache,
  normalizeSiteUrl
}
