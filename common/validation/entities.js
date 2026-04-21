const { Joi, objectId, translationStatus } = require('./common')

// 作者共享实体更新
const authorUpdateSchema = Joi.object({
  _id: objectId.required(),
  nickname: Joi.string().allow('').max(128),
  description: Joi.string().allow('').max(2000),
  photoAttachment: objectId.allow(null),
  coverAttachment: objectId.allow(null),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 分类
const sortUpdateSchema = Joi.object({
  _id: objectId.required(),
  sortname: Joi.string().allow('').max(128),
  alias: Joi.string().allow('', null).max(128),
  description: Joi.string().allow('').max(1000),
  template: Joi.string().allow(''),
  taxis: Joi.number().integer(),
  parent: objectId.allow(null),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 标签
const tagUpdateSchema = Joi.object({
  _id: objectId.required(),
  tagname: Joi.string().allow('').max(128),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 地点
const mappointUpdateSchema = Joi.object({
  _id: objectId.required(),
  title: Joi.string().allow('').max(256),
  summary: Joi.string().allow('').max(2000),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 附件更新（名称/描述可翻译；localized 还允许替换 storagePath/filepath/filename）
const attachmentUpdateSchema = Joi.object({
  _id: objectId.required(),
  name: Joi.string().allow('').max(256),
  description: Joi.string().allow('').max(2000),
  filename: Joi.string().max(512),
  filepath: Joi.string().max(1024),
  storagePath: Joi.string().max(1024),
  width: Joi.number().integer().allow(null),
  height: Joi.number().integer().allow(null),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 关联实体更新（bangumi/movie/game/book/event/vote 通用）
const relatedEntityUpdateSchema = Joi.object({
  _id: objectId.required(),
  payload: Joi.object().unknown(true).required(),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

// 站点 option 更新
const optionUpdateSchema = Joi.object({
  key: Joi.string().min(1).max(128).required(),
  value: Joi.any().required()
})

module.exports = {
  authorUpdateSchema,
  sortUpdateSchema,
  tagUpdateSchema,
  mappointUpdateSchema,
  attachmentUpdateSchema,
  relatedEntityUpdateSchema,
  optionUpdateSchema
}
