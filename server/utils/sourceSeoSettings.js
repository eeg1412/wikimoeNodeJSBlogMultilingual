const SOURCE_SEO_SETTING_DEFAULTS = {
  siteTitle: '',
  siteDescription: '',
  siteLogo: '',
  siteFavicon: '',
  siteUrl: '',
  siteTimeZone: '',
  sitePageSize: 10,
  sitePostRandomSimilarCount: 0,
  sitePostRandomSimilarRange: [],
  sitePostRandomSimilarShowRange: []
}

const SOURCE_SEO_SETTING_NAMES = Object.keys(SOURCE_SEO_SETTING_DEFAULTS)

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

async function getSourceSeoSettings() {
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

module.exports = {
  getSourceSeoSettings,
  normalizeSiteUrl
}
