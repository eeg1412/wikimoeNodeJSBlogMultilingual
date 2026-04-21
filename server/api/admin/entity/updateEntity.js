const { updateEntity } = require('../../../services/sharedEntityCrudService')

/**
 * POST /api/admin/entity/:type/update
 */
module.exports = async function updateEntityApi(req, res) {
  const type = req.params.type
  const data = await updateEntity(type, req.body || {})
  res.json({ data })
}
