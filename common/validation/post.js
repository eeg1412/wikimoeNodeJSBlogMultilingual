const { Joi, objectId, languageCode, translationStatus } = require('./common')
const {
  POST_STATUS_DRAFT,
  POST_STATUS_PUBLISHED,
  POST_STATUS_TRASH,
  IMPORTABLE_POST_TYPES
} = require('../constants/postTypes')

const postStatus = Joi.number().valid(
  POST_STATUS_DRAFT,
  POST_STATUS_PUBLISHED,
  POST_STATUS_TRASH
)

const postUpdateSchema = Joi.object({
  _id: objectId.required(),
  title: Joi.string().allow('').max(512),
  excerpt: Joi.string().allow('').max(4000),
  content: Joi.string().allow(''),
  alias: Joi.string().allow(null, '').max(128),
  date: Joi.date(),
  status: postStatus,
  type: Joi.number().valid(...IMPORTABLE_POST_TYPES),
  template: Joi.string().allow(''),
  code: Joi.string().allow(''),
  coverImages: Joi.array().items(objectId),
  author: objectId.allow(null),
  sort: objectId.allow(null),
  tags: Joi.array().items(objectId),
  mappointList: Joi.array().items(objectId),
  bangumiList: Joi.array().items(objectId),
  movieList: Joi.array().items(objectId),
  gameList: Joi.array().items(objectId),
  bookList: Joi.array().items(objectId),
  postList: Joi.array().items(objectId),
  tweetList: Joi.array().items(objectId),
  eventList: Joi.array().items(objectId),
  voteList: Joi.array().items(objectId),
  seriesSortList: Joi.array().items(Joi.string()),
  contentBangumiList: Joi.array().items(objectId),
  contentMovieList: Joi.array().items(objectId),
  contentGameList: Joi.array().items(objectId),
  contentBookList: Joi.array().items(objectId),
  contentPostList: Joi.array().items(objectId),
  contentTweetList: Joi.array().items(objectId),
  contentEventList: Joi.array().items(objectId),
  contentVoteList: Joi.array().items(objectId),
  contentSeriesSortList: Joi.array().items(Joi.string()),
  translationStatus: translationStatus,
  isManualEdited: Joi.boolean()
}).unknown(false)

const postListQuerySchema = Joi.object({
  languageCode: languageCode,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  type: Joi.number().valid(...IMPORTABLE_POST_TYPES),
  status: postStatus,
  keyword: Joi.string().allow('').max(128),
  sort: objectId,
  tag: objectId,
  mappoint: objectId,
  groupSourceId: Joi.string()
})

const postPublishSchema = Joi.object({
  _id: objectId.required()
})

module.exports = {
  postUpdateSchema,
  postListQuerySchema,
  postPublishSchema
}
