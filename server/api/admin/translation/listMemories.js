const {
  translationMemoryListQuerySchema
} = require('@wikimoe-ml/common/validation')
const {
  listTranslationMemories
} = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * GET /api/admin/translation/memory/list
 */
module.exports = async function listMemoriesApi(req, res) {
  const { value, error } = translationMemoryListQuerySchema.validate(
    req.query || {},
    { abortEarly: false, stripUnknown: true, convert: true }
  )
  if (error) throw badRequest('参数校验失败', error.details)
  const data = await listTranslationMemories(value)
  res.json({ data })
}
