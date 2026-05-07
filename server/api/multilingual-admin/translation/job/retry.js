const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function retryTranslationJob(req, res) {
  try {
    const data = await translationJobService.retryTranslationJob(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job retry fail')
  }
}
