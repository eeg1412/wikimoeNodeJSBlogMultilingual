const Joi = require('joi')
const { ALLOWED_POST_TYPES, POST_STATUS, TRANSLATION_STATUS_LIST } = require('../constants')
const {
  attachmentSourceTypeSchema,
  idOrAliasSchema,
  languageCodeSchema,
  paginationSchema,
  translationStatusSchema
} = require('./shared')

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(6).max(120).required(),
  remember: Joi.boolean().default(false)
})

const importPostSchema = Joi.object({
  sourceIdentifier: idOrAliasSchema.required(),
  languageCode: languageCodeSchema,
  confirmOverwrite: Joi.boolean().default(false)
})

const postListSchema = paginationSchema.keys({
  type: Joi.number().valid(...ALLOWED_POST_TYPES).optional(),
  groupSourceId: Joi.string().allow('', null),
  sourceId: Joi.string().allow('', null),
  sort: Joi.string().allow('', null),
  tag: Joi.string().allow('', null)
})

const groupListSchema = paginationSchema.keys({
  type: Joi.number().valid(...ALLOWED_POST_TYPES).optional(),
  publishDateStart: Joi.date().iso().optional(),
  publishDateEnd: Joi.date().iso().optional()
})

const relationRefSchema = Joi.object({
  _id: Joi.string().required(),
  sourceId: Joi.string().allow('', null),
  languageCode: languageCodeSchema.optional(),
  translationStatus: translationStatusSchema.optional(),
  attachmentSourceType: attachmentSourceTypeSchema.optional(),
  sourceOptionId: Joi.string().allow('', null)
})

const attachmentRefSchema = relationRefSchema.keys({
  attachmentSourceType: attachmentSourceTypeSchema.required()
})

const postUpdateSchema = Joi.object({
  id: Joi.string().required(),
  status: Joi.number().valid(...Object.values(POST_STATUS)).optional(),
  title: Joi.string().allow('').max(500).required(),
  excerpt: Joi.string().allow('').required(),
  content: Joi.string().allow('').required(),
  alias: Joi.string().trim().min(1).max(120).required(),
  date: Joi.date().iso().required(),
  lastChangDate: Joi.date().iso().allow(null),
  translationStatus: Joi.string().valid(...TRANSLATION_STATUS_LIST).optional(),
  author: relationRefSchema.allow(null),
  sort: relationRefSchema.allow(null),
  tags: Joi.array().items(relationRefSchema).default([]),
  mappointList: Joi.array().items(relationRefSchema).default([]),
  coverImages: Joi.array().items(attachmentRefSchema).default([]),
  bangumiList: Joi.array().items(relationRefSchema).default([]),
  movieList: Joi.array().items(relationRefSchema).default([]),
  gameList: Joi.array().items(relationRefSchema).default([]),
  bookList: Joi.array().items(relationRefSchema).default([]),
  postList: Joi.array().items(relationRefSchema).default([]),
  tweetList: Joi.array().items(relationRefSchema).default([]),
  eventList: Joi.array().items(relationRefSchema).default([]),
  voteList: Joi.array().items(relationRefSchema).default([]),
  seriesSortList: Joi.array().items(relationRefSchema).default([]),
  contentBangumiList: Joi.array().items(relationRefSchema).default([]),
  contentMovieList: Joi.array().items(relationRefSchema).default([]),
  contentGameList: Joi.array().items(relationRefSchema).default([]),
  contentBookList: Joi.array().items(relationRefSchema).default([]),
  contentPostList: Joi.array().items(relationRefSchema).default([]),
  contentTweetList: Joi.array().items(relationRefSchema).default([]),
  contentEventList: Joi.array().items(relationRefSchema).default([]),
  contentVoteList: Joi.array().items(relationRefSchema).default([]),
  contentSeriesSortList: Joi.array().items(relationRefSchema).default([]),
  validationState: Joi.object().default({}),
  publishMeta: Joi.object().default({})
})

const publishSchema = Joi.object({
  id: Joi.string().required()
})

const translateFieldSchema = Joi.object({
  entityType: Joi.string().trim().required(),
  entityId: Joi.string().required(),
  languageCode: languageCodeSchema,
  fieldPath: Joi.string().trim().required(),
  sourceText: Joi.string().allow('').required()
})

const translateHtmlSchema = Joi.object({
  entityType: Joi.string().trim().required(),
  entityId: Joi.string().required(),
  languageCode: languageCodeSchema,
  fieldPath: Joi.string().trim().default('content'),
  html: Joi.string().allow('').required()
})

const translateAllSchema = Joi.object({
  entityType: Joi.string().trim().required(),
  entityId: Joi.string().required(),
  languageCode: languageCodeSchema,
  fieldPaths: Joi.array().items(Joi.string().trim()).min(1).required()
})

const entityUpdateSchema = Joi.object({
  id: Joi.string().required(),
  languageCode: languageCodeSchema,
  translationStatus: translationStatusSchema.optional(),
  isManualEdited: Joi.boolean().optional(),
  sourceSnapshot: Joi.object().optional(),
  sourceHash: Joi.string().allow('', null).optional()
}).unknown(true)

const localizedAttachmentUploadSchema = Joi.object({
  attachmentGroupKey: Joi.string().trim().required(),
  languageCode: languageCodeSchema,
  name: Joi.string().allow('').max(255).default(''),
  description: Joi.string().allow('').default('')
})

const optionUpdateSchema = Joi.object({
  key: Joi.string().trim().required(),
  value: Joi.any().required()
})

module.exports = {
  entityUpdateSchema,
  groupListSchema,
  importPostSchema,
  localizedAttachmentUploadSchema,
  loginSchema,
  optionUpdateSchema,
  postListSchema,
  postUpdateSchema,
  publishSchema,
  translateAllSchema,
  translateFieldSchema,
  translateHtmlSchema
}