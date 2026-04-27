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
  if (languageCache?.bangumiSeasonObj) {
    cacheDataUtils
      .checkBangumiSeasonList(languageCode)
      .then(data => {
        res.send(data.list)
      })
      .catch(err => {
        res.status(400).json({
          errors: [
            {
              message: '当季追番列表获取失败'
            }
          ]
        })
        userApiLog.error(
          `checkBangumiSeasonList get fail, ${JSON.stringify(err)}`
        )
      })
  } else {
    cacheDataUtils
      .getBangumiSeasonList(languageCode)
      .then(data => {
        res.send(data.list)
      })
      .catch(err => {
        res.status(400).json({
          errors: [
            {
              message: '当季追番列表获取失败'
            }
          ]
        })
        userApiLog.error(
          `getBangumiSeasonList get fail, ${JSON.stringify(err)}`
        )
      })
  }
}
