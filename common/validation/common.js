const Joi = require('joi')
const { SUPPORTED_LANGUAGE_CODES } = require('../constants/languages')
const { TRANSLATION_STATUS_VALUES } = require('../constants/translationStatus')
const { IMPORTABLE_POST_TYPES } = require('../constants/postTypes')

const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .message('非法的 ObjectId')

const languageCode = Joi.string()
  .valid(...SUPPORTED_LANGUAGE_CODES)
  .required()

const languageCodeOptional = Joi.string().valid(...SUPPORTED_LANGUAGE_CODES)

const translationStatus = Joi.string().valid(...TRANSLATION_STATUS_VALUES)

const importablePostType = Joi.number().valid(...IMPORTABLE_POST_TYPES)

module.exports = {
  Joi,
  objectId,
  languageCode,
  languageCodeOptional,
  translationStatus,
  importablePostType
}
