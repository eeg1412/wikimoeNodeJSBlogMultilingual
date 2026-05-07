const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function listTranslationJobs(req, res) {
  try {
    const data = await translationJobService.listTranslationJobs(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job list fail')
  }
}
