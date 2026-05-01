const translationAiSkipService = require('../../services/translationAiSkipService')
const handleApiError = require('../../handleApiError')

module.exports = async function updateTranslationAiSkip(req, res) {
  try {
    const data = await translationAiSkipService.updateTranslationAiSkip(
      req.body
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation ai skip update fail')
  }
}
