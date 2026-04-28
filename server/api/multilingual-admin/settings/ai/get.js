const aiSettingsService = require('../../services/aiSettingsService')
const handleApiError = require('../../handleApiError')

module.exports = async function getAiSettings(req, res) {
  try {
    const data = await aiSettingsService.getAiSettings()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'get ai settings fail')
  }
}
