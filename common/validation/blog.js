const Joi = require('joi')
const { ALLOWED_POST_TYPES } = require('../constants')
const { idOrAliasSchema, languageCodeSchema, paginationSchema } = require('./shared')

const postListQuerySchema = paginationSchema.keys({
  lang: languageCodeSchema,
  type: Joi.number().valid(...ALLOWED_POST_TYPES).optional(),
  sort: Joi.string().allow('', null),
  tag: Joi.string().allow('', null),
  mappoint: Joi.string().allow('', null),
  archive: Joi.string().allow('', null)
})

const postDetailQuerySchema = Joi.object({
  lang: languageCodeSchema,
  id: idOrAliasSchema.required()
})

const entityDetailQuerySchema = Joi.object({
  lang: languageCodeSchema,
  id: idOrAliasSchema.required()
})

module.exports = {
  entityDetailQuerySchema,
  postDetailQuerySchema,
  postListQuerySchema
}