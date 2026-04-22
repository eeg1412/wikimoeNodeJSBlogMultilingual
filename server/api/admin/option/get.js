import { getSystemConfig, getSiteConfig } from '../../../config/globalConfig.js'

export default async function optionGetHandler(req, res, next) {
  try {
    const systemConfig = getSystemConfig()
    const siteConfig = getSiteConfig()

    // 隐藏 aiApiKey 的实际值
    const systemDisplay = { ...systemConfig }
    if (systemDisplay.aiApiKey) {
      systemDisplay.aiApiKey = '***'
    }

    return res.json({ data: { system: systemDisplay, site: siteConfig } })
  } catch (err) {
    next(err)
  }
}
