const { importPostSchema } = require('@wikimoe-ml/common/validation')
const { importPost } = require('../../../services/importService')

module.exports = async function importPostApi(req, res) {
  const { value, error } = importPostSchema.validate(req.body || {}, {
    abortEarly: false
  })
  if (error) throw error

  const adminId = req.admin && req.admin._id ? String(req.admin._id) : null

  const result = await importPost({
    sourceIdentifier: value.sourceIdentifier,
    languageCode: value.languageCode,
    confirmOverwrite: value.confirmOverwrite,
    operatorAdminId: adminId
  })

  res.json({ data: result })
}
