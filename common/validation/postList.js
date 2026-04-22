const Joi = require('joi')

const postListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  languageCode: Joi.string().trim().valid('en', 'jp', 'tw').optional(),
  status: Joi.number().valid(0, 1, 99).optional(),
  keyword: Joi.string().trim().max(100).allow('').optional()
})

module.exports = {
  postListSchema
}
