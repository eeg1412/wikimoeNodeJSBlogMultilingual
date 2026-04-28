const relationService = require('../../services/relationService')
const {
  handleApiError
} = require('../../../../utils/multilingualAdminResponse')

module.exports = async function (req, res) {
  try {
    const data = await relationService.listRelations({
      ...req.query,
      recordKind: 'source'
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
