const languageSettingsService = require('../../multilingual-admin/services/languageSettingsService')
const {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCode
} = require('../../../utils/language')

module.exports = async function (req, res, next) {
  try {
    const languageCode =
      normalizeLanguageCode(req.query.languageCode) || DEFAULT_LANGUAGE_CODE
    const result =
      await languageSettingsService.getLanguageSettings(languageCode)

    res.send({
      data: result.values,
      meta: {
        configuredNames: result.configuredNames
      }
    })
  } catch (error) {
    next(error)
  }
}
