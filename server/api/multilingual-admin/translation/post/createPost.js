const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function createPost(req, res) {
  try {
    const data = await translationPostService.createTranslationPost(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post create fail')
  }
}
