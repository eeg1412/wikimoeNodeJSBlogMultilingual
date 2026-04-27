const tagUtils = require('../../../mongodb/utils/tags')
const utils = require('../../../utils/utils')
const cacheDataUtils = require('../../../config/cacheData')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')
const moment = require('moment-timezone')

module.exports = async function (req, res, next) {
  const languageCode = cacheDataUtils.getRequestLanguageCode(req)
  if (!languageCode) {
    res.status(400).json({ errors: [{ message: 'languageCode不支持' }] })
    return
  }
  const languageCache = cacheDataUtils.getLanguageCache(languageCode)
  utils
    .executeInLock(`getRandomTagList:${languageCode}`, async () => {
      const sidebarList = languageCache.sidebarList || []
      const randomTagListSidebar = sidebarList.find(item => {
        return item.type === 4
      })
      // 不存在type为4的侧边栏
      if (!randomTagListSidebar) {
        res.send({
          list: []
        })
        // reject
        return
      }
      // 存在type为4的侧边栏,获取count
      const limit = randomTagListSidebar.count || 0
      // 如果count小于等于0，不获取
      if (limit <= 0) {
        res.send({
          list: []
        })
        // reject
        return
      }

      // 获取缓存中的randomTagListData
      const randomTagListData = languageCache.randomTagListData || null

      let shouldUpdate = true
      if (randomTagListData) {
        res.send({
          list: randomTagListData.list
        })
        // 确保randomTagListData.date也在相同的时区
        const randomTagListDate = randomTagListData.date
        const isSameLimit = randomTagListData.limit === limit
        // 使用带时区的日期进行分钟差异比较
        const isDiffSeconds = moment().diff(randomTagListDate, 'seconds')
        const isWithinTimeLimit = isDiffSeconds <= 2 * 60
        if (isWithinTimeLimit && isSameLimit) {
          shouldUpdate = false
          // reject
          return
        }
      }

      if (shouldUpdate) {
        console.info(`getRandomTagList should update:${languageCode}`)
        // 查询数据库
        const pipe = [
          {
            $match: cacheDataUtils.getTranslationParams(languageCode)
          },
          {
            $sample: {
              size: limit + 10
            }
          },
          {
            $lookup: {
              from: 'posts',
              localField: '_id',
              foreignField: 'tags',
              pipeline: [
                {
                  $match: {
                    status: 1,
                    languageCode,
                    recordKind: 'translation'
                  }
                }
              ],
              as: 'posts'
            }
          },
          // 计算公开文章数量
          {
            $addFields: {
              publicPostCount: { $size: '$posts' }
            }
          },
          // 过滤掉文章数为0的标签
          {
            $match: {
              publicPostCount: { $gt: 0 }
            }
          },
          // 只输出limit个
          {
            $limit: limit
          },
          // 只输出_id和tagname
          {
            $project: {
              _id: 1,
              tagname: 1,
              publicPostCount: 1
            }
          }
        ]
        await tagUtils
          .aggregate(pipe)
          .then(data => {
            // 写入缓存
            languageCache.randomTagListData = {
              date: moment().toDate(),
              list: data,
              limit: limit
            }
            if (!randomTagListData) {
              console.info('getRandomTagList should send new data')
              res.send({
                list: data
              })
            }
          })
          .catch(err => {
            userApiLog.error(`getRandomTagList error, ${logErrorToText(err)}`)
          })
      }
    })
    .then(() => {
      // 释放锁
      console.info('getRandomTagList unlock')
    })
    .catch(err => {
      // 释放锁
      userApiLog.error(`getRandomTagList unlock error, ${logErrorToText(err)}`)
    })
}
