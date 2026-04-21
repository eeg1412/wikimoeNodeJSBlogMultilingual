const express = require('express')
const multer = require('multer')
const { adminSchemas, sharedSchemas } = require('../../common/validation')
const db = require('../mongodb')
const HttpError = require('../utils/httpError')
const { asyncHandler } = require('../utils/async')
const { validate } = require('../utils/validation')
const { comparePassword, createAdminToken, verifyAdminToken } = require('../utils/auth')
const { getDeviceInfo, getUserIp } = require('../utils/request')
const { getEntityRouteKeys } = require('../services/entityRegistry')
const entityService = require('../services/entityService')
const importService = require('../services/importService')
const optionsService = require('../services/optionsService')
const publishService = require('../services/publishService')
const translationService = require('../services/translationService')
const { TRANSLATION_STATUS } = require('../../common/constants')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

function ensureReady(req, res, next) {
  if (!global.$isReady) {
    next(new HttpError(503, '服务尚未完成初始化'))
    return
  }
  next()
}

async function ensureAdmin(req, res, next) {
  try {
    const authorization = req.headers.authorization || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) {
      throw new HttpError(401, '认证失败')
    }

    const decoded = verifyAdminToken(token)
    const admin = await db.utils.adminUsers.findOne({ _id: decoded.id })
    if (!admin || admin.disabled || admin.pwversion !== decoded.pwversion) {
      throw new HttpError(401, '认证失败')
    }

    req.admin = admin
    next()
  } catch (error) {
    next(error)
  }
}

function mapRelationIds(list) {
  return Array.isArray(list)
    ? list.map(item => (typeof item === 'string' ? item : item?._id)).filter(Boolean)
    : []
}

function mapSingleRelationId(item) {
  if (!item) {
    return null
  }
  return typeof item === 'string' ? item : item._id || null
}

router.use(ensureReady)

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.loginSchema, req.body)
    const admin = await db.utils.adminUsers.findOne({ username: payload.username })
    if (!admin || !comparePassword(payload.password, admin.password)) {
      throw new HttpError(400, '用户名或密码不正确')
    }
    if (admin.disabled) {
      throw new HttpError(403, '该账号已被禁用')
    }

    const IP = getUserIp(req)
    const ipInfo = { ip: IP }
    const deviceInfo = getDeviceInfo(req)

    await db.utils.adminUsers.updateOne(
      { _id: admin._id },
      { $set: { IP, ipInfo } }
    )

    res.json({
      data: {
        admin: {
          _id: admin._id,
          username: admin.username,
          nickname: admin.nickname,
          role: admin.role,
          ipInfo,
          deviceInfo
        },
        token: createAdminToken(admin, payload.remember)
      }
    })
  })
)

router.use(ensureAdmin)

router.get(
  '/option/list',
  asyncHandler(async (req, res) => {
    const list = await optionsService.getOptionList()
    res.json({ data: list })
  })
)

router.put(
  '/option/update',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.optionUpdateSchema, req.body)
    const doc = await optionsService.updateOption(payload.key, payload.value)
    res.json({ data: doc })
  })
)

router.post(
  '/import/post',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.importPostSchema, req.body)
    const result = await importService.importPost({
      ...payload,
      adminId: req.admin._id
    })
    res.json({ data: result })
  })
)

router.get(
  '/import/job/list',
  asyncHandler(async (req, res) => {
    const query = validate(sharedSchemas.paginationSchema, req.query)
    const result = await db.utils.importJobs.findPage(
      {},
      { createdAt: -1 },
      query.page,
      query.limit
    )
    res.json({ data: result })
  })
)

router.get(
  '/post/group/list',
  asyncHandler(async (req, res) => {
    const query = validate(adminSchemas.groupListSchema, req.query)
    const match = {}
    if (query.type) {
      match.type = query.type
    }
    if (query.languageCode) {
      match.languageCode = query.languageCode
    }
    if (typeof query.status === 'number') {
      match.status = query.status
    }
    if (query.translationStatus) {
      match.translationStatus = query.translationStatus
    }
    if (query.publishDateStart || query.publishDateEnd) {
      match.date = {}
      if (query.publishDateStart) {
        match.date.$gte = new Date(query.publishDateStart)
      }
      if (query.publishDateEnd) {
        match.date.$lte = new Date(query.publishDateEnd)
      }
    }

    const totalGroups = await db.utils.posts.aggregate([
      { $match: match },
      { $group: { _id: '$groupSourceId' } },
      { $count: 'total' }
    ])
    const groups = await db.utils.posts.aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: '$groupSourceId',
          sourceId: { $first: '$sourceId' },
          sourceAlias: { $first: '$sourceAlias' },
          type: { $first: '$type' },
          date: { $max: '$date' },
          latestUpdatedAt: { $max: '$updatedAt' },
          items: {
            $push: {
              languageCode: '$languageCode',
              postId: '$_id',
              status: '$status',
              title: '$title',
              translationStatus: '$translationStatus'
            }
          }
        }
      },
      { $sort: { latestUpdatedAt: -1 } },
      { $skip: (query.page - 1) * query.limit },
      { $limit: query.limit }
    ])

    const list = groups.map(group => {
      const languageStatus = { en: null, jp: null, tw: null }
      for (const item of group.items) {
        languageStatus[item.languageCode] = item
      }
      return {
        groupSourceId: group._id,
        sourceId: group.sourceId,
        sourceAlias: group.sourceAlias,
        type: group.type,
        date: group.date,
        languageStatus
      }
    })

    res.json({
      data: {
        list,
        total: totalGroups[0]?.total || 0,
        page: query.page,
        limit: query.limit
      }
    })
  })
)

router.get(
  '/post/list',
  asyncHandler(async (req, res) => {
    const query = validate(adminSchemas.postListSchema, req.query)
    const filter = {}
    if (query.languageCode) {
      filter.languageCode = query.languageCode
    }
    if (query.type) {
      filter.type = query.type
    }
    if (typeof query.status === 'number') {
      filter.status = query.status
    }
    if (query.translationStatus) {
      filter.translationStatus = query.translationStatus
    }
    if (query.groupSourceId) {
      filter.groupSourceId = query.groupSourceId
    }
    if (query.sourceId) {
      filter.sourceId = query.sourceId
    }
    if (query.sort) {
      filter.sort = query.sort
    }
    if (query.tag) {
      filter.tags = query.tag
    }
    if (query.keyword) {
      filter.$or = [
        { title: new RegExp(query.keyword, 'i') },
        { excerpt: new RegExp(query.keyword, 'i') },
        { alias: new RegExp(query.keyword, 'i') },
        { sourceId: new RegExp(query.keyword, 'i') }
      ]
    }

    const result = await db.utils.posts.findPage(
      filter,
      { updatedAt: -1 },
      query.page,
      query.limit,
      undefined,
      { scope: 'detail' }
    )
    res.json({ data: result })
  })
)

router.get(
  '/post/detail',
  asyncHandler(async (req, res) => {
    const id = req.query.id
    if (!id) {
      throw new HttpError(400, 'id 不能为空')
    }
    const post = await db.utils.posts.findOne({ _id: id }, undefined, { scope: 'detail' })
    if (!post) {
      throw new HttpError(404, '文章不存在')
    }
    res.json({ data: post })
  })
)

router.put(
  '/post/update',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.postUpdateSchema, req.body)
    const current = await db.utils.posts.findOne({ _id: payload.id })
    if (!current) {
      throw new HttpError(404, '文章不存在')
    }

    const updateData = {
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      alias: payload.alias,
      date: payload.date,
      lastChangDate: payload.lastChangDate,
      status: payload.status,
      author: mapSingleRelationId(payload.author),
      sort: mapSingleRelationId(payload.sort),
      tags: mapRelationIds(payload.tags),
      mappointList: mapRelationIds(payload.mappointList),
      coverImages: mapRelationIds(payload.coverImages),
      bangumiList: mapRelationIds(payload.bangumiList),
      movieList: mapRelationIds(payload.movieList),
      gameList: mapRelationIds(payload.gameList),
      bookList: mapRelationIds(payload.bookList),
      postList: mapRelationIds(payload.postList),
      tweetList: mapRelationIds(payload.tweetList),
      eventList: mapRelationIds(payload.eventList),
      voteList: mapRelationIds(payload.voteList),
      seriesSortList: payload.seriesSortList,
      contentBangumiList: mapRelationIds(payload.contentBangumiList),
      contentMovieList: mapRelationIds(payload.contentMovieList),
      contentGameList: mapRelationIds(payload.contentGameList),
      contentBookList: mapRelationIds(payload.contentBookList),
      contentPostList: mapRelationIds(payload.contentPostList),
      contentTweetList: mapRelationIds(payload.contentTweetList),
      contentEventList: mapRelationIds(payload.contentEventList),
      contentVoteList: mapRelationIds(payload.contentVoteList),
      contentSeriesSortList: payload.contentSeriesSortList,
      validationState: {
        ...payload.validationState,
        needsRefresh: true,
        updatedAt: new Date()
      },
      translationStatus:
        payload.translationStatus || TRANSLATION_STATUS.MANUAL_DRAFT,
      isManualEdited: true
    }

    await db.utils.posts.updateOne({ _id: payload.id }, { $set: updateData })
    const post = await db.utils.posts.findOne({ _id: payload.id }, undefined, { scope: 'detail' })
    res.json({ data: post })
  })
)

router.post(
  '/post/translate-field',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.translateFieldSchema, req.body)
    const result = await translationService.translateField({
      ...payload,
      operatorAdminId: req.admin._id
    })
    res.json({ data: result })
  })
)

router.post(
  '/post/translate-html',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.translateHtmlSchema, req.body)
    const result = await translationService.translateHtmlField({
      ...payload,
      operatorAdminId: req.admin._id
    })
    res.json({ data: result })
  })
)

router.post(
  '/post/translate-all',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.translateAllSchema, req.body)
    const result = await translationService.translateAllFields({
      ...payload,
      operatorAdminId: req.admin._id
    })
    res.json({ data: result })
  })
)

router.post(
  '/post/publish',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.publishSchema, req.body)
    const post = await publishService.publishPost(payload.id)
    res.json({ data: post })
  })
)

router.post(
  '/post/unpublish',
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.publishSchema, req.body)
    const post = await publishService.unpublishPost(payload.id)
    res.json({ data: post })
  })
)

router.post(
  '/attachment/upload-localized',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const payload = validate(adminSchemas.localizedAttachmentUploadSchema, req.body)
    const doc = await entityService.uploadLocalizedAttachment(payload, req.file)
    res.json({ data: doc })
  })
)

for (const entityType of getEntityRouteKeys()) {
  router.get(
    `/${entityType}/list`,
    asyncHandler(async (req, res) => {
      const query = validate(sharedSchemas.paginationSchema.keys({
        attachmentSourceType: sharedSchemas.attachmentSourceTypeSchema.optional()
      }), req.query)
      const result = await entityService.listEntities(entityType, query)
      res.json({ data: result })
    })
  )

  router.get(
    `/${entityType}/detail`,
    asyncHandler(async (req, res) => {
      if (!req.query.id) {
        throw new HttpError(400, 'id 不能为空')
      }
      const result = await entityService.getEntityDetail(entityType, req.query.id)
      res.json({ data: result })
    })
  )

  router.put(
    `/${entityType}/update`,
    asyncHandler(async (req, res) => {
      const payload = validate(adminSchemas.entityUpdateSchema, req.body)
      const result = await entityService.updateEntity(entityType, payload)
      res.json({ data: result })
    })
  )
}

router.get(
  '/aitranslationlog/list',
  asyncHandler(async (req, res) => {
    const query = validate(sharedSchemas.paginationSchema, req.query)
    const result = await db.utils.aiTranslationLogs.findPage(
      {},
      { createdAt: -1 },
      query.page,
      query.limit
    )
    res.json({ data: result })
  })
)

module.exports = router