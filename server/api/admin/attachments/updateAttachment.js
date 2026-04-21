const { attachmentUpdateSchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const { updateAttachmentMeta } = require('../../../services/attachmentService')

module.exports = async function updateAttachmentApi(req, res) {
  const { value, error } = attachmentUpdateSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)
  const data = await updateAttachmentMeta(value._id, value)
  res.json({ data })
}
