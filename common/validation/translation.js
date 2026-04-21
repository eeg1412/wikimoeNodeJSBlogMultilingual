const { Joi, objectId, languageCode } = require('./common')

// 通用文本翻译（不绑定实体，主要供后台编辑器调试/就地翻译）
const translateTextSchema = Joi.object({
  sourceText: Joi.string().allow('').max(20000).required(),
  targetLanguageCode: languageCode,
  fieldKind: Joi.string().min(1).max(64).required(),
  context: Joi.string().allow('').max(500).default(''),
  entityType: Joi.string().max(32).allow(''),
  entityId: objectId.allow(null),
  fieldPath: Joi.string().max(128).allow('')
})

// 通用 HTML 正文翻译
const translateHtmlRawSchema = Joi.object({
  html: Joi.string()
    .allow('')
    .max(1024 * 1024)
    .required(),
  targetLanguageCode: languageCode,
  fieldKind: Joi.string().min(1).max(64).default('html_segment'),
  context: Joi.string().allow('').max(500).default(''),
  entityType: Joi.string().max(32).allow(''),
  entityId: objectId.allow(null),
  fieldPath: Joi.string().max(128).allow('')
})

// 翻译记忆审批
const approveTranslationMemorySchema = Joi.object({
  id: objectId.required(),
  approved: Joi.boolean().required(),
  translatedText: Joi.string().allow('').max(20000)
})

const ENTITY_TYPE_VALUES = [
  'post',
  'author',
  'sort',
  'tag',
  'mappoint',
  'attachment',
  'bangumi',
  'movie',
  'game',
  'book',
  'event',
  'vote'
]

// 翻译单字段
const translateFieldSchema = Joi.object({
  entityType: Joi.string()
    .valid(...ENTITY_TYPE_VALUES)
    .required(),
  entityId: objectId.required(),
  fieldPath: Joi.string().min(1).max(128).required(),
  languageCode: languageCode
})

// 翻译 HTML 正文（目前仅 post 使用）
const translateHtmlSchema = Joi.object({
  entityType: Joi.string().valid('post').required(),
  entityId: objectId.required(),
  languageCode: languageCode
})

// 一键翻译整篇
const translateAllSchema = Joi.object({
  entityType: Joi.string().valid('post').required(),
  entityId: objectId.required(),
  languageCode: languageCode,
  fields: Joi.array().items(Joi.string()).default([])
})

// 翻译记忆后台列表查询
const translationMemoryListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  targetLanguageCode: Joi.string().allow(''),
  fieldKind: Joi.string().allow('').max(64),
  approved: Joi.string().valid('true', 'false', ''),
  keyword: Joi.string().allow('').max(256)
})

// 删除翻译记忆
const translationMemoryDeleteSchema = Joi.object({
  id: objectId.required()
})

// 共享实体 AI 翻译（按字段集合）
const entityTranslateFieldsSchema = Joi.object({
  _id: objectId.required(),
  fields: Joi.array().items(Joi.string().max(128)).min(1)
})

module.exports = {
  translateTextSchema,
  translateHtmlRawSchema,
  approveTranslationMemorySchema,
  translateFieldSchema,
  translateHtmlSchema,
  translateAllSchema,
  translationMemoryListQuerySchema,
  translationMemoryDeleteSchema,
  entityTranslateFieldsSchema,
  ENTITY_TYPE_VALUES
}
