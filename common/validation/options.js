const { Joi } = require('./common')
const { SUPPORTED_LANGUAGE_CODES } = require('../constants/languages')

// 每个 key 对应的校验规则，集中在这里维护
const optionSchemas = {
  siteTitle: Joi.string().allow('').max(256),
  siteSubTitle: Joi.string().allow('').max(256),
  siteDescription: Joi.string().allow('').max(2000),
  siteKeywords: Joi.string().allow('').max(512),
  siteUrl: Joi.string().allow('').max(512),
  siteLogo: Joi.string().allow('').max(1024),
  siteDarkLogo: Joi.string().allow('').max(1024),
  siteFavicon: Joi.string().allow('').max(1024),
  siteFooterInfo: Joi.string().allow('').max(8000),
  siteExtraCss: Joi.string().allow('').max(20000),
  siteExtraJs: Joi.string().allow('').max(20000),
  siteThemeMode: Joi.string().valid('auto', 'light', 'dark'),
  siteAllowSwitchTheme: Joi.boolean(),
  sitePageSize: Joi.number().integer().min(1).max(200),
  siteTimeZone: Joi.string().allow('').max(64),
  siteShowBlogVersion: Joi.boolean(),
  siteEnableSitemap: Joi.boolean(),
  siteRobotsTxt: Joi.string().allow('').max(20000),
  siteDefaultLanguageCode: Joi.string().valid(...SUPPORTED_LANGUAGE_CODES),
  googleAdEnabled: Joi.boolean(),
  googleAdId: Joi.string().allow('').max(128),
  googleAdPostBottomEnabled: Joi.boolean(),
  googleAdPostBottomParams: Joi.object().unknown(true),
  AdAdsTxt: Joi.string().allow('').max(20000),
  translationSystemPrompt: Joi.string().allow('').max(20000),
  translationHtmlBatchMaxSegments: Joi.number().integer().min(1).max(500),
  translationHtmlBatchMaxChars: Joi.number().integer().min(100).max(200000),
  translationRetryLimit: Joi.number().integer().min(0).max(10)
}

const OPTION_KEYS = Object.keys(optionSchemas)

// 管理端批量更新：入参是 { updates: { key: value, ... } }
const optionUpdateSchema = Joi.object({
  updates: Joi.object()
    .pattern(Joi.string().valid(...OPTION_KEYS), Joi.any())
    .min(1)
    .required()
}).unknown(false)

function validateSingleOption(key, value) {
  const schema = optionSchemas[key]
  if (!schema) {
    return { error: { message: `unknown option: ${key}` } }
  }
  return schema.validate(value)
}

module.exports = {
  optionSchemas,
  optionUpdateSchema,
  OPTION_KEYS,
  validateSingleOption
}
