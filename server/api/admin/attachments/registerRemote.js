const {
  registerRemoteAttachmentSchema
} = require('@wikimoe-ml/common/validation')
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')
const { badRequest } = require('../../../utils/errors')
const {
  registerRemoteAttachment
} = require('../../../services/attachmentService')

module.exports = async function registerRemoteApi(req, res) {
  const { value, error } = registerRemoteAttachmentSchema.validate(
    req.body || {},
    { abortEarly: false, stripUnknown: true }
  )
  if (error) throw badRequest('参数校验失败', error.details)
  if (!SUPPORTED_LANGUAGE_CODES.includes(value.languageCode)) {
    throw badRequest('languageCode 无效')
  }
  const data = await registerRemoteAttachment(value)
  res.json({ data })
}
