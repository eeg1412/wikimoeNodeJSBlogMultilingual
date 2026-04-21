const { attachmentListQuerySchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const { listAttachments } = require('../../../services/attachmentService')

module.exports = async function listAttachmentsApi(req, res) {
  const { value, error } = attachmentListQuerySchema.validate(req.query || {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  })
  if (error) throw badRequest('参数校验失败', error.details)
  const data = await listAttachments(value)
  res.json({ data })
}
