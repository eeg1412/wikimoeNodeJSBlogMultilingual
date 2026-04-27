const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function getPostListBySource(req, res) {
  try {
    const data = await translationPostService.getTranslationPostListBySource(
      req.query
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post list by source get fail')
  }
}
