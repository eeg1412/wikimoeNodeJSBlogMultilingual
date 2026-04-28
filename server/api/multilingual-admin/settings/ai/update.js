const aiSettingsService = require('../../services/aiSettingsService')
const handleApiError = require('../../handleApiError')

module.exports = async function updateAiSettings(req, res) {
  try {
    const data = await aiSettingsService.updateAiSettings(req.body.values || {})
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'update ai settings fail')
  }
}
