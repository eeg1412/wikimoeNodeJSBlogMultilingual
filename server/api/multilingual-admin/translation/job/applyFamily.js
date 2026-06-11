const translationPayloadApplyService = require('../../services/translationPayloadApplyService')
const handleApiError = require('../../handleApiError')

module.exports = async function applyTranslationFamily(req, res) {
  try {
    const data =
      await translationPayloadApplyService.applyTranslationFamilyPayload(
        req.body,
        { admin: req.admin }
      )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation family apply fail')
  }
}
