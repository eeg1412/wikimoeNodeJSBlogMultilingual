const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function createRelationTranslation(req, res) {
  try {
    const data = await translationPostService.createMissingPostRelationTranslation(
      req.body
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'create relation translation post fail')
  }
}
