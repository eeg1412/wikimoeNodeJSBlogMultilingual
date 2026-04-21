const { DEFAULT_LANGUAGE_CODE } = require('../../common/constants')

module.exports = {
  siteTitle: 'Wikimoe Multilingual',
  siteSubTitle: 'Independent multilingual companion site',
  siteDescription: 'A multilingual mirror for imported blog posts and tweets.',
  siteKeywords: 'blog,multilingual,wikimoe',
  siteUrl: 'http://127.0.0.1:3101',
  siteLogo: '',
  siteDarkLogo: '',
  siteFavicon: '/favicon.ico',
  siteFooterInfo: 'Powered by Wikimoe Multilingual',
  siteExtraCss: '',
  siteExtraJs: '',
  siteThemeMode: 'system',
  siteAllowSwitchTheme: true,
  sitePageSize: 12,
  siteTimeZone: 'Asia/Shanghai',
  siteShowBlogVersion: true,
  siteEnableSitemap: true,
  siteRobotsTxt: 'User-agent: *\nAllow: /',
  siteDefaultLanguageCode: DEFAULT_LANGUAGE_CODE,
  googleAdEnabled: false,
  googleAdId: '',
  googleAdPostBottomEnabled: false,
  googleAdPostBottomParams: {},
  AdAdsTxt: '',
  translationSystemPrompt:
    'You are translating blog content. Return tool calls only and preserve meaning, structure, and style.',
  translationHtmlBatchMaxSegments: 80,
  translationHtmlBatchMaxChars: 6000,
  translationRetryLimit: 2
}