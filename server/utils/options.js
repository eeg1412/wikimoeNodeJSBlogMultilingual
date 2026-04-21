const { Options } = require('../mongodb/models')

// options 默认值
const DEFAULT_OPTIONS = {
  siteTitle: 'Wikimoe Multilingual',
  siteSubTitle: '',
  siteDescription: '',
  siteKeywords: '',
  siteUrl: '',
  siteLogo: '',
  siteDarkLogo: '',
  siteFavicon: '',
  siteFooterInfo: '',
  siteExtraCss: '',
  siteExtraJs: '',
  siteThemeMode: 'auto',
  siteAllowSwitchTheme: true,
  sitePageSize: 20,
  siteTimeZone: 'Asia/Tokyo',
  siteShowBlogVersion: true,
  siteEnableSitemap: true,
  siteRobotsTxt: 'User-agent: *\nAllow: /',
  siteDefaultLanguageCode: 'en',
  googleAdEnabled: false,
  googleAdId: '',
  googleAdPostBottomEnabled: false,
  googleAdPostBottomParams: {},
  AdAdsTxt: '',
  translationSystemPrompt:
    '你是一名专业的多语言技术博客翻译。请严格保留 Markdown/HTML 结构、变量名、代码块与占位符，只翻译自然语言文本。',
  translationHtmlBatchMaxSegments: 80,
  translationHtmlBatchMaxChars: 6000,
  translationRetryLimit: 2
}

async function getOption(key, fallback) {
  const doc = await Options.findOne({ key }).lean()
  if (doc && doc.value !== undefined && doc.value !== null) {
    return doc.value
  }
  if (fallback !== undefined) return fallback
  if (Object.prototype.hasOwnProperty.call(DEFAULT_OPTIONS, key)) {
    return DEFAULT_OPTIONS[key]
  }
  return null
}

async function setOption(key, value) {
  await Options.updateOne({ key }, { $set: { key, value } }, { upsert: true })
}

async function getAllOptions() {
  const list = await Options.find({}).lean()
  const map = {}
  for (const item of list) {
    map[item.key] = item.value
  }
  return Object.assign({}, DEFAULT_OPTIONS, map)
}

async function initDefaultOptions() {
  const existing = await Options.find({}, { key: 1 }).lean()
  const existingSet = new Set(existing.map(o => o.key))
  const ops = []
  for (const key of Object.keys(DEFAULT_OPTIONS)) {
    if (!existingSet.has(key)) {
      ops.push({
        insertOne: { document: { key, value: DEFAULT_OPTIONS[key] } }
      })
    }
  }
  if (ops.length) {
    await Options.bulkWrite(ops, { ordered: false })
  }
}

module.exports = {
  DEFAULT_OPTIONS,
  getOption,
  setOption,
  getAllOptions,
  initDefaultOptions
}
