const { objectId } = require('@wikimoe-ml/common/validation')
const { getEntity } = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * GET /api/admin/entity/:type/detail?_id=xxx
 */
module.exports = async function getEntityApi(req, res) {
  const type = req.params.type
  const id = req.query && req.query._id
  const { error } = objectId.required().validate(id)
  if (error) throw badRequest('_id 非法')
  const data = await getEntity(type, id)
  res.json({ data })
}
