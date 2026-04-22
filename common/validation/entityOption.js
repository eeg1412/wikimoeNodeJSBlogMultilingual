const Joi = require('joi')

const entityOptionListSchema = Joi.object({
  type: Joi.string()
    .trim()
    .valid('authors', 'sorts', 'tags', 'mappoints')
    .required(),
  languageCode: Joi.string().trim().valid('en', 'jp', 'tw').required(),
  keyword: Joi.string().trim().max(100).allow('').optional()
})

module.exports = {
  entityOptionListSchema
}
