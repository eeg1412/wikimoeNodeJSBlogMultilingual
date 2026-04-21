const {
  Joi,
  languageCodeOptional,
  translationStatus,
  importablePostType
} = require('@wikimoe-ml/common/validation')
const {
  SUPPORTED_LANGUAGE_CODES,
  POST_STATUS_DRAFT,
  POST_STATUS_PUBLISHED,
  POST_STATUS_TRASH
} = require('@wikimoe-ml/common/constants')
const { Posts } = require('../../../mongodb/models')
const { badRequest } = require('../../../utils/errors')

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  keyword: Joi.string().allow('').max(128),
  languageCode: languageCodeOptional,
  translationStatus: translationStatus,
  type: importablePostType,
  status: Joi.number()
    .valid(POST_STATUS_DRAFT, POST_STATUS_PUBLISHED, POST_STATUS_TRASH)
    .optional()
})

module.exports = async function listPostGroupsApi(req, res) {
  const { value, error } = querySchema.validate(req.query || {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  })
  if (error) {
    throw badRequest('参数校验失败', error.details)
  }

  const filter = {}
  if (value.languageCode) filter.languageCode = value.languageCode
  if (value.translationStatus)
    filter.translationStatus = value.translationStatus
  if (typeof value.type === 'number') filter.type = value.type
  if (typeof value.status === 'number') filter.status = value.status
  if (value.keyword) {
    const keywordRegExp = new RegExp(
      value.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    filter.$or = [
      { title: keywordRegExp },
      { alias: keywordRegExp },
      { sourceId: keywordRegExp },
      { groupSourceId: keywordRegExp }
    ]
  }

  const page = value.page || 1
  const limit = value.limit || 20
  const skip = (page - 1) * limit

  const facetRows = await Posts.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$groupSourceId',
        updatedAt: { $max: '$updatedAt' },
        date: { $max: '$date' }
      }
    },
    { $sort: { updatedAt: -1, _id: -1 } },
    {
      $facet: {
        list: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }]
      }
    }
  ])

  const facet = facetRows[0] || { list: [], total: [] }
  const rows = facet.list || []
  const total = facet.total[0]?.count || 0
  const groupIds = rows.map(item => item._id)

  if (!groupIds.length) {
    res.json({ data: { list: [], total, page, limit } })
    return
  }

  const docs = await Posts.find(
    { groupSourceId: { $in: groupIds } },
    {
      sourceId: 1,
      sourceAlias: 1,
      groupSourceId: 1,
      languageCode: 1,
      type: 1,
      title: 1,
      alias: 1,
      status: 1,
      translationStatus: 1,
      updatedAt: 1,
      date: 1,
      author: 1,
      sort: 1
    }
  )
    .populate({ path: 'author', select: 'nickname' })
    .populate({ path: 'sort', select: 'sortname alias' })
    .sort({ date: -1, updatedAt: -1, _id: -1 })
    .lean()

  const groups = {}
  groupIds.forEach(groupSourceId => {
    groups[groupSourceId] = {
      groupSourceId,
      sourceId: '',
      sourceAlias: '',
      type: null,
      title: '',
      updatedAt: null,
      date: null,
      author: null,
      sort: null,
      languages: {},
      availableLanguages: [],
      missingLanguages: []
    }
  })

  docs.forEach(doc => {
    const bucket = groups[doc.groupSourceId]
    if (!bucket) return

    const currentUpdatedAt = bucket.updatedAt
      ? new Date(bucket.updatedAt).getTime()
      : 0
    const docUpdatedAt = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0

    if (!bucket.updatedAt || docUpdatedAt >= currentUpdatedAt) {
      bucket.sourceId = doc.sourceId
      bucket.sourceAlias = doc.sourceAlias || ''
      bucket.type = doc.type
      bucket.title = doc.title || ''
      bucket.updatedAt = doc.updatedAt
      bucket.date = doc.date
      bucket.author = doc.author
        ? { _id: doc.author._id, nickname: doc.author.nickname }
        : null
      bucket.sort = doc.sort
        ? {
            _id: doc.sort._id,
            sortname: doc.sort.sortname,
            alias: doc.sort.alias
          }
        : null
    }

    bucket.languages[doc.languageCode] = {
      _id: doc._id,
      languageCode: doc.languageCode,
      title: doc.title || '',
      alias: doc.alias || '',
      status: doc.status,
      translationStatus: doc.translationStatus,
      updatedAt: doc.updatedAt
    }
  })

  const list = groupIds.map(groupSourceId => {
    const bucket = groups[groupSourceId]
    bucket.availableLanguages = SUPPORTED_LANGUAGE_CODES.filter(
      code => !!bucket.languages[code]
    )
    bucket.missingLanguages = SUPPORTED_LANGUAGE_CODES.filter(
      code => !bucket.languages[code]
    )
    return bucket
  })

  res.json({
    data: {
      list,
      total,
      page,
      limit
    }
  })
}
