const mediaSettingsService = require('../../services/mediaSettingsService')
const handleApiError = require('../../handleApiError')

module.exports = async function getMediaSettings(req, res) {
  try {
    const data = await mediaSettingsService.getMediaSettings()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'get media settings fail')
  }
}
