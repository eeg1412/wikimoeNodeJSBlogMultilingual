const languageSettingsService = require('../../services/languageSettingsService')
const {
  handleApiError
} = require('../../../../utils/multilingualAdminResponse')

module.exports = async function (req, res) {
  try {
    const data = await languageSettingsService.getLanguageSettingsList()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
