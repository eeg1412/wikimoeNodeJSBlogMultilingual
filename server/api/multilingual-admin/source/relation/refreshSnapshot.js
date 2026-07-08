const importPostSourceService = require('../../services/importPostSourceService')
const {
  handleApiError
} = require('../../../../utils/multilingualAdminResponse')

module.exports = async function (req, res) {
  try {
    const data = await importPostSourceService.syncSourceRelationSnapshot(
      req.body
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
