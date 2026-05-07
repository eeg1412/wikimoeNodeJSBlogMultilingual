const translationJobService = require('../../services/translationJobService')
const handleApiError = require('../../handleApiError')

module.exports = async function deleteTranslationJob(req, res) {
  try {
    const data = await translationJobService.deleteTranslationJob(
      {
        ...req.query,
        ...req.body
      },
      { admin: req.admin }
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job delete fail')
  }
}
