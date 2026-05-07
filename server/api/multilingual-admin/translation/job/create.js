const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function createTranslationJob(req, res) {
  try {
    const data = await translationJobService.createTranslationJob(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job create fail')
  }
}
