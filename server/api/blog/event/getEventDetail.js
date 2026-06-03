const eventUtils = require('../../../mongodb/utils/events')
const utils = require('../../../utils/utils')
const cacheDataUtils = require('../../../config/cacheData')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')

module.exports = async function (req, res, next) {
  const languageCode = cacheDataUtils.getRequestLanguageCode(req)
  if (!languageCode) {
    res.status(400).json({ errors: [{ message: 'languageCode不支持' }] })
    return
  }

  const { id } = req.query

  const validateParams = {
    id
  }

  const rule = [
    {
      key: 'id',
      label: 'ID',
      type: 'isMongoId',
      required: true
    }
  ]
  const errors = utils.checkForm(validateParams, rule)
  if (errors.length > 0) {
    res.status(400).json({ errors })
    return
  }

  try {
    const params = {
      languageCode,
      status: 1,
      recordKind: 'translation',
      $or: [
        {
          _id: id
        },
        {
          sourceId: id
        }
      ]
    }
    const data = await eventUtils.findOne(params)

    if (!data) {
      res.status(404).json({
        errors: [
          {
            message: '活动不存在'
          }
        ]
      })
      return
    }

    res.send({
      data: data
    })
  } catch (err) {
    res.status(400).json({
      errors: [
        {
          message: '活动详情获取失败'
        }
      ]
    })
    userApiLog.error(`event get fail, ${JSON.stringify(err)}`)
  }
}
