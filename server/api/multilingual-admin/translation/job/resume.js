const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function resumeTranslationJob(req, res) {
  try {
    const data = await translationJobService.resumeTranslationJob(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job resume fail')
  }
}
