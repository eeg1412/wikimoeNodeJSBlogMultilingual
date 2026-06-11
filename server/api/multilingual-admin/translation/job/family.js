const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function getTranslationJobFamily(req, res) {
  try {
    const data = await translationJobService.getTranslationJobFamily(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job family fail')
  }
}
