const { Joi, languageCode } = require('./common')

// 管理员登录
const adminLoginSchema = Joi.object({
  username: Joi.string().min(1).max(64).required(),
  password: Joi.string().min(1).max(128).required()
})

// 导入文章
const importPostSchema = Joi.object({
  sourceIdentifier: Joi.string().trim().min(1).max(64).required(),
  languageCode: languageCode,
  confirmOverwrite: Joi.boolean().default(false)
})

module.exports = {
  adminLoginSchema,
  importPostSchema
}
