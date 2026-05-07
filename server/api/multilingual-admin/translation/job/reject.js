const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function rejectTranslationJob(req, res) {
  try {
    const data = await translationJobService.rejectTranslationJob(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job reject fail')
  }
}
