const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function getTranslationJobStorageSummary(req, res) {
  try {
    const data = await translationJobService.getTranslationJobStorageSummary()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job storage summary fail')
  }
}
