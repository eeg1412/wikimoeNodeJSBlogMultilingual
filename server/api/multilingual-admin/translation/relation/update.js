const relationService = require('../../services/relationService')
const handleApiError = require('../../handleApiError')

module.exports = async function updateRelation(req, res) {
  try {
    const data = await relationService.updateRelation(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation relation update fail')
  }
}
