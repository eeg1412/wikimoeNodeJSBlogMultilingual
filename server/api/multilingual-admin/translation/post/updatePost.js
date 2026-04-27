const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function updatePost(req, res) {
  try {
    const body = {
      ...req.body,
      id: req.body.id || req.query.id
    }
    const data = await translationPostService.updateTranslationPost(body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post update fail')
  }
}
