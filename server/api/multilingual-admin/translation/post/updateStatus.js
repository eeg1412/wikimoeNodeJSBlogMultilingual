const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function updateStatus(req, res) {
  try {
    const body = {
      ...req.body,
      id: req.body.id || req.query.id
    }
    const data = await translationPostService.updateTranslationPostStatus(body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post status update fail')
  }
}
