const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function batchCreateTranslationJob(req, res) {
  try {
    const data = await translationJobService.createTranslationJobBatch(
      req.body,
      {
        admin: req.admin
      }
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job batch create fail')
  }
}
