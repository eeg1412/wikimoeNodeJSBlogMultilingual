const { postPublishSchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const { publishPost } = require('../../../services/publishValidationService')

module.exports = async function publishPostApi(req, res) {
  const { value, error } = postPublishSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)
  const operatorAdminId = req.admin && req.admin._id ? req.admin._id : null
  const result = await publishPost(value._id, operatorAdminId)
  res.json({ data: result })
}
