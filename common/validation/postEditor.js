const Joi = require('joi')

const postDetailSchema = Joi.object({
  id: Joi.string().trim().required()
})

const postUpdateSchema = Joi.object({
  id: Joi.string().trim().required(),
  title: Joi.string().allow('').required(),
  alias: Joi.string().trim().allow('').required(),
  excerpt: Joi.string().allow('').required(),
  content: Joi.string().allow('').required(),
  date: Joi.date().allow(null).required(),
  status: Joi.number().valid(0, 1, 99).required(),
  type: Joi.number().valid(1, 2).required(),
  allowRemark: Joi.boolean().required(),
  author: Joi.string().trim().allow(null, '').required(),
  sort: Joi.string().trim().allow(null, '').required(),
  tags: Joi.array().items(Joi.string().trim()).required(),
  mappointList: Joi.array().items(Joi.string().trim()).required(),
  template: Joi.string().allow('').required(),
  code: Joi.string().allow('').required(),
  editorVersion: Joi.number().valid(5).required()
})

module.exports = {
  postDetailSchema,
  postUpdateSchema
}
