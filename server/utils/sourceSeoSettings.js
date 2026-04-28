const SOURCE_SEO_SETTING_DEFAULTS = {
  siteTitle: '',
  siteSubTitle: '',
  siteDescription: '',
  siteKeywords: '',
  siteLogo: '',
  siteFavicon: '',
  siteUrl: '',
  siteTimeZone: '',
  siteEnableRss: false,
  siteRssMaxCount: 10,
  siteRssTweetTitleType: 1,
  siteShowRssInFooter: false,
  siteEnableSitemap: false,
  siteShowSitemapInFooter: false
}

const SOURCE_SEO_SETTING_NAMES = Object.keys(SOURCE_SEO_SETTING_DEFAULTS)

function getSourceOptionRepository() {
  return global.$mongodDB?.source?.repositories?.options
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

  return String(value || '')
}

async function getSourceSeoSettings() {
  const settings = { ...SOURCE_SEO_SETTING_DEFAULTS }
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
