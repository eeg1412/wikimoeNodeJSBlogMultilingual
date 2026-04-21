const { getAllOptions } = require('../../utils/options')

// 前台读取站点 options。注意：翻译提示、AI 模型等不下发给前台。
const PUBLIC_OPTION_KEYS = [
  'siteTitle',
  'siteSubTitle',
  'siteDescription',
  'siteKeywords',
  'siteUrl',
  'siteLogo',
  'siteDarkLogo',
  'siteFavicon',
  'siteFooterInfo',
  'siteExtraCss',
  'siteExtraJs',
  'siteThemeMode',
  'siteAllowSwitchTheme',
  'sitePageSize',
  'siteTimeZone',
  'siteShowBlogVersion',
  'siteEnableSitemap',
  'siteDefaultLanguageCode',
  'googleAdEnabled',
  'googleAdId',
  'googleAdPostBottomEnabled',
  'googleAdPostBottomParams'
]

module.exports = async function getOptions(req, res) {
  const all = await getAllOptions()
  const data = {}
  for (const key of PUBLIC_OPTION_KEYS) {
    data[key] = all[key]
  }
  res.json({ data })
}
