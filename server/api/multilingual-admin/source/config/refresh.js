const {
  refreshSourceConfigData
} = require('../../services/sourceConfigService')
const cacheDataUtils = require('../../../../config/cacheData')
const rssUtils = require('../../../../utils/rss')
const sitemapUtils = require('../../../../utils/sitemap')
const handleApiError = require('../../handleApiError')

module.exports = async function refreshSourceConfig(req, res) {
  try {
    const data = await refreshSourceConfigData()
    await cacheDataUtils.refreshAllLanguageCache()
    await rssUtils.reflushRSS()
    await sitemapUtils.reflushSitemap()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'refresh source config fail')
  }
}
