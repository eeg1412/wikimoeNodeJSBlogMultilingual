const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function getPostDetail(req, res) {
  try {
    const data = await translationPostService.getTranslationPostDetail(
      req.query.id
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post detail get fail')
  }
}
