const mediaSettingsService = require('../../services/mediaSettingsService')
const handleApiError = require('../../handleApiError')

module.exports = async function updateMediaSettings(req, res) {
  try {
    const data = await mediaSettingsService.updateMediaSettings(
      req.body.values || {}
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'update media settings fail')
  }
}
