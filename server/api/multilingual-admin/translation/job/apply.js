const translationPayloadApplyService = require('../../services/translationPayloadApplyService')
const handleApiError = require('../../handleApiError')

module.exports = async function applyTranslationJob(req, res) {
  try {
    const data =
      await translationPayloadApplyService.applyTranslationJobPayload(
        req.body,
        { admin: req.admin }
      )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job apply fail')
  }
}
