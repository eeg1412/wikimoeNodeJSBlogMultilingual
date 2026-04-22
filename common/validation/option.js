const Joi = require('joi')

const optionListSchema = Joi.object({
  namespace: Joi.string().trim().valid('system', 'site').optional(),
  keyword: Joi.string().trim().max(100).optional()
})

const optionUpdateItemSchema = Joi.object({
  fullKey: Joi.string().trim().required(),
  value: Joi.any().required()
})

const optionUpdateSchema = Joi.object({
  items: Joi.array().items(optionUpdateItemSchema).min(1).required()
})

module.exports = {
  optionListSchema,
  optionUpdateSchema
}
