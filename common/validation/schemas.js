import Joi from 'joi'
import { SUPPORTED_LANGUAGES } from '../constants/index.js'

const languageCode = Joi.string().valid(...SUPPORTED_LANGUAGES)

// ────────────── 导入 ──────────────

export const importPostSchema = Joi.object({
  sourceIdentifier: Joi.string().trim().max(64),
  sourceUrl: Joi.string().trim().max(512),
  languageCode: languageCode.required(),
  confirmOverwrite: Joi.boolean().default(false)
}).or('sourceIdentifier', 'sourceUrl')

// ────────────── 登录 ──────────────

export const loginSchema = Joi.object({
  username: Joi.string().trim().max(64).required(),
  password: Joi.string().max(128).required(),
  rememberMe: Joi.boolean().default(false)
})

// ────────────── 文章更新 ──────────────

export const postUpdateSchema = Joi.object({
  title: Joi.string().allow('').max(500),
  excerpt: Joi.string().allow('').max(2000),
  content: Joi.string().allow(''),
  sort: Joi.string().allow('', null),
  author: Joi.string().allow('', null),
  tags: Joi.array().items(Joi.string()).default([]),
  coverImages: Joi.array().items(Joi.string()).default([]),
  alias: Joi.string()
    .allow('')
    .max(200)
    .pattern(/^[a-zA-Z0-9_-]*$/),
  date: Joi.date().allow(null),
  status: Joi.number().valid(0, 1, 99),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── 共享实体更新（通用） ──────────────

export const sharedEntityUpdateSchema = Joi.object({
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
})
  .unknown(true)
  .min(1)

// ────────────── 作者更新 ──────────────

export const authorUpdateSchema = Joi.object({
  nickname: Joi.string().allow('').max(200),
  description: Joi.string().allow('').max(2000),
  photoAttachment: Joi.string().allow(null, ''),
  coverAttachment: Joi.string().allow(null, ''),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── 分类更新 ──────────────

export const sortUpdateSchema = Joi.object({
  sortname: Joi.string().allow('').max(200),
  alias: Joi.string()
    .allow('')
    .max(200)
    .pattern(/^[a-zA-Z0-9_-]*$/),
  taxis: Joi.number().integer().min(0),
  description: Joi.string().allow('').max(2000),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── 标签更新 ──────────────

export const tagUpdateSchema = Joi.object({
  tagname: Joi.string().allow('').max(200),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── 地点更新 ──────────────

export const mappointUpdateSchema = Joi.object({
  title: Joi.string().allow('').max(200),
  summary: Joi.string().allow('').max(2000),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── 附件更新 ──────────────

export const attachmentUpdateSchema = Joi.object({
  name: Joi.string().allow('').max(500),
  description: Joi.string().allow('').max(2000),
  translationStatus: Joi.string().valid(
    'pending',
    'ai_draft',
    'manual_draft',
    'approved',
    'not_required',
    'stub',
    'outdated'
  ),
  isManualEdited: Joi.boolean()
}).min(1)

// ────────────── Option 更新 ──────────────

const optionUpdateItemSchema = Joi.object({
  namespace: Joi.string().valid('system', 'site').required(),
  key: Joi.string().required(),
  value: Joi.any().required()
})

export const optionUpdateSchema = Joi.alternatives().try(
  optionUpdateItemSchema,
  Joi.object({
    optionList: Joi.array().items(optionUpdateItemSchema).min(1).required()
  })
)

// ────────────── 翻译字段请求 ──────────────

export const translateFieldSchema = Joi.object({
  field: Joi.string().valid('title', 'excerpt', 'content'),
  fields: Joi.array()
    .items(Joi.string().valid('title', 'excerpt', 'content'))
    .min(1)
    .max(3),
  languageCode: languageCode.optional()
})

// ────────────── 列表查询（通用分页） ──────────────

export const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  languageCode: languageCode,
  keyword: Joi.string().allow('').max(100)
}).unknown(true)
