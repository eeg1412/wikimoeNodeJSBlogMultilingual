const moment = require('moment-timezone')
const { Posts } = require('../../mongodb/models')
const {
  POST_STATUS_PUBLISHED,
  IMPORTABLE_POST_TYPES
} = require('@wikimoe-ml/common/constants')
const { parseLang } = require('./_helpers')
const { getAllOptions } = require('../../utils/options')

// 按年月聚合已发布文章数量
module.exports = async function getPostArchive(req, res) {
  const lang = parseLang(req)
  const options = await getAllOptions()
  const tz = options.siteTimeZone || 'Asia/Tokyo'

  const rows = await Posts.aggregate([
    {
      $match: {
        languageCode: lang,
        status: POST_STATUS_PUBLISHED,
        type: { $in: IMPORTABLE_POST_TYPES }
      }
    },
    {
      $project: {
        ym: {
          $dateToString: { format: '%Y-%m', date: '$date', timezone: tz }
        }
      }
    },
    { $group: { _id: '$ym', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ])

  const list = rows.map(item => {
    const parts = String(item._id).split('-')
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      count: item.count
    }
  })

  res.json({ list })
}
