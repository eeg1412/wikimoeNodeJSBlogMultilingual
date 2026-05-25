const utils = require('../../../utils/utils')
const {
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const OPTION_SCOPE = 'multilingual'
const LANGUAGE_SETTINGS_CACHE_KEY = '$multilingualLanguageSettings'
let languageSettingsCacheLoadPromise = null
const IMAGE_FIELD_NAMES = new Set([
  'siteLogo',
  'siteDarkLogo',
  'siteFavicon',
  'siteDefaultCover'
])
const BASE64_IMAGE_REG = /^data:image\/\w+;base64,/

const LANGUAGE_SETTING_FIELDS = [
  {
    name: 'blogLanguageEnabled',
    label: '启用博客端语言',
    type: 'boolean',
    group: 'site',
    defaultValue: true
  },
  {
    name: 'siteTitle',
    label: '站点标题',
    type: 'string',
    group: 'site',
    defaultValue: ''
  },
  {
    name: 'siteSubTitle',
    label: '站点副标题',
    type: 'string',
    group: 'site',
    defaultValue: ''
  },
  {
    name: 'siteDescription',
    label: '站点描述',
    type: 'textarea',
    group: 'seo',
    defaultValue: ''
  },
  {
    name: 'siteKeywords',
    label: '站点关键词',
    type: 'textarea',
    group: 'seo',
    defaultValue: ''
  },
  {
    name: 'siteLogo',
    label: '亮色 Logo',
    type: 'string',
    group: 'assets',
    defaultValue: ''
  },
  {
    name: 'siteDarkLogo',
    label: '深色 Logo',
    type: 'string',
    group: 'assets',
    defaultValue: ''
  },
  {
    name: 'siteFavicon',
    label: '站点图标',
    type: 'string',
    group: 'assets',
    defaultValue: ''
  },
  {
    name: 'siteDefaultCover',
    label: '默认封面',
    type: 'string',
    group: 'assets',
    defaultValue: ''
  },
  {
    name: 'siteShowLoadingText',
    label: '加载动画文案',
    type: 'string',
    group: 'site',
    defaultValue: ''
  },
  {
    name: 'siteShareDescription',
    label: '分享文案',
    type: 'textarea',
    group: 'share',
    defaultValue: ''
  },
  {
    name: 'siteFooterInfo',
    label: '页脚信息',
    type: 'textarea',
    group: 'share',
    defaultValue: ''
  },
  {
    name: 'sitePostBlogCommonFooterOpen',
    label: '启用博文底部共通内容',
    type: 'boolean',
    group: 'post',
    defaultValue: false
  },
  {
    name: 'sitePostBlogCommonFooterContent',
    label: '博文底部共通内容',
    type: 'textarea',
    group: 'post',
    defaultValue: ''
  },
  {
    name: 'sitePostBlogCommonFooterContentIsRichMode',
    label: '博文底部使用富文本',
    type: 'boolean',
    group: 'post',
    defaultValue: true
  },
  {
    name: 'sitePostTweetCommonFooterOpen',
    label: '启用推文底部共通内容',
    type: 'boolean',
    group: 'post',
    defaultValue: false
  },
  {
    name: 'sitePostTweetCommonFooterContent',
    label: '推文底部共通内容',
    type: 'textarea',
    group: 'post',
    defaultValue: ''
  },
  {
    name: 'sitePostTweetCommonFooterContentIsRichMode',
    label: '推文底部使用富文本',
    type: 'boolean',
    group: 'post',
    defaultValue: true
  },
  {
    name: 'sitePostRandomSimilarTitle',
    label: '相似内容标题',
    type: 'string',
    group: 'post',
    defaultValue: '相似内容'
  },
  {
    name: 'siteEnableRss',
    label: '开启 RSS',
    type: 'boolean',
    group: 'seoFeed',
    defaultValue: false
  },
  {
    name: 'siteRssMaxCount',
    label: 'RSS 显示条数',
    type: 'number',
    group: 'seoFeed',
    defaultValue: 10,
    min: 1,
    max: 100
  },
  {
    name: 'siteRssTweetTitleType',
    label: '推文标题类型',
    type: 'radio',
    group: 'seoFeed',
    defaultValue: 1,
    min: 1,
    max: 2,
    options: [
      { label: '裁切内容', value: 1 },
      { label: '日期', value: 2 }
    ]
  },
  {
    name: 'siteShowRssInFooter',
    label: '底部显示 RSS',
    type: 'boolean',
    group: 'seoFeed',
    defaultValue: false
  },
  {
    name: 'siteEnableSitemap',
    label: '开启站点地图',
    type: 'boolean',
    group: 'seoFeed',
    defaultValue: false
  },
  {
    name: 'siteShowSitemapInFooter',
    label: '底部显示站点地图',
    type: 'boolean',
    group: 'seoFeed',
    defaultValue: false
  }
]

const LANGUAGE_SETTING_FIELD_MAP = LANGUAGE_SETTING_FIELDS.reduce(
  (map, item) => {
    map[item.name] = item
    return map
  },
  {}
)

function getOptionModel() {
  const repository = global.$mongodDB.multilingual.repositories.options
  if (!repository || !repository.model) {
    throw new Error('multilingual options repository not found')
  }

  return repository.model
}

function normalizeSupportedLanguageCode(languageCode) {
  const normalized = normalizeLanguageCode(languageCode)
  if (!normalized) {
    throw new ApiError(ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED)
  }

  return normalized
}

function normalizeBooleanValue(value) {
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }

  return false
}

function normalizeNumberValue(field, value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return field.defaultValue
  }

  let normalizedValue = Math.round(numberValue)
  if (field.min && normalizedValue < field.min) {
    normalizedValue = field.min
  }
  if (field.max && normalizedValue > field.max) {
    normalizedValue = field.max
  }

  return normalizedValue
}

function normalizeValue(field, value) {
  if (field.type === 'boolean') {
    return normalizeBooleanValue(value)
  }

  if (field.type === 'number' || field.type === 'radio') {
    return normalizeNumberValue(field, value)
  }

  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value)
}

function serializeValue(field, value) {
  const normalizedValue = normalizeValue(field, value)
  if (field.type === 'boolean') {
    return String(normalizedValue)
  }

  return normalizedValue
}

function saveImageValue(languageCode, field, value) {
  if (!IMAGE_FIELD_NAMES.has(field.name)) {
    return value
  }

  if (typeof value !== 'string' || !BASE64_IMAGE_REG.test(value)) {
    return value
  }

  const filePath = `./public/upload/siteImg/multilingual/${languageCode}/`
  const fileName = `${languageCode}-${field.name}`
  const imageResult = utils.base64ToFile(value, filePath, fileName, {
    createDir: true
  })

  return `/multilingual-assets/upload/siteImg/multilingual/${languageCode}/${imageResult.fileNameAll}?v=${Date.now()}`
}

function buildDefaultValues() {
  const values = {}
  for (const field of LANGUAGE_SETTING_FIELDS) {
    values[field.name] = field.defaultValue
  }

  return values
}

function getSupportedLanguageCodes() {
  return SUPPORTED_LANGUAGE_CODES.slice()
}

function buildDefaultConfiguredNames() {
  const configuredNames = {}
  const languageCodes = getSupportedLanguageCodes()
  for (const languageCode of languageCodes) {
    configuredNames[languageCode] = []
  }

  return configuredNames
}

function getLanguageSettingsCache() {
  return global[LANGUAGE_SETTINGS_CACHE_KEY] || null
}

function setLanguageSettingsCache(cacheData) {
  global[LANGUAGE_SETTINGS_CACHE_KEY] = {
    fields: LANGUAGE_SETTING_FIELDS,
    languages: cacheData.languages.slice(),
    settings: cacheData.settings,
    configuredNames: cacheData.configuredNames,
    updatedAt: new Date()
  }
}

function cloneLanguageSettingsList(cacheData) {
  const settings = {}
  const configuredNames = {}
  for (const languageCode of cacheData.languages) {
    settings[languageCode] = {
      ...(cacheData.settings[languageCode] || buildDefaultValues())
    }
    configuredNames[languageCode] = (
      cacheData.configuredNames[languageCode] || []
    ).slice()
  }

  return {
    fields: cacheData.fields,
    languages: cacheData.languages.slice(),
    settings,
    configuredNames
  }
}

async function loadLanguageSettingsListFromDatabase() {
  const OptionModel = getOptionModel()
  const languageCodes = getSupportedLanguageCodes()
  const nameList = LANGUAGE_SETTING_FIELDS.map(item => item.name)
  const optionList = await OptionModel.find({
    scope: OPTION_SCOPE,
    languageCode: { $in: languageCodes },
    name: { $in: nameList }
  })
    .select('name value languageCode scope')
    .lean()

  const settings = {}
  const configuredNames = buildDefaultConfiguredNames()
  for (const languageCode of languageCodes) {
    settings[languageCode] = buildDefaultValues()
  }

  for (const item of optionList) {
    const languageValues = settings[item.languageCode]
    const field = LANGUAGE_SETTING_FIELD_MAP[item.name]
    if (!languageValues || !field) {
      continue
    }

    languageValues[item.name] = normalizeValue(field, item.value)
    configuredNames[item.languageCode].push(item.name)
  }

  return {
    fields: LANGUAGE_SETTING_FIELDS,
    languages: languageCodes,
    settings,
    configuredNames
  }
}

async function refreshLanguageSettingsCache() {
  const languageSettingsList = await loadLanguageSettingsListFromDatabase()
  setLanguageSettingsCache(languageSettingsList)
  return cloneLanguageSettingsList(getLanguageSettingsCache())
}

async function ensureLanguageSettingsCache() {
  const cacheData = getLanguageSettingsCache()
  if (cacheData) {
    return cacheData
  }

  if (!languageSettingsCacheLoadPromise) {
    languageSettingsCacheLoadPromise = refreshLanguageSettingsCache()
  }

  try {
    await languageSettingsCacheLoadPromise
  } finally {
    languageSettingsCacheLoadPromise = null
  }

  return getLanguageSettingsCache()
}

async function getLanguageSettingsList() {
  const cacheData = await ensureLanguageSettingsCache()
  return cloneLanguageSettingsList(cacheData)
}

async function getLanguageSettings(languageCodeInput) {
  const languageCode = normalizeSupportedLanguageCode(languageCodeInput)
  const cacheData = await ensureLanguageSettingsCache()
  const values = cacheData.settings[languageCode] || buildDefaultValues()
  const configuredNames = cacheData.configuredNames[languageCode] || []

  return {
    values: { ...values },
    configuredNames: configuredNames.slice()
  }
}

async function isBlogLanguageEnabled(languageCodeInput) {
  const languageCode = normalizeSupportedLanguageCode(languageCodeInput)
  const cacheData = await ensureLanguageSettingsCache()
  const values = cacheData.settings[languageCode] || buildDefaultValues()

  return values.blogLanguageEnabled === true
}

async function getBlogEnabledLanguageCodes() {
  const cacheData = await ensureLanguageSettingsCache()
  const enabledLanguageCodes = []
  for (const languageCode of cacheData.languages) {
    const values = cacheData.settings[languageCode]
    if (values && values.blogLanguageEnabled === true) {
      enabledLanguageCodes.push(languageCode)
    }
  }

  return enabledLanguageCodes
}

function applyLanguageSettingsCacheUpdate(languageCode, updateItems) {
  const cacheData = getLanguageSettingsCache()
  if (!cacheData) {
    return false
  }

  if (!cacheData.settings[languageCode]) {
    cacheData.settings[languageCode] = buildDefaultValues()
  }
  if (!cacheData.configuredNames[languageCode]) {
    cacheData.configuredNames[languageCode] = []
  }

  for (const item of updateItems) {
    cacheData.settings[languageCode][item.name] = item.value
    if (!cacheData.configuredNames[languageCode].includes(item.name)) {
      cacheData.configuredNames[languageCode].push(item.name)
    }
  }
  cacheData.updatedAt = new Date()
  return true
}

async function updateLanguageSettings(body = {}) {
  const languageCode = normalizeSupportedLanguageCode(body.languageCode)
  const values = body.values || {}
  if (typeof values !== 'object' || Array.isArray(values)) {
    throw new ApiError(ERROR_CODES.SETTINGS_VALUES_INVALID)
  }

  const updateList = []
  Object.keys(values).forEach(name => {
    const field = LANGUAGE_SETTING_FIELD_MAP[name]
    if (!field) {
      throw new ApiError(ERROR_CODES.SETTINGS_FIELD_INVALID, undefined, name)
    }

    updateList.push({
      field,
      name,
      value: values[name]
    })
  })

  const OptionModel = getOptionModel()
  const result = []
  for (const item of updateList) {
    const serializedValue = serializeValue(item.field, item.value)
    const value = saveImageValue(languageCode, item.field, serializedValue)
    const record = await OptionModel.findOneAndUpdate(
      {
        scope: OPTION_SCOPE,
        languageCode,
        name: item.name
      },
      {
        value,
        scope: OPTION_SCOPE,
        languageCode,
        name: item.name
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    ).lean()

    result.push({
      name: record.name,
      value: normalizeValue(item.field, record.value),
      languageCode: record.languageCode,
      scope: record.scope
    })
  }

  const updatedValues = result.reduce((map, item) => {
    map[item.name] = item.value
    return map
  }, {})
  const cacheUpdated = applyLanguageSettingsCacheUpdate(languageCode, result)
  if (!cacheUpdated) {
    await refreshLanguageSettingsCache()
  }

  return {
    languageCode,
    values: updatedValues
  }
}

module.exports = {
  LANGUAGE_SETTING_FIELDS,
  getBlogEnabledLanguageCodes,
  getLanguageSettings,
  getLanguageSettingsList,
  isBlogLanguageEnabled,
  refreshLanguageSettingsCache,
  updateLanguageSettings
}
