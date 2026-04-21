const env = require('../../../config/env')
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')
const { getAllOptions } = require('../../../utils/options')

module.exports = async function siteInfoApi(req, res) {
  const options = await getAllOptions()
  res.json({
    data: {
      options,
      sourceBlogPublicOrigin: env.SOURCE_BLOG_PUBLIC_ORIGIN,
      localizedPublicBasePath: env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH,
      supportedLanguageCodes: SUPPORTED_LANGUAGE_CODES
    }
  })
}
