const { objectId } = require('@wikimoe-ml/common/validation')
const { approveEntity } = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * POST /api/admin/entity/:type/approve { _id }
 */
module.exports = async function approveEntityApi(req, res) {
  const type = req.params.type
  const id = req.body && req.body._id
  const { error } = objectId.required().validate(id)
  if (error) throw badRequest('_id 非法')
  const data = await approveEntity(type, id)
  res.json({ data })
}
