const { badRequest } = require('../../../utils/errors')
const { deleteAttachment } = require('../../../services/attachmentService')
const { postIdParamSchema } = require('@wikimoe-ml/common/validation')

module.exports = async function deleteAttachmentApi(req, res) {
  const { value, error } = postIdParamSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)
  const data = await deleteAttachment(value._id)
  res.json({ data })
}
