const Joi = require('joi')

const { SUPPORTED_LANGUAGE_CODES } = require('../constants/app')

const importPostSchema = Joi.object({
  sourceIdentifier: Joi.string().trim().max(64).required(),
  languageCode: Joi.string()
    .trim()
    .valid(...SUPPORTED_LANGUAGE_CODES)
    .required(),
  confirmOverwrite: Joi.boolean().default(false)
})

module.exports = {
  importPostSchema
}
