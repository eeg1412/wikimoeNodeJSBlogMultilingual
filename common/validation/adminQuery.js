const {
  Joi,
  objectId,
  languageCodeOptional,
  translationStatus
} = require('./common')
const {
  ATTACHMENT_SOURCE_TYPE_VALUES
} = require('../constants/attachmentSourceTypes')

// 通用分页 + 语言过滤
const paging = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  keyword: Joi.string().allow('').max(128),
  languageCode: languageCodeOptional,
  translationStatus: translationStatus
}

const attachmentListQuerySchema = Joi.object({
  ...paging,
  attachmentSourceType: Joi.string().valid(...ATTACHMENT_SOURCE_TYPE_VALUES),
  mimetypePrefix: Joi.string().max(64),
  ids: Joi.string().max(2048) // 逗号分隔 ObjectId
})

const registerRemoteAttachmentSchema = Joi.object({
  sourcePath: Joi.string().max(1024),
  externalUrl: Joi.string().uri().max(2048),
  languageCode: Joi.string().required(),
  filename: Joi.string().allow('').max(512),
  name: Joi.string().allow('').max(256),
  description: Joi.string().allow('').max(2000),
  mimetype: Joi.string().allow('').max(128),
  width: Joi.number().integer().allow(null),
  height: Joi.number().integer().allow(null)
})
  .or('sourcePath', 'externalUrl')
  .unknown(false)

// 实体通用列表查询
const entityListQuerySchema = Joi.object({
  ...paging
})

// 文章发布校验查询（只读接口）
const postIdParamSchema = Joi.object({
  _id: objectId.required()
})

module.exports = {
  attachmentListQuerySchema,
  registerRemoteAttachmentSchema,
  entityListQuerySchema,
  postIdParamSchema
}
