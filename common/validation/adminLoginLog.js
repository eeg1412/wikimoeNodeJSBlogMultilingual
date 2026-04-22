const Joi = require('joi')

const adminLoginLogListSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  username: Joi.string().trim().max(100).allow('').optional(),
  success: Joi.boolean().optional()
})

module.exports = {
  adminLoginLogListSchema
}
