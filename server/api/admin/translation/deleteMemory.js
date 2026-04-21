const {
  translationMemoryDeleteSchema
} = require('@wikimoe-ml/common/validation')
const {
  deleteTranslationMemory
} = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * POST /api/admin/translation/memory/delete
 */
module.exports = async function deleteMemoryApi(req, res) {
  const { value, error } = translationMemoryDeleteSchema.validate(
    req.body || {},
    { abortEarly: false, stripUnknown: true }
  )
  if (error) throw badRequest('参数校验失败', error.details)
  await deleteTranslationMemory(value.id)
  res.json({ data: { deleted: true } })
}
