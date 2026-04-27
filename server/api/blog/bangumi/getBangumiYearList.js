const cacheDataUtils = require('../../../config/cacheData')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')

module.exports = async function (req, res, next) {
  const languageCode = cacheDataUtils.getRequestLanguageCode(req)
  if (!languageCode) {
    res.status(400).json({ errors: [{ message: 'languageCode不支持' }] })
    return
  }
  const languageCache = cacheDataUtils.getLanguageCache(languageCode)
  if (languageCache?.bangumiYearList) {
    res.send({
      data: languageCache.bangumiYearList
    })
  } else {
    cacheDataUtils
      .getBangumiYearList(languageCode)
      .then(data => {
        res.send({
          data
        })
      })
      .catch(err => {
        res.status(400).json({
          errors: [
            {
              message: '番剧年份列表获取失败'
            }
          ]
        })
        userApiLog.error(`bangumi list get fail, ${JSON.stringify(err)}`)
      })
  }
}
