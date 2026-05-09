const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function batchDeleteTranslationJobs(req, res) {
  try {
    const data = await translationJobService.batchDeleteTranslationJobs(
      req.body,
      { admin: req.admin }
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job batch delete fail')
  }
}
