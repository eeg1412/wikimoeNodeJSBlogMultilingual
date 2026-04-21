const moment = require('moment-timezone')
const { Posts, Sorts, Tags, Mappoints } = require('../../mongodb/models')
const {
  IMPORTABLE_POST_TYPES,
  POST_STATUS_PUBLISHED
} = require('@wikimoe-ml/common/constants')
const {
  parseLang,
  parsePage,
  parseLimit,
  isObjectId,
  escapeRegex
} = require('./_helpers')
const { serializeAttachmentList } = require('./_serialize')
const { getAllOptions } = require('../../utils/options')
const { badRequest, notFound } = require('../../utils/errors')

const LIST_PROJECTION =
  '-content -code -sourceSnapshot -importMeta -publishMeta -validationState ' +
  '-bangumiList -movieList -gameList -bookList -eventList -voteList -postList -tweetList ' +
  '-contentBangumiList -contentMovieList -contentGameList -contentBookList ' +
  '-contentEventList -contentVoteList -contentPostList -contentTweetList -contentSeriesSortList'

function parseTypeParam(rawType) {
  if (rawType === undefined || rawType === null || rawType === '') {
    return null
  }
  let arr = []
  if (Array.isArray(rawType)) {
    arr = rawType
  } else {
    arr = String(rawType).split(',')
  }
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const n = parseInt(arr[i], 10)
    if (!IMPORTABLE_POST_TYPES.includes(n)) {
      throw badRequest('type 参数错误')
    }
    if (result.indexOf(n) === -1) {
      result.push(n)
    }
  }
  return result.length ? result : null
}

module.exports = async function getPostList(req, res) {
  const lang = parseLang(req)
  const page = parsePage(req, 1)
  const options = await getAllOptions()
  const defaultLimit =
    Number(options.sitePageSize) > 0 ? Number(options.sitePageSize) : 10
  const limit = parseLimit(req, defaultLimit, 100)

  const filter = {
    languageCode: lang,
    status: POST_STATUS_PUBLISHED
  }

  const typeList = parseTypeParam(req.query.type)
  if (typeList) {
    filter.type = { $in: typeList }
  } else {
    filter.type = { $in: IMPORTABLE_POST_TYPES }
  }

  // 关键词
  const keyword = String(req.query.keyword || '')
    .trim()
    .slice(0, 40)
  if (keyword) {
    const parts = keyword.split(/\s+/).filter(Boolean)
    if (parts.length > 0) {
      const regexList = parts.map(p => new RegExp(escapeRegex(p), 'i'))
      const ors = [
        { title: { $in: regexList } },
        { excerpt: { $in: regexList } }
      ]
      const matchedTags = await Tags.find({
        languageCode: lang,
        tagname: { $in: regexList }
      })
        .select('_id')
        .limit(100)
        .lean()
      if (matchedTags.length > 0) {
        ors.push({ tags: { $in: matchedTags.map(t => t._id) } })
      }
      const matchedMps = await Mappoints.find({
        languageCode: lang,
        title: { $in: regexList }
      })
        .select('_id')
        .limit(100)
        .lean()
      if (matchedMps.length > 0) {
        ors.push({ mappointList: { $in: matchedMps.map(m => m._id) } })
      }
      filter.$or = ors
    }
  }

  // 分类：支持 id/alias，自动包含子级
  if (req.query.sortid) {
    const sortid = String(req.query.sortid).trim()
    const sortFilter = { languageCode: lang }
    if (isObjectId(sortid)) {
      sortFilter._id = sortid
    } else {
      sortFilter.alias = sortid
    }
    const sort = await Sorts.findOne(sortFilter).lean()
    if (!sort) {
      throw notFound('分类不存在')
    }
    const children = await Sorts.find({
      languageCode: lang,
      parent: sort._id
    })
      .select('_id')
      .lean()
    const sortIds = [sort._id].concat(children.map(c => c._id))
    filter.sort = { $in: sortIds }
  }

  // 标签
  if (req.query.tagid) {
    const tagid = String(req.query.tagid).trim()
    if (!isObjectId(tagid)) {
      throw badRequest('tagid 参数错误')
    }
    filter.tags = { $in: [tagid] }
  }

  // 地点
  if (req.query.mappointid) {
    const mappointid = String(req.query.mappointid).trim()
    if (!isObjectId(mappointid)) {
      throw badRequest('mappointid 参数错误')
    }
    filter.mappointList = { $in: [mappointid] }
  }

  // 年月归档
  if (req.query.year && req.query.month) {
    const year = parseInt(req.query.year, 10)
    const month = parseInt(req.query.month, 10)
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      throw badRequest('年月参数错误')
    }
    if (month < 1 || month > 12) {
      throw badRequest('月份错误')
    }
    const tz = options.siteTimeZone || 'Asia/Tokyo'
    const start = moment
      .tz([year, month - 1], tz)
      .startOf('month')
      .toDate()
    const end = moment
      .tz([year, month - 1], tz)
      .add(1, 'month')
      .startOf('month')
      .toDate()
    filter.date = { $gte: start, $lt: end }
  }

  const sort = { date: -1, _id: -1 }

  const [list, total] = await Promise.all([
    Posts.find(filter, LIST_PROJECTION)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('coverImages')
      .populate({
        path: 'author',
        select: 'nickname photoAttachment'
      })
      .populate('sort', 'sortname alias')
      .populate('tags', 'tagname')
      .lean(),
    Posts.countDocuments(filter)
  ])

  const result = list.map(item => {
    return {
      _id: item._id,
      sourceId: item.sourceId,
      groupSourceId: item.groupSourceId,
      languageCode: item.languageCode,
      type: item.type,
      title: item.title,
      excerpt: item.excerpt,
      alias: item.alias,
      date: item.date,
      lastChangDate: item.lastChangDate,
      coverImages: serializeAttachmentList(item.coverImages),
      author: item.author
        ? {
            _id: item.author._id,
            nickname: item.author.nickname
          }
        : null,
      sort: item.sort
        ? {
            _id: item.sort._id,
            sortname: item.sort.sortname,
            alias: item.sort.alias
          }
        : null,
      tags: Array.isArray(item.tags)
        ? item.tags.map(t => ({ _id: t._id, tagname: t.tagname }))
        : []
    }
  })

  res.json({
    list: result,
    total,
    page,
    size: limit
  })
}
