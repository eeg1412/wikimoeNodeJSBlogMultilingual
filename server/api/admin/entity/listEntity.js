const { entityListQuerySchema } = require('@wikimoe-ml/common/validation')
const { listEntities } = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * GET /api/admin/entity/:type/list?languageCode=&translationStatus=&keyword=&page=&limit=
 */
module.exports = async function listEntityApi(req, res) {
  const type = req.params.type
  const { value, error } = entityListQuerySchema.validate(req.query || {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  })
  if (error) throw badRequest('参数校验失败', error.details)
  const result = await listEntities(type, value)
  res.json({ data: result })
}
