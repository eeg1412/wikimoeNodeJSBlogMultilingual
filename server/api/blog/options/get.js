import { getSiteConfig } from '../../../config/globalConfig.js'
import { SUPPORTED_LANGUAGES } from '../../../../common/constants/index.js'

export default async function blogOptionsHandler(req, res, next) {
  try {
    const siteConfig = getSiteConfig()

    return res.json({
      data: {
        siteName: siteConfig.siteName || '',
        siteDescription: siteConfig.siteDescription || '',
        supportedLanguages: SUPPORTED_LANGUAGES,
        defaultLanguage: siteConfig.defaultLanguageCode || 'en'
      }
    })
  } catch (err) {
    next(err)
  }
}
