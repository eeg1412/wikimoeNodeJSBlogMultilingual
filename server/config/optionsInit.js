import Option from '../mongodb/models/option.js'

/**
 * 默认 system.* 配置项
 * 除计划中已给出默认值的字段外，业务值（原站地址、模型名等）初始化为 null 或关闭状态
 */
const SYSTEM_DEFAULTS = {
  sourceBlogApiBaseUrl: null,
  sourceBlogPublicOrigin: null,
  sourceBlogRequestTimeoutMs: 10000,
  aiTranslationEnabled: false,
  aiProvider: 'google-genai',
  aiModel: null,
  aiApiKey: null,
  aiApiVersion: null,
  aiGatewayUrl: null,
  aiThinkingBudget: null,
  translationSystemPrompt: '',
  translationHtmlBatchMaxSegments: 80,
  translationHtmlBatchMaxChars: 6000,
  translationRetryLimit: 2,
  adminTokenDefaultTtlHours: 8,
  adminTokenRememberMeTtlDays: 30,
  adminLoginAttemptWindowMinutes: 15,
  adminLoginMaxAttempts: 5
}

/** 哪些 system key 是敏感字段（掩码回显） */
const SYSTEM_SECRET_KEYS = new Set(['aiApiKey'])

/**
 * 默认 site.* 配置项
 * 站点运营信息（标题、域名等）初始化为空，由后台填写
 * siteName / description 字段支持多语言，未填写时回退到默认值
 */
const SITE_DEFAULTS = {
  siteName: '',
  siteNameEn: '',
  siteNameJp: '',
  siteNameTw: '',
  description: '',
  descriptionEn: '',
  descriptionJp: '',
  descriptionTw: '',
  keywords: '',
  url: '',
  favicon: '',
  footerInfo: '',
  extraCss: '',
  extraJs: '',
  themeMode: 'system',
  allowSwitchTheme: true,
  pageSize: 10,
  timeZone: '',
  enableSitemap: false,
  robotsTxt: '',
  defaultLanguageCode: 'en',
  showBlogVersion: false,
  googleAdEnabled: false,
  googleAdClientId: '',
  googleAdPostBottomEnabled: false,
  googleAdPostBottomParams: '',
  adsTxtContent: ''
}

async function ensureOption(namespace, key, value, isSecret = false) {
  const exists = await Option.findOne({ namespace, key })
  if (!exists) {
    await Option.create({ namespace, key, value, isSecret })
  }
}

/**
 * 初始化 settings/options 数据库记录
 * 只写入不存在的键，不覆盖已有配置
 */
export async function initOptions() {
  for (const [key, value] of Object.entries(SYSTEM_DEFAULTS)) {
    const isSecret = SYSTEM_SECRET_KEYS.has(key)
    await ensureOption('system', key, value, isSecret)
  }
  for (const [key, value] of Object.entries(SITE_DEFAULTS)) {
    await ensureOption('site', key, value, false)
  }
  console.info('[Options] 系统配置初始化完成')
}

/**
 * 获取指定命名空间下所有配置，组装为键值对象
 * @param {'system'|'site'} namespace
 * @returns {Promise<object>}
 */
export async function getOptionsByNamespace(namespace) {
  const records = await Option.find({ namespace }).lean()
  const result = {}
  for (const r of records) {
    result[r.key] = r.value
  }
  return result
}

/**
 * 获取单个配置值
 * @param {'system'|'site'} namespace
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function getOptionValue(namespace, key) {
  const record = await Option.findOne({ namespace, key }).lean()
  return record ? record.value : null
}

/**
 * 更新单个配置值
 * @param {'system'|'site'} namespace
 * @param {string} key
 * @param {*} value
 * @param {string} operatorId
 */
export async function setOptionValue(namespace, key, value, operatorId = null) {
  await setOptionValues([{ namespace, key, value }], operatorId)
}

function shouldSkipMaskedSecret(namespace, key, value) {
  if (namespace !== 'system') {
    return false
  }
  if (!SYSTEM_SECRET_KEYS.has(key)) {
    return false
  }
  return value === '***'
}

/**
 * 批量更新配置值。
 * - 只发起一次数据库批量写入，避免前端逐字段调用接口。
 * - 对敏感字段的掩码占位符（***）执行跳过，防止误覆盖真实密钥。
 * @param {Array<{namespace: 'system'|'site', key: string, value: any}>} optionList
 * @param {string|null} operatorId
 */
export async function setOptionValues(optionList, operatorId = null) {
  const normalizedOptionList = (optionList || []).filter(item => {
    if (!item) {
      return false
    }
    return !shouldSkipMaskedSecret(item.namespace, item.key, item.value)
  })

  if (normalizedOptionList.length === 0) {
    return
  }

  await Option.bulkWrite(
    normalizedOptionList.map(item => ({
      updateOne: {
        filter: { namespace: item.namespace, key: item.key },
        update: {
          $set: {
            value: item.value,
            updatedBy: operatorId
          },
          $setOnInsert: {
            isSecret:
              item.namespace === 'system' && SYSTEM_SECRET_KEYS.has(item.key)
          }
        },
        upsert: true
      }
    }))
  )
}
