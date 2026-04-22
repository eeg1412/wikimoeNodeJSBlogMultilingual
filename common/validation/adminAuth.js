const Joi = require('joi')

const adminLoginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(64).required(),
  password: Joi.string().min(1).max(256).required(),
  remember: Joi.boolean().default(false)
})

module.exports = {
  adminLoginSchema
}
