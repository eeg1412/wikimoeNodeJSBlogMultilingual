const cacheDataUtils = require('../config/cacheData')
const rssToolUtils = require('./rss')
const sitemapToolUtils = require('./sitemap')
const utils = require('./utils')
const {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCode
} = require('./language')

async function refreshArticlePublishing(languageCodeInput = DEFAULT_LANGUAGE_CODE) {
  const languageCode = normalizeLanguageCode(languageCodeInput)
  if (!languageCode) {
    throw new Error('LANGUAGE_CODE_UNSUPPORTED')
  }

  await utils.executeInLock(`articlePublishingRefresh:${languageCode}`, async () => {
    await cacheDataUtils.refreshLanguageCache(languageCode)
    await rssToolUtils.reflushLanguageRSS(languageCode)
    await sitemapToolUtils.reflushLanguageSitemap(languageCode)
  })
}

module.exports = {
  refreshArticlePublishing
}
