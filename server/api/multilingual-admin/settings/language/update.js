const languageSettingsService = require('../../services/languageSettingsService')
const rssUtils = require('../../../../utils/rss')
const sitemapUtils = require('../../../../utils/sitemap')
const {
  handleApiError
} = require('../../../../utils/multilingualAdminResponse')

module.exports = async function (req, res) {
  try {
    const data = await languageSettingsService.updateLanguageSettings(req.body)
    await rssUtils.reflushLanguageRSS(data.languageCode)
    await sitemapUtils.reflushLanguageSitemap(data.languageCode)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
