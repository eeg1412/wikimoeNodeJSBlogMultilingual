const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function getTranslationJobDetail(req, res) {
  try {
    const data = await translationJobService.getTranslationJobDetail(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job detail fail')
  }
}
