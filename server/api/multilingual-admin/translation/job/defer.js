const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function deferTranslationJob(req, res) {
  try {
    const data = await translationJobService.deferTranslationJob(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job defer fail')
  }
}
