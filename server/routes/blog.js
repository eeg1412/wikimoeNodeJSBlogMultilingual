const express = require('express')
const { blogSchemas } = require('../../common/validation')
const db = require('../mongodb')
const HttpError = require('../utils/httpError')
const { asyncHandler } = require('../utils/async')
const { validate } = require('../utils/validation')
const optionsService = require('../services/optionsService')
const { POST_STATUS, ATTACHMENT_SOURCE_TYPE } = require('../../common/constants')
const { resolveSourceAssetUrl } = require('../utils/sourceUrl')
const env = require('../config/env')

const router = express.Router()

router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

function serializeAttachment(attachment) {
  if (!attachment) {
    return attachment
  }
  const json = attachment.toJSON ? attachment.toJSON() : { ...attachment }
  if (json.attachmentSourceType === ATTACHMENT_SOURCE_TYPE.REMOTE) {
    if (json.sourcePath) {
      json.resolvedUrl = resolveSourceAssetUrl(
        json.sourcePath,
        env.SOURCE_BLOG_PUBLIC_ORIGIN
      )
    } else {
      json.resolvedUrl = json.externalUrl
    }
  } else {
    json.resolvedUrl = json.filepath
  }
  return json
}

function serializeEntity(doc) {
  if (!doc) {
    return doc
  }
  const json = doc.toJSON ? doc.toJSON() : { ...doc }
  if (json.photoAttachment) {
    json.photoAttachment = serializeAttachment(json.photoAttachment)
  }
  if (json.coverAttachment) {
    json.coverAttachment = serializeAttachment(json.coverAttachment)
  }
  if (Array.isArray(json.coverImages)) {
    json.coverImages = json.coverImages.map(serializeAttachment)
  }
  return json
}

function createPublicPostFilter(query) {
  const filter = {
    languageCode: query.lang,
    status: POST_STATUS.PUBLISHED
  }

  if (query.type) {
    filter.type = query.type
  }

  return filter
}

async function resolveSortFilter(sortValue, languageCode) {
  if (!sortValue) {
    return null
  }
  const sort = await db.utils.sorts.findOne({
    languageCode,
    $or: [{ _id: sortValue }, { sourceId: sortValue }, { alias: sortValue }]
  })
  if (!sort) {
    throw new HttpError(404, '分类不存在')
  }
  return sort._id
}

async function resolveTagFilter(tagValue, languageCode) {
  if (!tagValue) {
    return null
  }
  const tag = await db.utils.tags.findOne({
    languageCode,
    $or: [{ _id: tagValue }, { sourceId: tagValue }, { tagname: tagValue }]
  })
  if (!tag) {
    throw new HttpError(404, '标签不存在')
  }
  return tag._id
}

async function resolveMappointFilter(value, languageCode) {
  if (!value) {
    return null
  }
  const doc = await db.utils.mappoints.findOne({
    languageCode,
    $or: [{ _id: value }, { sourceId: value }, { title: value }]
  })
  if (!doc) {
    throw new HttpError(404, '地点不存在')
  }
  return doc._id
}

router.get(
  '/options',
  asyncHandler(async (req, res) => {
    const lang = req.query.lang || undefined
    if (!lang) {
      throw new HttpError(400, 'lang 不能为空')
    }
    validate(blogSchemas.entityDetailQuerySchema, { lang, id: 'placeholder' })
    const data = await optionsService.getOptionMap()
    res.json({ data })
  })
)

router.get(
  '/post/list',
  asyncHandler(async (req, res) => {
    const query = validate(blogSchemas.postListQuerySchema, req.query)
    const filter = createPublicPostFilter(query)

    if (query.keyword) {
      filter.$or = [
        { title: new RegExp(query.keyword, 'i') },
        { excerpt: new RegExp(query.keyword, 'i') }
      ]
    }
    if (query.sort) {
      filter.sort = await resolveSortFilter(query.sort, query.lang)
    }
    if (query.tag) {
      filter.tags = await resolveTagFilter(query.tag, query.lang)
    }
    if (query.mappoint) {
      filter.mappointList = await resolveMappointFilter(query.mappoint, query.lang)
    }
    if (query.archive) {
      const [year, month] = String(query.archive).split('-').map(Number)
      if (year && month) {
        filter.date = {
          $gte: new Date(Date.UTC(year, month - 1, 1)),
          $lt: new Date(Date.UTC(year, month, 1))
        }
      }
    }

    const result = await db.utils.posts.findPage(
      filter,
      { date: -1, _id: -1 },
      query.page,
      query.limit,
      undefined,
      { scope: 'detail' }
    )
    res.json({
      data: {
        ...result,
        list: result.list.map(serializeEntity)
      }
    })
  })
)

router.get(
  '/post/detail',
  asyncHandler(async (req, res) => {
    const query = validate(blogSchemas.postDetailQuerySchema, req.query)
    const post = await db.utils.posts.findOne(
      {
        languageCode: query.lang,
        status: POST_STATUS.PUBLISHED,
        $or: [{ _id: query.id }, { alias: query.id }, { sourceId: query.id }]
      },
      undefined,
      { scope: 'detail' }
    )

    if (!post) {
      throw new HttpError(404, '文章不存在')
    }

    const alternates = await db.utils.posts.find(
      {
        _id: { $ne: post._id },
        groupSourceId: post.groupSourceId,
        status: POST_STATUS.PUBLISHED
      },
      'languageCode alias title'
    )

    res.json({
      data: {
        ...serializeEntity(post),
        alternates: alternates.map(item => ({
          languageCode: item.languageCode,
          alias: item.alias,
          title: item.title
        }))
      }
    })
  })
)

router.get(
  '/post/archive',
  asyncHandler(async (req, res) => {
    const lang = req.query.lang
    if (!lang) {
      throw new HttpError(400, 'lang 不能为空')
    }
    const list = await db.utils.posts.aggregate([
      {
        $match: {
          languageCode: lang,
          status: POST_STATUS.PUBLISHED
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year': -1,
          '_id.month': -1
        }
      }
    ])

    res.json({
      data: list.map(item => ({
        archive: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count
      }))
    })
  })
)

router.get(
  '/sort/list',
  asyncHandler(async (req, res) => {
    const lang = req.query.lang
    if (!lang) {
      throw new HttpError(400, 'lang 不能为空')
    }
    const list = await db.utils.sorts.find({ languageCode: lang }, undefined, {
      sort: { taxis: 1, sortname: 1 }
    })
    res.json({ data: list.map(serializeEntity) })
  })
)

router.get(
  '/sort/detail',
  asyncHandler(async (req, res) => {
    const query = validate(blogSchemas.entityDetailQuerySchema, req.query)
    const doc = await db.utils.sorts.findOne({
      languageCode: query.lang,
      $or: [{ _id: query.id }, { sourceId: query.id }, { alias: query.id }]
    })
    if (!doc) {
      throw new HttpError(404, '分类不存在')
    }
    res.json({ data: serializeEntity(doc) })
  })
)

router.get(
  '/tag/detail',
  asyncHandler(async (req, res) => {
    const query = validate(blogSchemas.entityDetailQuerySchema, req.query)
    const doc = await db.utils.tags.findOne({
      languageCode: query.lang,
      $or: [{ _id: query.id }, { sourceId: query.id }, { tagname: query.id }]
    })
    if (!doc) {
      throw new HttpError(404, '标签不存在')
    }
    res.json({ data: serializeEntity(doc) })
  })
)

router.get(
  '/mappoint/detail',
  asyncHandler(async (req, res) => {
    const query = validate(blogSchemas.entityDetailQuerySchema, req.query)
    const doc = await db.utils.mappoints.findOne({
      languageCode: query.lang,
      $or: [{ _id: query.id }, { sourceId: query.id }, { title: query.id }]
    })
    if (!doc) {
      throw new HttpError(404, '地点不存在')
    }
    res.json({ data: serializeEntity(doc) })
  })
)

module.exports = router