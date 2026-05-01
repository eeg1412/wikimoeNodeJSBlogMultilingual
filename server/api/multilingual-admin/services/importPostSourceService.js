const crypto = require('crypto')
const mongoose = require('mongoose')
const {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGE_CODES
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const { buildSourcePostPopulate } = require('../../../utils/sourcePostPopulate')
const contentRefreshUtils = require('../../../utils/contentRefresh')

const AUTHOR_SNAPSHOT_PASSWORD = '__AUTHOR_SNAPSHOT_NO_LOGIN__'
const SOURCE_POST_COLLECTION = 'posts'
const SOURCE_RECORD_KIND = 'source'
const TRANSLATION_RECORD_KIND = 'translation'
const RELATION_COPY_CONCURRENCY = 4

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

const HASH_IGNORED_FIELDS = new Set([
  '_id',
  'id',
  '__v',
  'createdAt',
  'updatedAt'
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

const SOURCE_POST_LIST_SELECT_FIELDS = [
  '_id',
  'title',
  'alias',
  'type',
  'status',
  'date',
  'updatedAt',
  'createdAt',
  'author',
  'excerpt',
  'sort',
  'tags',
  'mappointList',
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList',
  'seriesSortList',
  'contentSeriesSortList'
].join(' ')

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

function getSourceRepository(collectionName) {
  const repository = global.$mongodDB.source.repositories[collectionName]
  if (!repository) {
    throw new Error(`source repository not found: ${collectionName}`)
  }

  return repository
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

function isSameObjectIdValue(left, right) {
  const leftId = toObjectId(left)
  const rightId = toObjectId(right)
  if (!leftId || !rightId) {
    return false
  }

  return String(leftId) === String(rightId)
}

function getDocumentIdString(value) {
  const objectId = toObjectId(value)
  if (!objectId) {
    return ''
  }

  return String(objectId)
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

function isRelationRecordMissingSourceId(record) {
  return isDocumentObject(record) && !record.sourceId
}

function hasMissingRelationSourceId(value) {
  if (Array.isArray(value)) {
    return value.some(item => isRelationRecordMissingSourceId(item))
  }

  return isRelationRecordMissingSourceId(value)
}

function needsSourcePostRelationRepair(post) {
  if (!hasRelationValue(post.author)) {
    return true
  }

  return POST_RELATION_FIELDS.some(field => {
    return hasMissingRelationSourceId(post[field])
  })
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

function stableValue(value) {
  if (value === undefined) {
    return null
  }

  if (value === null) {
    return null
  }

  if (isBsonObjectId(value)) {
    return String(value)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(item => stableValue(item))
  }

  if (typeof value === 'object') {
    const result = {}
    const keys = Object.keys(value).sort()
    for (const key of keys) {
      result[key] = stableValue(value[key])
    }
    return result
  }

  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function createSourceHash(sourceDoc) {
  const sourceObject = cloneValue(sourceDoc)
  const hashObject = stripFields(sourceObject, HASH_IGNORED_FIELDS)
  const hashText = stableStringify(hashObject)
  return crypto.createHash('sha256').update(hashText).digest('hex')
}

function increaseCopiedCount(context, collectionName, action) {
  if (!context.copiedCounts[collectionName]) {
    context.copiedCounts[collectionName] = {
      created: 0,
      reused: 0,
      updated: 0
    }
  }

  context.copiedCounts[collectionName][action]++
}

function getCacheKey(collectionName, sourceDoc, context) {
  const sourceId = getDocumentIdString(sourceDoc)
  return [
    collectionName,
    sourceId,
    context.languageCode,
    context.sourceLanguageCode,
    context.recordKind
  ].join(':')
}

function getContextCache(context, cacheName) {
  if (!context[cacheName]) {
    context[cacheName] = new Map()
  }

  return context[cacheName]
}

async function getOrCreateCopyResult(context, cacheKey, factory) {
  const copyPromiseCache = getContextCache(context, 'copyPromiseCache')
  if (copyPromiseCache.has(cacheKey)) {
    return await copyPromiseCache.get(cacheKey)
  }

  const copyPromise = (async () => {
    try {
      return await factory()
    } finally {
      copyPromiseCache.delete(cacheKey)
    }
  })()

  copyPromiseCache.set(cacheKey, copyPromise)
  return await copyPromise
}

function getSourceRecordCacheKey(collectionName, sourceValue) {
  const sourceId = getDocumentIdString(sourceValue)
  if (!sourceId) {
    return ''
  }

  return [collectionName, sourceId].join(':')
}

function getUniqueRelationSourceList(sourceList) {
  if (!Array.isArray(sourceList) || sourceList.length === 0) {
    return []
  }

  const result = []
  const seenSourceIdSet = new Set()

  for (const sourceItem of sourceList) {
    const sourceId = getDocumentIdString(sourceItem)
    if (!sourceId) {
      result.push(sourceItem)
      continue
    }

    if (seenSourceIdSet.has(sourceId)) {
      continue
    }

    seenSourceIdSet.add(sourceId)
    result.push(sourceItem)
  }

  return result
}

async function mapWithConcurrency(itemList, concurrency, mapper) {
  if (!Array.isArray(itemList) || itemList.length === 0) {
    return []
  }

  const result = new Array(itemList.length)
  let nextIndex = 0
  const workerCount = Math.min(concurrency, itemList.length)

  async function worker() {
    while (nextIndex < itemList.length) {
      const currentIndex = nextIndex
      nextIndex++
      result[currentIndex] = await mapper(itemList[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return result
}

function getSourcePopulateForCollection(collectionName) {
  if (collectionName === 'posts') {
    return buildSourcePostPopulate()
  }

  if (collectionName === 'users') {
    return { path: 'cover' }
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

async function loadSourceRecord(collectionName, sourceId) {
  const repository = getSourceRepository(collectionName)
  const options = {
    lean: true
  }
  const populate = getSourcePopulateForCollection(collectionName)
  if (populate) {
    options.populate = populate
  }

  return await repository.findOne({ _id: sourceId }, undefined, options)
}

async function resolveSourceRecord(collectionName, sourceValue, context) {
  if (!sourceValue) {
    return null
  }

  if (isDocumentObject(sourceValue)) {
    return sourceValue
  }

  const sourceId = toObjectId(sourceValue)
  if (!sourceId) {
    return null
  }

  const cacheKey = getSourceRecordCacheKey(collectionName, sourceId)
  if (!cacheKey) {
    return await loadSourceRecord(collectionName, sourceId)
  }

  const sourceRecordCache = getContextCache(context, 'sourceRecordCache')
  if (!sourceRecordCache.has(cacheKey)) {
    sourceRecordCache.set(cacheKey, loadSourceRecord(collectionName, sourceId))
  }

  try {
    return await sourceRecordCache.get(cacheKey)
  } catch (error) {
    sourceRecordCache.delete(cacheKey)
    throw error
  }
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

function applyCollectionDefaults(collectionName, data, sourceObject, context) {
  if (collectionName === 'users') {
    const sourceId = getDocumentIdString(sourceObject)
    data.username = `source:${sourceId}:${context.languageCode}`
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
    data.remoteSourceId = toObjectId(sourceObject)
    data.remoteFilepath = sourceObject.filepath || ''
    data.remoteSnapshot = buildRemoteSnapshot(sourceObject)
    data.localFilepath = ''
    data.localThumbnailPath = ''
    data.localStorageStatus = 'none'
  }
}

async function copyRelatedRecord(collectionName, sourceValue, context) {
  const sourceRecord = await resolveSourceRecord(
    collectionName,
    sourceValue,
    context
  )
  if (!sourceRecord) {
    return null
  }

  const options = {}
  if (collectionName === 'posts') {
    options.copyPostRelations = false
    options.useSelfTranslationGroup = true
  }

  return await copySourceRecord(collectionName, sourceRecord, context, options)
}

async function copyRelatedRecordList(collectionName, sourceList, context) {
  const uniqueSourceList = getUniqueRelationSourceList(sourceList)
  const copiedRecordList = await mapWithConcurrency(
    uniqueSourceList,
    RELATION_COPY_CONCURRENCY,
    async sourceItem => {
      return await copyRelatedRecord(collectionName, sourceItem, context)
    }
  )

  return copiedRecordList
    .filter(copiedRecord => copiedRecord && copiedRecord._id)
    .map(copiedRecord => copiedRecord._id)
}

async function applyDependencyFields(
  collectionName,
  data,
  sourceObject,
  context
) {
  const dependencies = COLLECTION_DEPENDENCY_FIELDS[collectionName] || []
  const dependencyEntries = await mapWithConcurrency(
    dependencies,
    RELATION_COPY_CONCURRENCY,
    async dependency => {
      const sourceValue = sourceObject[dependency.field]
      if (!sourceValue) {
        return {
          field: dependency.field,
          value: null
        }
      }

      const copiedRecord = await copyRelatedRecord(
        dependency.collectionName,
        sourceValue,
        context
      )

      return {
        field: dependency.field,
        value: copiedRecord && copiedRecord._id ? copiedRecord._id : null
      }
    }
  )

  for (const entry of dependencyEntries) {
    data[entry.field] = entry.value
  }
}

async function copyPostRelationField(field, sourceObject, context) {
  if (POST_SINGLE_RELATION_COLLECTIONS[field]) {
    const copiedRecord = await copyRelatedRecord(
      POST_SINGLE_RELATION_COLLECTIONS[field],
      sourceObject[field],
      context
    )
    if (copiedRecord && copiedRecord._id) {
      return copiedRecord._id
    }

    return null
  }

  const collectionName = POST_ARRAY_RELATION_COLLECTIONS[field]
  return await copyRelatedRecordList(
    collectionName,
    sourceObject[field] || [],
    context
  )
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

  const relationEntries = await mapWithConcurrency(
    fieldsToCopy,
    RELATION_COPY_CONCURRENCY,
    async field => {
      return {
        field,
        value: await copyPostRelationField(field, sourceObject, context)
      }
    }
  )

  for (const entry of relationEntries) {
    data[entry.field] = entry.value
  }
}

async function buildSourceRecordData(
  collectionName,
  sourceDoc,
  context,
  options
) {
  const sourceObject = cloneValue(sourceDoc)
  const sourceId = toObjectId(sourceObject)
  const data = stripFields(sourceObject, SYSTEM_FIELDS)
  const recordId = options.recordId

  applyCollectionDefaults(collectionName, data, sourceObject, context)

  data.languageCode = context.languageCode
  data.sourceLanguageCode = context.sourceLanguageCode
  data.sourceId = sourceId
  data.sourceCollection = collectionName
  if (!context.sourceSnapshotId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '源快照上下文缺失，已停止导入以避免关联内容串源',
      'sourceSnapshotId',
      409
    )
  }

  data.sourceSnapshotId = context.sourceSnapshotId
  data.recordKind = context.recordKind
  data.snapshotVersion = context.snapshotVersion
  data.sourceSnapshotAt = context.sourceSnapshotAt
  data.sourceUpdatedAt = sourceObject.updatedAt || null
  data.sourceHash = createSourceHash(sourceObject)

  if (collectionName === 'posts' && options.useSelfTranslationGroup) {
    data.translationGroupId = recordId
  } else {
    if (!context.translationGroupId) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '源快照翻译组上下文缺失，已停止导入以避免关联内容串源',
        'translationGroupId',
        409
      )
    }

    data.translationGroupId = context.translationGroupId
  }

  if (collectionName === 'posts') {
    await applyPostRelationFields(data, sourceObject, context, options)
  } else {
    await applyDependencyFields(collectionName, data, sourceObject, context)
  }

  return data
}

function buildSourceRecordFilter(collectionName, sourceDoc, context) {
  const sourceId = toObjectId(sourceDoc)

  if (collectionName === 'posts') {
    return {
      sourceCollection: collectionName,
      sourceId,
      sourceLanguageCode: context.sourceLanguageCode,
      recordKind: context.recordKind
    }
  }

  if (collectionName === 'attachments') {
    return {
      sourceCollection: collectionName,
      sourceId,
      languageCode: context.languageCode,
      mediaMode: 'remote'
    }
  }

  return {
    sourceCollection: collectionName,
    sourceId,
    languageCode: context.languageCode,
    recordKind: context.recordKind
  }
}

async function copySourceRecord(
  collectionName,
  sourceDoc,
  context,
  options = {}
) {
  const sourceId = toObjectId(sourceDoc)
  if (!sourceId) {
    return null
  }

  const recordOptions = {
    copyPostRelations: true,
    ...options
  }
  const cacheKey = getCacheKey(collectionName, sourceDoc, context)

  if (context.copyCache.has(cacheKey)) {
    return context.copyCache.get(cacheKey)
  }

  let recordId = recordOptions.recordId
  if (!recordId) {
    recordId = new mongoose.Types.ObjectId()
  }

  const shouldSeedPlaceholder =
    collectionName === 'posts' && Boolean(recordOptions.recordId)

  if (shouldSeedPlaceholder) {
    context.copyCache.set(cacheKey, { _id: recordId })
  }

  return await getOrCreateCopyResult(context, cacheKey, async () => {
    const model = getMultilingualModel(collectionName)
    const filter = buildSourceRecordFilter(collectionName, sourceDoc, context)
    const existingRecord = await model.findOne(filter).select('_id').lean()
    if (existingRecord && recordOptions.updateExisting !== true) {
      increaseCopiedCount(context, collectionName, 'reused')
      context.copyCache.set(cacheKey, existingRecord)
      return existingRecord
    }

    if (existingRecord) {
      recordId = existingRecord._id
    }

    const data = await buildSourceRecordData(
      collectionName,
      sourceDoc,
      context,
      {
        ...recordOptions,
        recordId
      }
    )

    if (existingRecord) {
      await model.updateOne({ _id: existingRecord._id }, { $set: data })
      const updatedRecord = { _id: existingRecord._id }
      increaseCopiedCount(context, collectionName, 'updated')
      context.copyCache.set(cacheKey, updatedRecord)
      return updatedRecord
    }

    data._id = recordId
    await new model(data).save()
    const createdRecord = { _id: recordId }
    increaseCopiedCount(context, collectionName, 'created')
    context.copyCache.set(cacheKey, createdRecord)
    return createdRecord
  })
}

function parseSourcePostInput(body, forceOverwrite) {
  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }

  let sourceId = ''
  if (body.sourceId) {
    sourceId = String(body.sourceId).trim()
  }

  let alias = ''
  if (body.alias) {
    alias = String(body.alias).trim()
  }

  if (!sourceId && !alias) {
    throw new ApiError(
      ERROR_CODES.SOURCE_POST_ID_OR_ALIAS_REQUIRED,
      undefined,
      'sourceId',
      400
    )
  }

  if (sourceId && !mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      'sourceId',
      400
    )
  }

  let overwrite = body.overwrite === true
  if (forceOverwrite) {
    overwrite = true
  }

  return {
    sourceId,
    alias,
    sourceLanguageCode,
    overwrite
  }
}

async function findSourcePost(input) {
  const query = {}
  if (input.sourceId) {
    query._id = new mongoose.Types.ObjectId(input.sourceId)
  } else {
    query.alias = input.alias
  }

  const sourcePost = await global.$mongodDB.source.repositories.posts.findOne(
    query,
    undefined,
    {
      populate: buildSourcePostPopulate(),
      lean: true
    }
  )

  if (!sourcePost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_POST_NOT_FOUND,
      undefined,
      'sourceId',
      404
    )
  }

  return sourcePost
}

function buildImportContext(
  sourceLanguageCode,
  snapshotVersion,
  snapshotAt,
  snapshotId,
  translationGroupId
) {
  return {
    languageCode: sourceLanguageCode,
    sourceLanguageCode,
    recordKind: SOURCE_RECORD_KIND,
    translationGroupId,
    sourceSnapshotId: snapshotId,
    snapshotVersion,
    sourceSnapshotAt: snapshotAt,
    copiedCounts: {},
    copyCache: new Map()
  }
}

async function markTranslationsPendingReview(translationGroupId, now) {
  const PostModel = getPostModel()
  const result = await PostModel.updateMany(
    {
      translationGroupId,
      recordKind: TRANSLATION_RECORD_KIND
    },
    {
      $set: {
        sourceChanged: true,
        pendingReview: true,
        sourceChangedAt: now
      }
    }
  )

  return result.modifiedCount || 0
}

async function findExistingSourceSnapshot(sourceId, sourceLanguageCode) {
  if (!sourceId) {
    return null
  }

  const PostModel = getPostModel()
  return await PostModel.findOne({
    sourceCollection: SOURCE_POST_COLLECTION,
    sourceId,
    sourceLanguageCode,
    recordKind: SOURCE_RECORD_KIND
  })
    .select('_id translationGroupId snapshotVersion sourceHash')
    .lean()
}

async function importOrOverwriteSourcePost(body, forceOverwrite, options = {}) {
  const input = parseSourcePostInput(body || {}, forceOverwrite)
  let existingSnapshot = null

  if (input.sourceId) {
    existingSnapshot = await findExistingSourceSnapshot(
      new mongoose.Types.ObjectId(input.sourceId),
      input.sourceLanguageCode
    )

    if (existingSnapshot && input.overwrite !== true) {
      throw new ApiError(
        ERROR_CODES.SOURCE_EXISTS,
        undefined,
        'sourceId',
        409,
        {
          sourceSnapshotId: existingSnapshot._id,
          snapshotVersion: existingSnapshot.snapshotVersion
        }
      )
    }
  }

  const sourcePost = await findSourcePost(input)
  const sourceId = toObjectId(sourcePost)
  const sourceHash = createSourceHash(sourcePost)

  if (!existingSnapshot) {
    existingSnapshot = await findExistingSourceSnapshot(
      sourceId,
      input.sourceLanguageCode
    )
  }

  if (existingSnapshot && input.overwrite !== true) {
    throw new ApiError(ERROR_CODES.SOURCE_EXISTS, undefined, 'sourceId', 409, {
      sourceSnapshotId: existingSnapshot._id,
      snapshotVersion: existingSnapshot.snapshotVersion
    })
  }

  const now = new Date()
  let snapshotVersion = 1
  let hasSourceHashChanged = false
  let sourceSnapshotId = new mongoose.Types.ObjectId()
  let translationGroupId = sourceSnapshotId

  if (existingSnapshot) {
    sourceSnapshotId = existingSnapshot._id
    translationGroupId = sourceSnapshotId
    snapshotVersion = existingSnapshot.snapshotVersion || 1
    if (existingSnapshot.sourceHash !== sourceHash) {
      hasSourceHashChanged = true
      snapshotVersion++
    }
  }

  const context = buildImportContext(
    input.sourceLanguageCode,
    snapshotVersion,
    now,
    sourceSnapshotId,
    translationGroupId
  )

  await copySourceRecord('posts', sourcePost, context, {
    updateExisting: true,
    recordId: sourceSnapshotId,
    copyPostRelations: true
  })
  if (options.skipContentRefresh !== true) {
    await contentRefreshUtils.refreshArticlePublishing(input.sourceLanguageCode)
  }

  let sourceChangedTranslations = 0
  if (existingSnapshot && hasSourceHashChanged) {
    sourceChangedTranslations = await markTranslationsPendingReview(
      translationGroupId,
      now
    )
  }

  return {
    sourceSnapshotId,
    translationGroupId,
    snapshotVersion,
    copiedCounts: context.copiedCounts,
    sourceHash,
    sourceChangedTranslations
  }
}

async function findSourcePostSnapshotById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }

  const PostModel = getPostModel()
  return await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(id),
    recordKind: SOURCE_RECORD_KIND,
    sourceCollection: SOURCE_POST_COLLECTION
  })
    .populate(buildSourcePostPopulate())
    .lean()
}

async function repairSourcePostSnapshotRelations(sourcePost) {
  if (!sourcePost || !needsSourcePostRelationRepair(sourcePost)) {
    return sourcePost
  }

  const sourceId = toObjectId(sourcePost.sourceId)
  if (!sourceId) {
    return sourcePost
  }

  await importOrOverwriteSourcePost(
    {
      sourceId: String(sourceId),
      sourceLanguageCode:
        sourcePost.sourceLanguageCode || DEFAULT_LANGUAGE_CODE,
      overwrite: true
    },
    true
  )

  return await findSourcePostSnapshotById(sourcePost._id)
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function getTranslationGroupIdsByLanguage(languageCode) {
  const PostModel = getPostModel()
  const translations = await PostModel.find({
    recordKind: TRANSLATION_RECORD_KIND,
    languageCode
  })
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

function buildEmptyTranslationSummary() {
  const languages = {}
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    languages[code] = null
  }

  return {
    total: 0,
    languages
  }
}

function getSourcePostGroupKey(sourcePost) {
  const translationGroupId = toObjectId(sourcePost.translationGroupId)
  if (translationGroupId) {
    return String(translationGroupId)
  }

  const sourceSnapshotId = toObjectId(sourcePost)
  if (sourceSnapshotId) {
    return String(sourceSnapshotId)
  }

  return ''
}

function isTranslationMatchedSourcePost(translation, sourcePost) {
  if (!translation || !sourcePost) {
    return false
  }

  if (!isSameObjectIdValue(translation.sourceSnapshotId, sourcePost._id)) {
    return false
  }

  if (!isSameObjectIdValue(translation.sourceId, sourcePost.sourceId)) {
    return false
  }

  return true
}

async function normalizeSourcePostSnapshotIdentity(sourcePost) {
  const sourceSnapshotId = toObjectId(sourcePost)
  if (!sourceSnapshotId) {
    return sourcePost
  }

  if (isSameObjectIdValue(sourcePost.translationGroupId, sourceSnapshotId)) {
    return sourcePost
  }

  const PostModel = getPostModel()
  await PostModel.updateOne(
    {
      _id: sourceSnapshotId,
      recordKind: SOURCE_RECORD_KIND,
      sourceCollection: SOURCE_POST_COLLECTION
    },
    {
      $set: {
        translationGroupId: sourceSnapshotId
      }
    }
  )

  return {
    ...sourcePost,
    translationGroupId: sourceSnapshotId
  }
}

async function normalizeSourcePostSnapshotIdentityList(sourcePosts) {
  return await Promise.all(
    sourcePosts.map(sourcePost => {
      return normalizeSourcePostSnapshotIdentity(sourcePost)
    })
  )
}

async function buildTranslationSummaryMap(sourcePosts) {
  const summaryMap = {}
  const sourcePostMap = new Map()
  for (const sourcePost of sourcePosts) {
    const groupKey = getSourcePostGroupKey(sourcePost)
    summaryMap[groupKey] = buildEmptyTranslationSummary()
    sourcePostMap.set(groupKey, sourcePost)
  }

  const translationGroupIds = Array.from(sourcePostMap.keys()).map(id => {
    return new mongoose.Types.ObjectId(id)
  })
  if (translationGroupIds.length === 0) {
    return summaryMap
  }

  const PostModel = getPostModel()
  const translations = await PostModel.find({
    translationGroupId: { $in: translationGroupIds },
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select(
      '_id sourceId sourceSnapshotId translationGroupId languageCode status snapshotVersion sourceChanged pendingReview updatedAt'
    )
    .lean()

  for (const translation of translations) {
    const groupKey = String(translation.translationGroupId)
    const sourcePost = sourcePostMap.get(groupKey)
    if (!isTranslationMatchedSourcePost(translation, sourcePost)) {
      continue
    }

    summaryMap[groupKey].total++
    summaryMap[groupKey].languages[translation.languageCode] = {
      _id: translation._id,
      status: translation.status,
      snapshotVersion: translation.snapshotVersion,
      sourceChanged: translation.sourceChanged,
      pendingReview: translation.pendingReview,
      updatedAt: translation.updatedAt
    }
  }

  return summaryMap
}

async function getSourcePostList(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const limit = parsePositiveInteger(query.limit, 20, 100)
  const params = {
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
    params.sourceLanguageCode = sourceLanguageCode
  }

  if (query.snapshotVersionMin) {
    params.snapshotVersion = params.snapshotVersion || {}
    params.snapshotVersion.$gte = parsePositiveInteger(
      query.snapshotVersionMin,
      1
    )
  }

  if (query.snapshotVersionMax) {
    params.snapshotVersion = params.snapshotVersion || {}
    params.snapshotVersion.$lte = parsePositiveInteger(
      query.snapshotVersionMax,
      1
    )
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
    params.$or = keywordConditions
  }

  if (query.hasTranslationLanguageCode) {
    const languageCode = normalizeLanguageCode(query.hasTranslationLanguageCode)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'hasTranslationLanguageCode',
        400
      )
    }
    params.translationGroupId = {
      $in: await getTranslationGroupIdsByLanguage(languageCode)
    }
  }

  const PostModel = getPostModel()
  const total = await PostModel.countDocuments(params)
  const list = await PostModel.find(params)
    .select(
      '_id title excerpt alias type sourceId sourceLanguageCode translationGroupId snapshotVersion sourceSnapshotAt updatedAt'
    )
    .sort({ sourceSnapshotAt: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  const normalizedList = await normalizeSourcePostSnapshotIdentityList(list)
  const summaryMap = await buildTranslationSummaryMap(normalizedList)
  const rows = normalizedList.map(item => {
    const summary =
      summaryMap[getSourcePostGroupKey(item)] || buildEmptyTranslationSummary()
    return {
      _id: item._id,
      title: item.title,
      excerpt: item.excerpt,
      alias: item.alias,
      type: item.type,
      sourceId: item.sourceId,
      sourceLanguageCode: item.sourceLanguageCode,
      translationGroupId: item.translationGroupId,
      snapshotVersion: item.snapshotVersion,
      sourceSnapshotAt: item.sourceSnapshotAt,
      updatedAt: item.updatedAt,
      translationSummary: summary
    }
  })

  return {
    list: rows,
    total,
    page,
    limit
  }
}

async function getSourceDatabasePostList(query = {}) {
  const page = parsePositiveInteger(query.page, 1)
  const limit = parsePositiveInteger(query.limit, 20, 100)
  let sourceLanguageCode = ''
  if (query.sourceLanguageCode) {
    sourceLanguageCode = normalizeLanguageCode(query.sourceLanguageCode)
    if (!sourceLanguageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'sourceLanguageCode',
        400
      )
    }
  }
  const params = {
    type: { $in: [1, 2, 3] },
    status: { $ne: 99 }
  }

  if (query.type !== undefined && query.type !== '') {
    const type = Number.parseInt(query.type, 10)
    if (![1, 2, 3].includes(type)) {
      throw new ApiError(
        ERROR_CODES.SOURCE_POST_NOT_FOUND,
        undefined,
        'type',
        400
      )
    }
    params.type = type
  }

  if (query.status !== undefined && query.status !== '') {
    const status = Number.parseInt(query.status, 10)
    if (![0, 1, 99].includes(status)) {
      throw new ApiError(
        ERROR_CODES.SOURCE_POST_NOT_FOUND,
        undefined,
        'status',
        400
      )
    }
    params.status = status
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
      keywordConditions.push({ _id: new mongoose.Types.ObjectId(keyword) })
    }
    params.$or = keywordConditions
  }

  const sourcePostsRepository = getSourceRepository('posts')
  const total = await sourcePostsRepository.countDocuments(params)
  const sourcePostQuery = sourcePostsRepository.find(
    params,
    SOURCE_POST_LIST_SELECT_FIELDS,
    {
      sort: { date: -1, _id: -1 },
      lean: true,
      populate: buildSourcePostPopulate()
    }
  )
  const list = await sourcePostQuery.skip((page - 1) * limit).limit(limit)
  const sourceIds = list.map(item => item._id).filter(Boolean)
  const PostModel = getPostModel()
  const snapshotParams = {
    sourceCollection: SOURCE_POST_COLLECTION,
    sourceId: { $in: sourceIds },
    recordKind: SOURCE_RECORD_KIND
  }
  if (sourceLanguageCode) {
    snapshotParams.sourceLanguageCode = sourceLanguageCode
  }
  const snapshots = await PostModel.find(snapshotParams)
    .select(
      '_id sourceId sourceLanguageCode translationGroupId snapshotVersion sourceSnapshotAt updatedAt sourceHash'
    )
    .lean()

  const snapshotMap = new Map()
  const snapshotSummaryMap = new Map()
  for (const snapshot of snapshots) {
    const sourceIdText = String(snapshot.sourceId)
    if (!snapshotSummaryMap.has(sourceIdText)) {
      snapshotSummaryMap.set(sourceIdText, [])
    }
    snapshotSummaryMap.get(sourceIdText).push(snapshot)
    if (sourceLanguageCode) {
      snapshotMap.set(sourceIdText, snapshot)
    }
  }

  return {
    list: list.map(item => {
      const sourceIdText = String(item._id)
      let snapshot = null
      if (sourceLanguageCode) {
        snapshot = snapshotMap.get(sourceIdText) || null
      }
      const snapshotSummary = snapshotSummaryMap.get(sourceIdText) || []
      return {
        ...item,
        sourceId: item._id,
        hasSnapshot: snapshotSummary.length > 0,
        snapshot,
        snapshotSummary
      }
    }),
    total,
    page,
    limit,
    sourceLanguageCode
  }
}

async function getSourceDatabasePostDetail(query = {}) {
  const sourceId = String(query.id || query.sourceId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      'sourceId',
      400
    )
  }

  let sourceLanguageCode = ''
  if (query.sourceLanguageCode) {
    sourceLanguageCode = normalizeLanguageCode(query.sourceLanguageCode)
    if (!sourceLanguageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'sourceLanguageCode',
        400
      )
    }
  }

  const post = await findSourcePost({ sourceId })
  const PostModel = getPostModel()
  const snapshotParams = {
    sourceCollection: SOURCE_POST_COLLECTION,
    sourceId: new mongoose.Types.ObjectId(sourceId),
    recordKind: SOURCE_RECORD_KIND
  }
  if (sourceLanguageCode) {
    snapshotParams.sourceLanguageCode = sourceLanguageCode
  }
  const snapshotSummary = await PostModel.find(snapshotParams)
    .select(
      '_id sourceId sourceLanguageCode translationGroupId snapshotVersion sourceSnapshotAt updatedAt sourceHash'
    )
    .lean()

  return {
    post: {
      ...post,
      sourceId: post._id,
      hasSnapshot: snapshotSummary.length > 0,
      snapshotSummary
    }
  }
}

function pickRelationGroup(post, fields) {
  const result = {}
  for (const field of fields) {
    result[field] = post[field] || []
  }
  return result
}

async function getSourcePostDetail(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'id',
      404
    )
  }

  let post = await findSourcePostSnapshotById(id)

  if (!post) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'id',
      404
    )
  }

  post = await normalizeSourcePostSnapshotIdentity(post)
  post = await repairSourcePostSnapshotRelations(post)
  post = await normalizeSourcePostSnapshotIdentity(post)

  const PostModel = getPostModel()

  const rawTranslations = await PostModel.find({
    translationGroupId: post.translationGroupId,
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select(
      '_id title excerpt alias type sourceId sourceSnapshotId languageCode status snapshotVersion sourceChanged pendingReview sourceChangedAt updatedAt'
    )
    .sort({ languageCode: 1 })
    .lean()
  const translations = rawTranslations.filter(translation => {
    return isTranslationMatchedSourcePost(translation, post)
  })

  return {
    post,
    author: post.author || null,
    sort: post.sort || null,
    tags: post.tags || [],
    mappointList: post.mappointList || [],
    coverImages: post.coverImages || [],
    recommendRelations: pickRelationGroup(post, POST_RECOMMEND_RELATION_FIELDS),
    contentRelations: pickRelationGroup(post, POST_CONTENT_RELATION_FIELDS),
    translations,
    orphanRelations: [],
    orphanMedia: []
  }
}

module.exports = {
  createSourceHash,
  copySourceRecord,
  repairSourcePostSnapshotRelations,
  importOrOverwriteSourcePost,
  getSourceDatabasePostList,
  getSourceDatabasePostDetail,
  getSourcePostList,
  getSourcePostDetail
}
