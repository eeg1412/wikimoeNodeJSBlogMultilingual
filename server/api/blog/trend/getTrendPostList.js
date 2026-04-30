const { ObjectId } = require('mongodb')
const postUtils = require('../../../mongodb/utils/posts')
const utils = require('../../../utils/utils')
const cacheDataUtils = require('../../../config/cacheData')
const log4js = require('log4js')
const userApiLog = log4js.getLogger('userApi')
const moment = require('moment-timezone')

function normalizeSourceId(sourceId) {
  if (!sourceId) {
    return ''
  }

  return String(sourceId)
}

function toObjectId(value) {
  if (value instanceof ObjectId) {
    return value
  }

  if (!ObjectId.isValid(value)) {
    return null
  }

  return new ObjectId(value)
}

function getPostTarget(post) {
  switch (post?.type) {
    case 1:
      return 'blog'
    case 2:
      return 'tweet'
    case 3:
      return 'page'
    default:
      return 'blog'
  }
}

async function getSourceTrendPostList(limit, languageCode) {
  const sourceReaderlogsRepository =
    global.$mongodDB?.source?.repositories?.readerlogs
  if (!sourceReaderlogsRepository) {
    throw new Error('源站访问日志仓库不可用，无法获取热门文章')
  }

  const twentyFourHoursAgo = moment().subtract(24, 'hours')
  const sourceTrendList = await sourceReaderlogsRepository.aggregate([
    {
      $match: {
        createdAt: { $gte: twentyFourHoursAgo.toDate() },
        action: 'postView',
        isBot: false
      }
    },
    {
      $group: {
        _id: '$data.targetId',
        target: { $first: '$data.target' },
        hot: {
          $sum: 13
        }
      }
    },
    {
      $match: {
        _id: {
          $ne: null
        },
        hot: {
          $gt: 0
        }
      }
    },
    {
      $sort: {
        hot: -1,
        _id: -1
      }
    },
    {
      $limit: limit * 5
    }
  ])

  const sourcePostIdList = sourceTrendList
    .map(item => toObjectId(item?._id))
    .filter(Boolean)
  if (sourcePostIdList.length === 0) {
    return []
  }

  const translatedPostList = await postUtils.aggregate([
    {
      $match: {
        sourceId: {
          $in: sourcePostIdList
        },
        languageCode,
        recordKind: 'translation',
        status: 1
      }
    },
    {
      $addFields: {
        coverImage: {
          $cond: {
            if: { $eq: [{ $size: '$coverImages' }, 0] },
            then: [],
            else: [{ $arrayElemAt: ['$coverImages', 0] }]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'attachments',
        localField: 'coverImage',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              filepath: 1,
              mimetype: 1,
              thumfor: 1
            }
          }
        ],
        as: 'coverImage'
      }
    },
    {
      $unwind: {
        path: '$coverImage',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        sourceId: 1,
        title: 1,
        alias: 1,
        excerpt: 1,
        type: 1,
        coverImage: 1
      }
    }
  ])

  const translatedPostMap = new Map(
    translatedPostList.map(item => [normalizeSourceId(item.sourceId), item])
  )
  const list = []
  for (const sourceTrendItem of sourceTrendList) {
    const postDetail = translatedPostMap.get(
      normalizeSourceId(sourceTrendItem?._id)
    )
    if (!postDetail) {
      continue
    }

    list.push({
      _id: postDetail._id,
      sourceId: sourceTrendItem._id,
      target: sourceTrendItem.target || getPostTarget(postDetail),
      hot: sourceTrendItem.hot,
      postDetail
    })

    if (list.length >= limit) {
      break
    }
  }

  return list
}

module.exports = async function (req, res, next) {
  const languageCode = cacheDataUtils.getRequestLanguageCode(req)
  if (!languageCode) {
    res.status(400).json({ errors: [{ message: 'languageCode不支持' }] })
    return
  }
  const languageCache = cacheDataUtils.getLanguageCache(languageCode)
  utils
    .executeInLock(`getTrendPostList:${languageCode}`, async () => {
      const sidebarList = languageCache.sidebarList || []
      const trendSidebar = sidebarList.find(item => {
        return item.type === 12
      })
      if (!trendSidebar) {
        res.send({
          list: []
        })
        return
      }

      const limit = trendSidebar.count || 0
      if (limit <= 0) {
        res.send({
          list: []
        })
        return
      }

      const trendPostListData = languageCache.trendPostListData || null
      let shouldUpdate = true
      if (trendPostListData) {
        res.send({
          list: trendPostListData.list
        })
        const isSameLimit = trendPostListData.limit === limit
        const isDiffSeconds = moment().diff(trendPostListData.date, 'seconds')
        const isWithinTimeLimit = isDiffSeconds <= 2 * 60
        if (isWithinTimeLimit && isSameLimit) {
          shouldUpdate = false
          return
        }
      }

      if (shouldUpdate) {
        const list = await getSourceTrendPostList(limit, languageCode)
        languageCache.trendPostListData = {
          date: moment().toDate(),
          list,
          limit
        }
        if (!trendPostListData) {
          res.send({
            list
          })
        }
      }
    })
    .then(() => {
      console.info('getTrendPostList unlock')
    })
    .catch(err => {
      userApiLog.error(`getTrendPostList unlock error, ${logErrorToText(err)}`)
      if (!res.headersSent) {
        res.status(400).json({
          errors: [
            {
              message: '热门文章获取失败'
            }
          ]
        })
      }
    })
}
