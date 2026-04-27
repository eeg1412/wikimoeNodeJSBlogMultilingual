const mongoose = require('mongoose')
const {
  normalizeLanguageCode,
  SUPPORTED_LANGUAGE_CODES
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const importPostSourceService = require('./importPostSourceService')

const AUTHOR_SNAPSHOT_PASSWORD = '__AUTHOR_SNAPSHOT_NO_LOGIN__'
const SOURCE_POST_COLLECTION = 'posts'
const SOURCE_RECORD_KIND = 'source'
const TRANSLATION_RECORD_KIND = 'translation'

const SYSTEM_FIELDS = new Set([
  '_id',
  'id',
  '__v',
  'createdAt',
  'updatedAt',
  'languageCode',
  'sourceLanguageCode',
  'sourceId',
  'sourceCollection',
  'sourceSnapshotId',
  'translationGroupId',
  'recordKind',
  'snapshotVersion',
  'sourceSnapshotAt',
  'sourceUpdatedAt',
  'sourceHash',
  'sourceChanged',
  'pendingReview',
  'sourceChangedAt',
  'mediaMode',
  'remoteSourceId',
  'remoteFilepath',
  'remoteSnapshot',
  'localFilepath',
  'localThumbnailPath',
  'localStorageStatus'
])

const POST_SINGLE_RELATION_COLLECTIONS = {
  author: 'users',
  sort: 'sorts'
}

const POST_ARRAY_RELATION_COLLECTIONS = {
  tags: 'tags',
  mappointList: 'mappoints',
  coverImages: 'attachments',
  bangumiList: 'bangumis',
  movieList: 'movies',
  gameList: 'games',
  bookList: 'books',
  postList: 'posts',
  tweetList: 'posts',
  eventList: 'events',
  voteList: 'votes',
  contentBangumiList: 'bangumis',
  contentMovieList: 'movies',
  contentGameList: 'games',
  contentBookList: 'books',
  contentPostList: 'posts',
  contentTweetList: 'posts',
  contentEventList: 'events',
  contentVoteList: 'votes'
}

const POST_RECOMMEND_RELATION_FIELDS = [
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList'
]

const POST_CONTENT_RELATION_FIELDS = [
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList'
]

const POST_RELATION_FIELDS = [
  ...Object.keys(POST_SINGLE_RELATION_COLLECTIONS),
  ...Object.keys(POST_ARRAY_RELATION_COLLECTIONS)
]

const COLLECTION_DEPENDENCY_FIELDS = {
  users: [{ field: 'cover', collectionName: 'attachments' }],
  sorts: [{ field: 'parent', collectionName: 'sorts' }],
  attachments: [{ field: 'album', collectionName: 'albums' }],
  games: [
    { field: 'gamePlatform', collectionName: 'gamePlatforms' },
    { field: 'screenshotAlbum', collectionName: 'albums' }
  ],
  books: [{ field: 'booktype', collectionName: 'booktypes' }],
  events: [{ field: 'eventtype', collectionName: 'eventtypes' }]
}

const POST_EDITABLE_FIELDS = [
  'title',
  'date',
  'content',
  'excerpt',
  'alias',
  'author',
  'sort',
  'type',
  'tags',
  'mappointList',
  'coverImages',
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList',
  'seriesSortList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList',
  'contentSeriesSortList',
  'top',
  'sortop',
  'status',
  'allowRemark',
  'template',
  'code',
  'editorVersion',
  'client__v'
]

function getPostModel() {
  return getMultilingualModel('posts')
}

function getMultilingualModel(collectionName) {
  const repository = global.$mongodDB.multilingual.repositories[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }

  return repository.model
}

function buildMultilingualPostPopulate() {
  const matchStatus = { $in: [0, 1] }
  const postCoverPopulate = { path: 'coverImages' }

  return [
    {
      path: 'author',
      select: '-password',
      populate: {
        path: 'cover'
      }
    },
    { path: 'sort' },
    { path: 'tags' },
    {
      path: 'mappointList',
      match: { status: matchStatus }
    },
    { path: 'coverImages' },
    {
      path: 'bangumiList',
      match: { status: matchStatus }
    },
    {
      path: 'movieList',
      match: { status: matchStatus }
    },
    {
      path: 'gameList',
      match: { status: matchStatus },
      populate: [{ path: 'gamePlatform' }, { path: 'screenshotAlbum' }]
    },
    {
      path: 'bookList',
      match: { status: matchStatus },
      populate: { path: 'booktype' }
    },
    {
      path: 'postList',
      match: { status: matchStatus, type: 1 },
      populate: postCoverPopulate
    },
    {
      path: 'tweetList',
      match: { status: matchStatus, type: 2 },
      populate: postCoverPopulate
    },
    {
      path: 'eventList',
      match: { status: matchStatus },
      populate: { path: 'eventtype' }
    },
    {
      path: 'voteList',
      match: { status: matchStatus }
    },
    {
      path: 'contentBangumiList',
      match: { status: matchStatus }
    },
    {
      path: 'contentMovieList',
      match: { status: matchStatus }
    },
    {
      path: 'contentGameList',
      match: { status: matchStatus },
      populate: [{ path: 'gamePlatform' }, { path: 'screenshotAlbum' }]
    },
    {
      path: 'contentBookList',
      match: { status: matchStatus },
      populate: { path: 'booktype' }
    },
    {
      path: 'contentPostList',
      match: { status: matchStatus, type: 1 },
      populate: postCoverPopulate
    },
    {
      path: 'contentTweetList',
      match: { status: matchStatus, type: 2 },
      populate: postCoverPopulate
    },
    {
      path: 'contentEventList',
      match: { status: matchStatus },
      populate: { path: 'eventtype' }
    },
    {
      path: 'contentVoteList',
      match: { status: matchStatus }
    }
  ]
}

function getSnapshotPopulateForCollection(collectionName) {
  if (collectionName === 'posts') {
    return buildMultilingualPostPopulate()
  }

  if (collectionName === 'users') {
    return { path: 'cover' }
  }

  if (collectionName === 'sorts') {
    return { path: 'parent' }
  }

  if (collectionName === 'attachments') {
    return { path: 'album' }
  }

  if (collectionName === 'games') {
    return [{ path: 'gamePlatform' }, { path: 'screenshotAlbum' }]
  }

  if (collectionName === 'books') {
    return { path: 'booktype' }
  }

  if (collectionName === 'events') {
    return { path: 'eventtype' }
  }

  return undefined
}

function isBsonObjectId(value) {
  if (!value) {
    return false
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return true
  }

  return value._bsontype === 'ObjectId'
}

function getDocumentId(value) {
  if (!value) {
    return null
  }

  if (isBsonObjectId(value)) {
    return value
  }

  if (typeof value === 'object' && value._id) {
    return getDocumentId(value._id)
  }

  return value
}

function toObjectId(value) {
  const documentId = getDocumentId(value)
  if (!documentId) {
    return null
  }

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    return null
  }

  return new mongoose.Types.ObjectId(String(documentId))
}

function getSourceIdentityId(sourceObject) {
  const sourceId = toObjectId(sourceObject.sourceId)
  if (sourceId) {
    return sourceId
  }

  return toObjectId(sourceObject)
}

function isDocumentObject(value) {
  return Boolean(
    value && typeof value === 'object' && !isBsonObjectId(value) && value._id
  )
}

function hasRelationValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return Boolean(value)
}

function isPostRelationMissing(post, field) {
  return !hasRelationValue(post[field])
}

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value
  }

  if (isBsonObjectId(value)) {
    return value
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item))
  }

  if (typeof value.toObject === 'function') {
    return cloneValue(
      value.toObject({
        depopulate: false,
        virtuals: false
      })
    )
  }

  if (typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value)) {
      result[key] = cloneValue(value[key])
    }
    return result
  }

  return value
}

function stripFields(value, fields) {
  if (value === null || value === undefined) {
    return value
  }

  if (isBsonObjectId(value)) {
    return value
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (Array.isArray(value)) {
    return value.map(item => stripFields(item, fields))
  }

  if (typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value)) {
      if (fields.has(key)) {
        continue
      }
      result[key] = stripFields(value[key], fields)
    }
    return result
  }

  return value
}

function normalizeAlias(value) {
  if (value === null || value === undefined) {
    return null
  }

  const alias = String(value).trim()
  if (!alias) {
    return null
  }

  return alias
}

function parsePositiveInteger(value, defaultValue, maxValue) {
  const numberValue = Number.parseInt(value, 10)
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return defaultValue
  }

  if (maxValue && numberValue > maxValue) {
    return maxValue
  }

  return numberValue
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numberValue = Number.parseInt(value, 10)
  if (!Number.isFinite(numberValue)) {
    return null
  }

  return numberValue
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRemoteSnapshot(sourceObject) {
  return {
    filename: sourceObject.filename || '',
    filesize: sourceObject.filesize || 0,
    width: sourceObject.width || null,
    height: sourceObject.height || null,
    mimetype: sourceObject.mimetype || '',
    filepath: sourceObject.filepath || '',
    thumfor: sourceObject.thumfor || '',
    thumWidth: sourceObject.thumWidth || null,
    thumHeight: sourceObject.thumHeight || null,
    createdAt: sourceObject.createdAt || null,
    updatedAt: sourceObject.updatedAt || null
  }
}

function increaseCopiedCount(context, collectionName, action) {
  if (!context.copiedCounts[collectionName]) {
    context.copiedCounts[collectionName] = {
      created: 0,
      reused: 0
    }
  }

  context.copiedCounts[collectionName][action]++
}

function getCacheKey(collectionName, sourceObject, context) {
  const sourceId = getSourceIdentityId(sourceObject)
  let sourceIdText = ''
  if (sourceId) {
    sourceIdText = String(sourceId)
  }

  return [
    collectionName,
    sourceIdText,
    context.languageCode,
    TRANSLATION_RECORD_KIND
  ].join(':')
}

async function resolveSourceSnapshotRecord(collectionName, sourceRecordId) {
  if (!sourceRecordId) {
    return null
  }

  if (isDocumentObject(sourceRecordId)) {
    return sourceRecordId
  }

  const recordId = toObjectId(sourceRecordId)
  if (!recordId) {
    return null
  }

  const model = getMultilingualModel(collectionName)
  const query = model.findOne({
    _id: recordId,
    recordKind: SOURCE_RECORD_KIND
  })
  const populate = getSnapshotPopulateForCollection(collectionName)
  if (populate) {
    query.populate(populate)
  }

  return await query
}

function buildTranslationRecordFilter(collectionName, sourceObject, context) {
  const sourceId = getSourceIdentityId(sourceObject)

  return {
    sourceCollection: collectionName,
    sourceId,
    languageCode: context.languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }
}

async function findExistingTranslationRecord(
  model,
  collectionName,
  sourceObject,
  context
) {
  const filter = buildTranslationRecordFilter(
    collectionName,
    sourceObject,
    context
  )
  const existingRecord = await model.findOne(filter)
  if (existingRecord) {
    return existingRecord
  }

  if (collectionName !== 'attachments') {
    return null
  }

  const sourceId = getSourceIdentityId(sourceObject)
  return await model.findOne({
    sourceCollection: collectionName,
    sourceId,
    languageCode: context.languageCode,
    mediaMode: 'remote'
  })
}

function applyCollectionDefaults(collectionName, data, sourceObject, context) {
  const sourceId = getSourceIdentityId(sourceObject)

  if (collectionName === 'users') {
    data.username = `source:${String(sourceId)}:${context.languageCode}`
    data.password = AUTHOR_SNAPSHOT_PASSWORD
    data.role = 0
    data.disabled = true
    data.pwversion = 0
    if (!data.nickname) {
      data.nickname = data.username
    }
  }

  if (collectionName === 'attachments') {
    if (!data.filename) {
      data.filename = data.name || data.filepath || 'remote-file'
    }
    data.mediaMode = 'remote'
    data.remoteSourceId = toObjectId(sourceObject.remoteSourceId) || sourceId
    data.remoteFilepath =
      sourceObject.remoteFilepath || sourceObject.filepath || ''
    if (
      sourceObject.remoteSnapshot &&
      Object.keys(sourceObject.remoteSnapshot).length > 0
    ) {
      data.remoteSnapshot = cloneValue(sourceObject.remoteSnapshot)
    } else {
      data.remoteSnapshot = buildRemoteSnapshot(sourceObject)
    }
    data.localFilepath = ''
    data.localThumbnailPath = ''
    data.localStorageStatus = 'none'
  }
}

function applyPostDefaults(data, sourceObject, context) {
  data.alias = normalizeAlias(sourceObject.alias)
  data.views = 0
  data.likes = 0
  data.shares = 0
  data.comnum = 0
  data.status = 0
  data.date = sourceObject.date || context.now
  data.lastChangDate = context.now
  data.sourceChanged = false
  data.pendingReview = false
  data.sourceChangedAt = null
}

async function copyRelationListToLanguage(collectionName, sourceList, context) {
  const result = []
  if (!Array.isArray(sourceList)) {
    return result
  }

  for (const sourceItem of sourceList) {
    const copiedRecord = await copyRelationToLanguage(
      collectionName,
      sourceItem,
      context.languageCode,
      context.sourceSnapshotId,
      context
    )
    if (copiedRecord && copiedRecord._id) {
      result.push(copiedRecord._id)
    }
  }

  return result
}

async function applyDependencyFields(
  collectionName,
  data,
  sourceObject,
  context
) {
  const dependencies = COLLECTION_DEPENDENCY_FIELDS[collectionName] || []
  for (const dependency of dependencies) {
    const sourceValue = sourceObject[dependency.field]
    if (!sourceValue) {
      data[dependency.field] = null
      continue
    }

    const copiedRecord = await copyRelationToLanguage(
      dependency.collectionName,
      sourceValue,
      context.languageCode,
      context.sourceSnapshotId,
      context
    )
    if (copiedRecord && copiedRecord._id) {
      data[dependency.field] = copiedRecord._id
    } else {
      data[dependency.field] = null
    }
  }
}

async function applyPostRelationFields(data, sourceObject, context, options) {
  for (const field of POST_RELATION_FIELDS) {
    delete data[field]
  }

  const fieldsToCopy = []
  if (options.copyPostRelations === false) {
    fieldsToCopy.push('coverImages')
  } else {
    fieldsToCopy.push(...POST_RELATION_FIELDS)
  }

  for (const field of fieldsToCopy) {
    const singleCollectionName = POST_SINGLE_RELATION_COLLECTIONS[field]
    if (singleCollectionName) {
      const copiedRecord = await copyRelationToLanguage(
        singleCollectionName,
        sourceObject[field],
        context.languageCode,
        context.sourceSnapshotId,
        context
      )
      if (copiedRecord && copiedRecord._id) {
        data[field] = copiedRecord._id
      } else {
        data[field] = null
      }
      continue
    }

    const collectionName = POST_ARRAY_RELATION_COLLECTIONS[field]
    data[field] = await copyRelationListToLanguage(
      collectionName,
      sourceObject[field] || [],
      context
    )
  }
}

async function buildTranslationRecordData(
  collectionName,
  sourceDoc,
  context,
  options
) {
  const sourceObject = cloneValue(sourceDoc)
  const sourceId = getSourceIdentityId(sourceObject)
  const data = stripFields(sourceObject, SYSTEM_FIELDS)
  const recordId = options.recordId

  applyCollectionDefaults(collectionName, data, sourceObject, context)

  data.languageCode = context.languageCode
  data.sourceLanguageCode =
    sourceObject.sourceLanguageCode || context.sourceLanguageCode
  data.sourceId = sourceId
  data.sourceCollection = collectionName
  data.sourceSnapshotId = context.sourceSnapshotId
  data.recordKind = TRANSLATION_RECORD_KIND
  data.snapshotVersion =
    sourceObject.snapshotVersion || context.snapshotVersion || 1
  data.sourceSnapshotAt =
    sourceObject.sourceSnapshotAt || context.sourceSnapshotAt
  data.sourceUpdatedAt =
    sourceObject.sourceUpdatedAt || sourceObject.updatedAt || null
  data.sourceHash = sourceObject.sourceHash || ''

  if (collectionName === 'posts') {
    data.translationGroupId =
      sourceObject.translationGroupId || context.translationGroupId || recordId
    applyPostDefaults(data, sourceObject, context)
    await applyPostRelationFields(data, sourceObject, context, options)
  } else {
    data.translationGroupId = context.translationGroupId
    await applyDependencyFields(collectionName, data, sourceObject, context)
  }

  return data
}

async function copySourceSnapshotRecord(
  collectionName,
  sourceDoc,
  context,
  options = {}
) {
  if (!sourceDoc) {
    return null
  }

  const sourceObject = cloneValue(sourceDoc)
  const sourceId = getSourceIdentityId(sourceObject)
  if (!sourceId) {
    return null
  }

  const recordOptions = {
    copyPostRelations: true,
    ...options
  }
  const model = getMultilingualModel(collectionName)
  const cacheKey = getCacheKey(collectionName, sourceObject, context)

  if (context.copyCache.has(cacheKey)) {
    return context.copyCache.get(cacheKey)
  }

  const existingRecord = await findExistingTranslationRecord(
    model,
    collectionName,
    sourceObject,
    context
  )
  if (existingRecord) {
    increaseCopiedCount(context, collectionName, 'reused')
    context.copyCache.set(cacheKey, existingRecord)
    return existingRecord
  }

  const recordId = recordOptions.recordId || new mongoose.Types.ObjectId()
  context.copyCache.set(cacheKey, { _id: recordId })

  const data = await buildTranslationRecordData(
    collectionName,
    sourceDoc,
    context,
    {
      ...recordOptions,
      recordId
    }
  )

  if (collectionName === 'posts') {
    await assertAliasAvailable(
      context.languageCode,
      data.alias,
      data.type,
      recordId,
      data.status
    )
  }

  data._id = recordId
  const createdRecord = await new model(data).save()
  increaseCopiedCount(context, collectionName, 'created')
  context.copyCache.set(cacheKey, createdRecord)
  return createdRecord
}

async function copyRelationToLanguage(
  collectionName,
  sourceRecordId,
  languageCode,
  sourceSnapshotId,
  context
) {
  const sourceRecord = await resolveSourceSnapshotRecord(
    collectionName,
    sourceRecordId
  )
  if (!sourceRecord) {
    return null
  }

  const relationContext = {
    ...context,
    languageCode,
    sourceSnapshotId: sourceSnapshotId || context.sourceSnapshotId
  }
  const options = {}
  if (collectionName === 'posts') {
    options.copyPostRelations = false
  }

  return await copySourceSnapshotRecord(
    collectionName,
    sourceRecord,
    relationContext,
    options
  )
}

function buildCopyContext(sourcePost, languageCode, now) {
  return {
    languageCode,
    sourceLanguageCode: sourcePost.sourceLanguageCode,
    translationGroupId: sourcePost.translationGroupId || sourcePost._id,
    sourceSnapshotId: sourcePost._id,
    snapshotVersion: sourcePost.snapshotVersion || 1,
    sourceSnapshotAt: sourcePost.sourceSnapshotAt || now,
    now,
    copiedCounts: {},
    copyCache: new Map()
  }
}

async function findSourcePostSnapshot(sourceSnapshotId) {
  if (!mongoose.Types.ObjectId.isValid(sourceSnapshotId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  const PostModel = getPostModel()
  const sourcePost = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(sourceSnapshotId),
    recordKind: SOURCE_RECORD_KIND,
    sourceCollection: SOURCE_POST_COLLECTION
  }).populate(buildMultilingualPostPopulate())

  if (!sourcePost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  return sourcePost
}

async function ensureSourcePostSnapshotRelations(sourcePost) {
  const repairedSourcePost =
    await importPostSourceService.repairSourcePostSnapshotRelations(sourcePost)

  if (!hasRelationValue(repairedSourcePost?.author)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_POST_NOT_FOUND,
      '源文章作者不存在，无法生成产品级多语言快照',
      'author',
      400
    )
  }

  return repairedSourcePost
}

async function buildMissingPostRelationUpdateData(post, sourcePost, context) {
  const updateData = {}

  for (const field of POST_RELATION_FIELDS) {
    if (!isPostRelationMissing(post, field)) {
      continue
    }

    if (!hasRelationValue(sourcePost[field])) {
      continue
    }

    const singleCollectionName = POST_SINGLE_RELATION_COLLECTIONS[field]
    if (singleCollectionName) {
      const copiedRecord = await copyRelationToLanguage(
        singleCollectionName,
        sourcePost[field],
        context.languageCode,
        context.sourceSnapshotId,
        context
      )
      if (copiedRecord && copiedRecord._id) {
        updateData[field] = copiedRecord._id
      }
      continue
    }

    const collectionName = POST_ARRAY_RELATION_COLLECTIONS[field]
    updateData[field] = await copyRelationListToLanguage(
      collectionName,
      sourcePost[field],
      context
    )
  }

  return updateData
}

async function findTranslationPostDetailById(id) {
  const PostModel = getPostModel()
  return await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(id),
    recordKind: TRANSLATION_RECORD_KIND
  })
    .populate(buildMultilingualPostPopulate())
    .lean()
}

async function repairTranslationPostRelationsIfNeeded(post) {
  if (!post || hasRelationValue(post.author)) {
    return post
  }

  if (!post.sourceSnapshotId) {
    return post
  }

  let sourcePost = await findSourcePostSnapshot(post.sourceSnapshotId)
  sourcePost = await ensureSourcePostSnapshotRelations(sourcePost)

  const now = new Date()
  const context = buildCopyContext(sourcePost, post.languageCode, now)
  const updateData = await buildMissingPostRelationUpdateData(
    post,
    sourcePost,
    context
  )
  const updateFields = Object.keys(updateData)
  if (updateFields.length === 0) {
    return post
  }

  updateData.lastChangDate = now
  const PostModel = getPostModel()
  await PostModel.updateOne(
    { _id: post._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: updateData }
  )

  return await findTranslationPostDetailById(post._id)
}

async function assertAliasAvailable(
  languageCode,
  aliasValue,
  type,
  excludeId,
  status
) {
  const alias = normalizeAlias(aliasValue)
  const statusValue = parseOptionalNumber(status)
  if (!alias || statusValue === 99) {
    return
  }

  let typeValue = parseOptionalNumber(type)
  if (typeValue === null) {
    typeValue = type
  }

  const query = {
    languageCode,
    alias,
    type: typeValue,
    recordKind: TRANSLATION_RECORD_KIND,
    status: { $ne: 99 }
  }
  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  const PostModel = getPostModel()
  const existingPost = await PostModel.findOne(query).select('_id').lean()
  if (existingPost) {
    throw new ApiError(
      ERROR_CODES.ALIAS_CONFLICT_IN_LANGUAGE,
      undefined,
      'alias',
      409
    )
  }
}

function parseCreateInput(body = {}) {
  const sourceSnapshotId = String(body.sourceSnapshotId || '').trim()
  const languageCode = normalizeLanguageCode(body.languageCode)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  const copyMode = body.copyMode || 'source'
  if (copyMode !== 'source') {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'copyMode only supports source',
      'copyMode',
      400
    )
  }

  return {
    sourceSnapshotId,
    languageCode,
    copyMode
  }
}

async function createTranslationPost(body = {}) {
  const input = parseCreateInput(body)
  let sourcePost = await findSourcePostSnapshot(input.sourceSnapshotId)
  sourcePost = await ensureSourcePostSnapshotRelations(sourcePost)
  const translationGroupId = sourcePost.translationGroupId || sourcePost._id
  const PostModel = getPostModel()
  const existingTranslation = await PostModel.findOne({
    translationGroupId,
    languageCode: input.languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (existingTranslation) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_EXISTS,
      undefined,
      'languageCode',
      409,
      {
        translationPostId: existingTranslation._id,
        translationGroupId,
        languageCode: input.languageCode
      }
    )
  }

  await assertAliasAvailable(
    input.languageCode,
    sourcePost.alias,
    sourcePost.type,
    null,
    0
  )

  const now = new Date()
  const context = buildCopyContext(sourcePost, input.languageCode, now)
  const translationPost = await copySourceSnapshotRecord(
    'posts',
    sourcePost,
    context,
    {
      recordId: new mongoose.Types.ObjectId(),
      copyPostRelations: true
    }
  )

  return {
    translationPostId: translationPost._id,
    translationGroupId,
    languageCode: input.languageCode,
    copiedCounts: context.copiedCounts
  }
}

function buildEmptyTranslationMatrix() {
  const translations = {}
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    translations[code] = null
  }

  return translations
}

async function getTranslationGroupIdsByTranslationFilter(filter) {
  const PostModel = getPostModel()
  const translations = await PostModel.find(filter)
    .select('translationGroupId')
    .lean()
  const idSet = new Set()

  for (const translation of translations) {
    if (translation.translationGroupId) {
      idSet.add(String(translation.translationGroupId))
    }
  }

  return Array.from(idSet).map(id => new mongoose.Types.ObjectId(id))
}

async function buildTranslationMatrixMap(translationGroupIds) {
  const matrixMap = {}
  for (const groupId of translationGroupIds) {
    matrixMap[String(groupId)] = buildEmptyTranslationMatrix()
  }

  if (translationGroupIds.length === 0) {
    return matrixMap
  }

  const PostModel = getPostModel()
  const translations = await PostModel.find({
    translationGroupId: { $in: translationGroupIds },
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select(
      '_id title excerpt alias type languageCode translationGroupId status snapshotVersion sourceChanged pendingReview sourceChangedAt lastChangDate updatedAt'
    )
    .lean()

  for (const translation of translations) {
    const groupKey = String(translation.translationGroupId)
    if (!matrixMap[groupKey]) {
      matrixMap[groupKey] = buildEmptyTranslationMatrix()
    }
    matrixMap[groupKey][translation.languageCode] = translation
  }

  return matrixMap
}

async function getTranslationPostListBySource(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const limit = parsePositiveInteger(query.limit, 20, 100)
  const sourceParams = {
    sourceCollection: SOURCE_POST_COLLECTION,
    recordKind: SOURCE_RECORD_KIND
  }

  if (query.sourceLanguageCode) {
    const sourceLanguageCode = normalizeLanguageCode(query.sourceLanguageCode)
    if (!sourceLanguageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'sourceLanguageCode',
        400
      )
    }
    sourceParams.sourceLanguageCode = sourceLanguageCode
  }

  const type = parseOptionalNumber(query.type)
  if (type !== null) {
    sourceParams.type = type
  }

  if (query.keyword) {
    const keyword = String(query.keyword).trim()
    const keywordRegExp = new RegExp(escapeRegExp(keyword), 'i')
    const keywordConditions = [
      { title: keywordRegExp },
      { alias: keywordRegExp },
      { excerpt: keywordRegExp }
    ]
    if (mongoose.Types.ObjectId.isValid(keyword)) {
      keywordConditions.push({ sourceId: new mongoose.Types.ObjectId(keyword) })
    }
    sourceParams.$or = keywordConditions
  }

  const translationFilter = {
    recordKind: TRANSLATION_RECORD_KIND
  }
  let shouldFilterByTranslation = false

  if (query.languageCode) {
    const languageCode = normalizeLanguageCode(query.languageCode)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'languageCode',
        400
      )
    }
    translationFilter.languageCode = languageCode
    shouldFilterByTranslation = true
  }

  const status = parseOptionalNumber(query.status)
  if (status !== null) {
    translationFilter.status = status
    shouldFilterByTranslation = true
  }

  if (shouldFilterByTranslation) {
    sourceParams.translationGroupId = {
      $in: await getTranslationGroupIdsByTranslationFilter(translationFilter)
    }
  }

  const PostModel = getPostModel()
  const total = await PostModel.countDocuments(sourceParams)
  const sourcePosts = await PostModel.find(sourceParams)
    .select(
      '_id title excerpt alias type status sourceId sourceLanguageCode languageCode translationGroupId snapshotVersion sourceSnapshotAt sourceUpdatedAt updatedAt'
    )
    .sort({ sourceSnapshotAt: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  const translationGroupIds = sourcePosts
    .map(item => item.translationGroupId)
    .filter(Boolean)
  const matrixMap = await buildTranslationMatrixMap(translationGroupIds)
  const list = sourcePosts.map(sourcePost => {
    const groupKey = String(sourcePost.translationGroupId)
    return {
      sourcePost,
      translations: matrixMap[groupKey] || buildEmptyTranslationMatrix()
    }
  })

  return {
    list,
    total,
    page,
    limit
  }
}

function pickRelationGroup(post, fields) {
  const result = {}
  for (const field of fields) {
    result[field] = post[field] || []
  }
  return result
}

async function getTranslationPostDetail(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'translation post not found',
      'id',
      404
    )
  }

  let post = await findTranslationPostDetailById(id)

  if (!post) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'translation post not found',
      'id',
      404
    )
  }

  post = await repairTranslationPostRelationsIfNeeded(post)

  return {
    post,
    author: post.author || null,
    sort: post.sort || null,
    tags: post.tags || [],
    mappointList: post.mappointList || [],
    coverImages: post.coverImages || [],
    recommendRelations: pickRelationGroup(post, POST_RECOMMEND_RELATION_FIELDS),
    contentRelations: pickRelationGroup(post, POST_CONTENT_RELATION_FIELDS)
  }
}

function buildPostUpdateData(body = {}) {
  const updateData = {}
  for (const field of POST_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updateData[field] = body[field]
    }
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'alias')) {
    updateData.alias = normalizeAlias(updateData.alias)
  }

  return updateData
}

function assertUpdateLanguageMatched(post, body = {}) {
  if (!Object.prototype.hasOwnProperty.call(body, 'languageCode')) {
    return
  }

  const languageCode = normalizeLanguageCode(body.languageCode)
  if (!languageCode || languageCode !== post.languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      'languageCode does not match translation post',
      'languageCode',
      400
    )
  }
}

async function updateTranslationPost(body = {}) {
  const id = String(body.id || '').trim()
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'translation post not found',
      'id',
      404
    )
  }

  const PostModel = getPostModel()
  const post = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(id),
    recordKind: TRANSLATION_RECORD_KIND
  })

  if (!post) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'translation post not found',
      'id',
      404
    )
  }

  assertUpdateLanguageMatched(post, body)

  const updateData = buildPostUpdateData(body)
  let nextAlias = post.alias
  if (Object.prototype.hasOwnProperty.call(updateData, 'alias')) {
    nextAlias = updateData.alias
  }

  let nextType = post.type
  if (Object.prototype.hasOwnProperty.call(updateData, 'type')) {
    nextType = updateData.type
  }

  let nextStatus = post.status
  if (Object.prototype.hasOwnProperty.call(updateData, 'status')) {
    nextStatus = updateData.status
  }

  await assertAliasAvailable(
    post.languageCode,
    nextAlias,
    nextType,
    post._id,
    nextStatus
  )

  updateData.lastChangDate = new Date()
  if (body.confirmReview === true) {
    updateData.sourceChanged = false
    updateData.pendingReview = false
    updateData.sourceChangedAt = null
  }

  await PostModel.updateOne(
    { _id: post._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: updateData }
  )

  return await getTranslationPostDetail(post._id)
}

module.exports = {
  createTranslationPost,
  getTranslationPostListBySource,
  getTranslationPostDetail,
  updateTranslationPost
}
