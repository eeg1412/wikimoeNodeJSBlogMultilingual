const mongoose = require('mongoose')
const utils = require('../../../utils/utils')
const cacheDataUtils = require('../../../config/cacheData')
const contentRefreshUtils = require('../../../utils/contentRefresh')
const {
  normalizeLanguageCode,
  SUPPORTED_LANGUAGE_CODES
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const importPostSourceService = require('./importPostSourceService')
const relationService = require('./relationService')

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
  'aiTranslationSkip',
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

const POST_RELATION_EXPECTED_TYPE_MAP = {
  postList: 1,
  contentPostList: 1,
  tweetList: 2,
  contentTweetList: 2
}

const POST_RELATION_FIELDS = [
  ...Object.keys(POST_SINGLE_RELATION_COLLECTIONS),
  ...Object.keys(POST_ARRAY_RELATION_COLLECTIONS)
]

const POST_RELATION_FIELD_CONFIGS = [
  ...Object.keys(POST_SINGLE_RELATION_COLLECTIONS).map(field => ({
    field,
    collectionName: POST_SINGLE_RELATION_COLLECTIONS[field],
    multiple: false
  })),
  ...Object.keys(POST_ARRAY_RELATION_COLLECTIONS).map(field => ({
    field,
    collectionName: POST_ARRAY_RELATION_COLLECTIONS[field],
    multiple: true
  }))
]

const RESTORABLE_COLLECTION_NAMES = new Set([
  'users',
  'sorts',
  'tags',
  'mappoints',
  'bangumis',
  'movies',
  'games',
  'gamePlatforms',
  'books',
  'booktypes',
  'events',
  'eventtypes',
  'posts',
  'votes',
  'attachments'
])

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
  'type',
  'top',
  'sortop',
  'status',
  'allowRemark',
  'aiTranslationSkip',
  'template',
  'code',
  'editorVersion',
  'client__v',
  'author',
  'sort',
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
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList'
]

const POST_SINGLE_RELATION_EDIT_FIELDS = new Set(['author', 'sort'])
const POST_ARRAY_RELATION_EDIT_FIELDS = new Set(
  Object.keys(POST_ARRAY_RELATION_COLLECTIONS)
)

const PREVIEW_RELATION_DEPENDENCY_FIELDS = {
  sorts: [{ field: 'parent', collectionName: 'sorts', multiple: false }],
  games: [
    { field: 'gamePlatform', collectionName: 'gamePlatforms', multiple: false }
  ],
  books: [{ field: 'booktype', collectionName: 'booktypes', multiple: false }],
  events: [{ field: 'eventtype', collectionName: 'eventtypes', multiple: false }]
}

const SOURCE_POST_LIST_SELECT_FIELDS = [
  // Required by translation matrix summaries: _id title alias type languageCode translationGroupId status
  '_id',
  'title',
  'excerpt',
  'alias',
  'type',
  'status',
  'date',
  'sourceId',
  'sourceLanguageCode',
  'languageCode',
  'translationGroupId',
  'snapshotVersion',
  'sourceSnapshotAt',
  'sourceUpdatedAt',
  'updatedAt',
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

const TRANSLATION_POST_LIST_SELECT_FIELDS = [
  '_id',
  'title',
  'excerpt',
  'alias',
  'type',
  'languageCode',
  'translationGroupId',
  'status',
  'snapshotVersion',
  'sourceChanged',
  'pendingReview',
  'sourceChangedAt',
  'lastChangDate',
  'date',
  'updatedAt',
  'sourceId',
  'sourceSnapshotId',
  'sourceLanguageCode',
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

const POST_DETAIL_ATTACHMENT_SELECT_FIELDS = [
  '_id',
  'sourceId',
  'sourceLanguageCode',
  'languageCode',
  'translationGroupId',
  'snapshotVersion',
  'sourceSnapshotAt',
  'sourceUpdatedAt',
  'createdAt',
  'updatedAt',
  'name',
  'filename',
  'filesize',
  'filepath',
  'width',
  'height',
  'mimetype',
  'thumfor',
  'thumWidth',
  'thumHeight',
  'album',
  'description',
  'is360Panorama',
  'status',
  'mediaMode',
  'remoteSourceId',
  'remoteFilepath',
  'remoteSnapshot',
  'localFilepath',
  'localThumbnailPath',
  'localStorageStatus'
].join(' ')

const POST_RELATED_ATTACHMENT_PREVIEW_SELECT_FIELDS = [
  '_id',
  'name',
  'filename',
  'filepath',
  'remoteFilepath',
  'localFilepath',
  'localThumbnailPath',
  'thumfor',
  'width',
  'height',
  'thumWidth',
  'thumHeight',
  'mimetype',
  'mediaMode',
  'is360Panorama'
].join(' ')

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
  const postDetailCoverPopulate = {
    path: 'coverImages',
    select: POST_DETAIL_ATTACHMENT_SELECT_FIELDS
  }
  const postCoverPopulate = {
    path: 'coverImages',
    select: POST_RELATED_ATTACHMENT_PREVIEW_SELECT_FIELDS
  }

  return [
    {
      path: 'author',
      select: '-password',
      populate: {
        path: 'cover'
      }
    },
    {
      path: 'sort',
      populate: {
        path: 'parent'
      }
    },
    { path: 'tags' },
    {
      path: 'mappointList',
      match: { status: matchStatus }
    },
    postDetailCoverPopulate,
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

function isSameObjectIdValue(left, right) {
  const leftId = toObjectId(left)
  const rightId = toObjectId(right)
  if (!leftId || !rightId) {
    return false
  }

  return String(leftId) === String(rightId)
}

function getSourceIdentityId(sourceObject) {
  const sourceId = toObjectId(sourceObject.sourceId)
  if (sourceId) {
    return sourceId
  }

  return toObjectId(sourceObject)
}

function getRequiredSourcePostSnapshotIdentity(sourcePost) {
  const sourceSnapshotId = toObjectId(sourcePost)
  if (!sourceSnapshotId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '源快照身份缺失，已停止创建以避免串源',
      'sourceSnapshotId',
      409
    )
  }

  const sourceId = toObjectId(sourcePost.sourceId)
  if (!sourceId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '源快照缺少源文章 ID，已停止创建以避免串源',
      'sourceId',
      409,
      {
        sourceSnapshotId: String(sourceSnapshotId)
      }
    )
  }

  const translationGroupId = toObjectId(sourcePost.translationGroupId)
  if (!translationGroupId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '源快照翻译组缺失，已停止创建以避免串源',
      'translationGroupId',
      409,
      {
        sourceSnapshotId: String(sourceSnapshotId),
        sourceId: String(sourceId)
      }
    )
  }

  if (!isSameObjectIdValue(translationGroupId, sourceSnapshotId)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '源快照翻译组与源快照身份不一致，已停止创建以避免串源',
      'translationGroupId',
      409,
      {
        sourceSnapshotId: String(sourceSnapshotId),
        sourceId: String(sourceId),
        translationGroupId: String(translationGroupId)
      }
    )
  }

  return {
    sourceSnapshotId,
    sourceId,
    translationGroupId
  }
}

function canRepairLegacyPostIdentity(record, expectedIdentity) {
  const existingSourceId = toObjectId(record.sourceId)
  if (!existingSourceId) {
    return false
  }

  if (!isSameObjectIdValue(existingSourceId, expectedIdentity.sourceId)) {
    return false
  }

  const existingSourceSnapshotId = toObjectId(record.sourceSnapshotId)
  if (
    existingSourceSnapshotId &&
    !isSameObjectIdValue(
      existingSourceSnapshotId,
      expectedIdentity.sourceSnapshotId
    )
  ) {
    return false
  }

  return true
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

function getSourceSnapshotCacheKey(collectionName, sourceRecordId) {
  const recordId = toObjectId(sourceRecordId)
  if (!recordId) {
    return ''
  }

  return [collectionName, String(recordId), SOURCE_RECORD_KIND].join(':')
}

function getUniqueRelationSourceList(sourceList) {
  if (!Array.isArray(sourceList) || sourceList.length === 0) {
    return []
  }

  const result = []
  const seenSourceIdSet = new Set()

  for (const sourceItem of sourceList) {
    const sourceId = getSourceIdentityId(sourceItem)
    if (!sourceId) {
      result.push(sourceItem)
      continue
    }

    const sourceIdText = String(sourceId)
    if (seenSourceIdSet.has(sourceIdText)) {
      continue
    }

    seenSourceIdSet.add(sourceIdText)
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

async function loadSourceSnapshotRecord(collectionName, recordId) {
  const model = getMultilingualModel(collectionName)
  const query = model
    .findOne({
      _id: recordId,
      recordKind: SOURCE_RECORD_KIND
    })
    .lean()
  const populate = getSnapshotPopulateForCollection(collectionName)
  if (populate) {
    query.populate(populate)
  }

  const sourceRecord = await query
  if (collectionName === SOURCE_POST_COLLECTION && sourceRecord) {
    return await normalizeSourcePostSnapshotIdentity(sourceRecord)
  }

  return sourceRecord
}

async function resolveSourceSnapshotRecord(
  collectionName,
  sourceRecordId,
  context
) {
  if (!sourceRecordId) {
    return null
  }

  if (isDocumentObject(sourceRecordId)) {
    if (collectionName === SOURCE_POST_COLLECTION) {
      return await normalizeSourcePostSnapshotIdentity(sourceRecordId)
    }

    return sourceRecordId
  }

  const recordId = toObjectId(sourceRecordId)
  if (!recordId) {
    return null
  }

  const cacheKey = getSourceSnapshotCacheKey(collectionName, recordId)
  if (!cacheKey) {
    return await loadSourceSnapshotRecord(collectionName, recordId)
  }

  const sourceRecordCache = getContextCache(context, 'sourceRecordCache')
  if (!sourceRecordCache.has(cacheKey)) {
    sourceRecordCache.set(
      cacheKey,
      loadSourceSnapshotRecord(collectionName, recordId)
    )
  }

  try {
    return await sourceRecordCache.get(cacheKey)
  } catch (error) {
    sourceRecordCache.delete(cacheKey)
    throw error
  }
}

function buildTranslationRecordFilter(
  collectionName,
  sourceObject,
  context,
  options = {}
) {
  const postIdentity =
    collectionName === SOURCE_POST_COLLECTION
      ? getRequiredSourcePostSnapshotIdentity(sourceObject)
      : null
  const sourceId = postIdentity
    ? postIdentity.sourceId
    : getSourceIdentityId(sourceObject)
  const filter = {
    sourceCollection: collectionName,
    sourceId,
    languageCode: context.languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }

  if (collectionName === SOURCE_POST_COLLECTION) {
    const translationGroupId = options.useSelfTranslationGroup
      ? postIdentity.translationGroupId
      : toObjectId(context.translationGroupId)

    if (!translationGroupId) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '源快照翻译组缺失，已停止创建以避免串源',
        'translationGroupId',
        409
      )
    }

    if (
      !isSameObjectIdValue(translationGroupId, postIdentity.translationGroupId)
    ) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '源快照翻译组与当前上下文不匹配，已停止创建以避免串源',
        'translationGroupId',
        409,
        {
          expectedTranslationGroupId: String(postIdentity.translationGroupId),
          actualTranslationGroupId: String(translationGroupId),
          sourceSnapshotId: String(postIdentity.sourceSnapshotId),
          sourceId: String(postIdentity.sourceId)
        }
      )
    }

    filter.sourceSnapshotId = postIdentity.sourceSnapshotId
    filter.translationGroupId = translationGroupId
  }

  return filter
}

async function findExistingTranslationRecord(
  model,
  collectionName,
  sourceObject,
  context,
  options = {}
) {
  const filter = buildTranslationRecordFilter(
    collectionName,
    sourceObject,
    context,
    options
  )
  const existingRecord = await model.findOne(filter).select('_id').lean()
  if (existingRecord) {
    return existingRecord
  }

  if (collectionName === SOURCE_POST_COLLECTION && filter.translationGroupId) {
    const conflictingRecord = await model
      .findOne({
        translationGroupId: filter.translationGroupId,
        languageCode: context.languageCode,
        recordKind: TRANSLATION_RECORD_KIND
      })
      .select('_id sourceId sourceSnapshotId translationGroupId languageCode')
      .lean()

    if (conflictingRecord) {
      const expectedIdentity = {
        sourceSnapshotId: filter.sourceSnapshotId,
        sourceId: filter.sourceId,
        translationGroupId: filter.translationGroupId
      }
      if (canRepairLegacyPostIdentity(conflictingRecord, expectedIdentity)) {
        await model.updateOne(
          { _id: conflictingRecord._id },
          {
            $set: {
              sourceCollection: SOURCE_POST_COLLECTION,
              sourceId: filter.sourceId,
              sourceSnapshotId: filter.sourceSnapshotId,
              translationGroupId: filter.translationGroupId
            }
          }
        )

        return { _id: conflictingRecord._id }
      }

      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '已存在同一源快照组的语言版本，但源快照身份不匹配，已停止创建以避免串源',
        'sourceSnapshotId',
        409,
        {
          existingTranslationId: String(conflictingRecord._id),
          existingSourceSnapshotId: conflictingRecord.sourceSnapshotId
            ? String(conflictingRecord.sourceSnapshotId)
            : null,
          expectedSourceSnapshotId: filter.sourceSnapshotId
            ? String(filter.sourceSnapshotId)
            : null,
          existingSourceId: conflictingRecord.sourceId
            ? String(conflictingRecord.sourceId)
            : null,
          expectedSourceId: filter.sourceId ? String(filter.sourceId) : null,
          translationGroupId: String(filter.translationGroupId),
          languageCode: context.languageCode
        }
      )
    }
  }

  if (collectionName !== 'attachments') {
    return null
  }

  const sourceId = getSourceIdentityId(sourceObject)
  return await model
    .findOne({
      sourceCollection: collectionName,
      sourceId,
      languageCode: context.languageCode,
      mediaMode: 'remote'
    })
    .select('_id')
    .lean()
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
  const uniqueSourceList = getUniqueRelationSourceList(sourceList)
  const copiedRecordList = await mapWithConcurrency(
    uniqueSourceList,
    RELATION_COPY_CONCURRENCY,
    async sourceItem => {
      return await copyRelationToLanguage(
        collectionName,
        sourceItem,
        context.languageCode,
        context.sourceSnapshotId,
        context
      )
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

      const copiedRecord = await copyRelationToLanguage(
        dependency.collectionName,
        sourceValue,
        context.languageCode,
        context.sourceSnapshotId,
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

async function copyPostRelationFieldToLanguage(field, sourceObject, context) {
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
      return copiedRecord._id
    }

    return null
  }

  const collectionName = POST_ARRAY_RELATION_COLLECTIONS[field]
  return await copyRelationListToLanguage(
    collectionName,
    sourceObject[field] || [],
    context
  )
}

async function applyPostRelationFields(data, sourceObject, context, options) {
  for (const field of POST_RELATION_FIELDS) {
    delete data[field]
  }

  if (options.skipPostRelations === true) {
    return
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
        value: await copyPostRelationFieldToLanguage(
          field,
          sourceObject,
          context
        )
      }
    }
  )

  for (const entry of relationEntries) {
    data[entry.field] = entry.value
  }
}

async function buildPostRelationIndexUpdateData(sourcePost, context) {
  const updateData = {}
  const relationEntries = await mapWithConcurrency(
    POST_RELATION_FIELDS,
    RELATION_COPY_CONCURRENCY,
    async field => {
      return {
        field,
        value: await copyPostRelationFieldToLanguage(field, sourcePost, context)
      }
    }
  )

  for (const entry of relationEntries) {
    updateData[entry.field] = entry.value
  }

  return updateData
}

async function buildTranslationRecordData(
  collectionName,
  sourceDoc,
  context,
  options
) {
  const sourceObject = cloneValue(sourceDoc)
  const postIdentity =
    collectionName === SOURCE_POST_COLLECTION
      ? getRequiredSourcePostSnapshotIdentity(sourceObject)
      : null
  const sourceId = postIdentity
    ? postIdentity.sourceId
    : getSourceIdentityId(sourceObject)
  const data = stripFields(sourceObject, SYSTEM_FIELDS)

  applyCollectionDefaults(collectionName, data, sourceObject, context)

  data.languageCode = context.languageCode
  data.sourceLanguageCode =
    sourceObject.sourceLanguageCode || context.sourceLanguageCode
  data.sourceId = sourceId
  data.sourceCollection = collectionName
  data.sourceSnapshotId = postIdentity
    ? postIdentity.sourceSnapshotId
    : context.sourceSnapshotId
  data.recordKind = TRANSLATION_RECORD_KIND
  data.snapshotVersion =
    sourceObject.snapshotVersion || context.snapshotVersion || 1
  data.sourceSnapshotAt =
    sourceObject.sourceSnapshotAt || context.sourceSnapshotAt
  data.sourceUpdatedAt =
    sourceObject.sourceUpdatedAt || sourceObject.updatedAt || null
  data.sourceHash = sourceObject.sourceHash || ''

  if (collectionName === 'posts') {
    if (options.useSelfTranslationGroup === true) {
      data.translationGroupId = postIdentity.translationGroupId
    } else {
      const contextTranslationGroupId = toObjectId(context.translationGroupId)
      if (!contextTranslationGroupId) {
        throw new ApiError(
          ERROR_CODES.CONTENT_FIELD_INVALID,
          '源快照翻译组缺失，已停止创建以避免串源',
          'translationGroupId',
          409
        )
      }

      if (
        !isSameObjectIdValue(
          contextTranslationGroupId,
          postIdentity.translationGroupId
        )
      ) {
        throw new ApiError(
          ERROR_CODES.CONTENT_FIELD_INVALID,
          '源快照翻译组与当前上下文不匹配，已停止创建以避免串源',
          'translationGroupId',
          409,
          {
            expectedTranslationGroupId: String(postIdentity.translationGroupId),
            actualTranslationGroupId: String(contextTranslationGroupId),
            sourceSnapshotId: String(postIdentity.sourceSnapshotId),
            sourceId: String(postIdentity.sourceId)
          }
        )
      }

      data.translationGroupId = contextTranslationGroupId
    }
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
  const sourceIdentity =
    collectionName === SOURCE_POST_COLLECTION
      ? getRequiredSourcePostSnapshotIdentity(sourceObject)
      : null
  const sourceId = sourceIdentity
    ? sourceIdentity.sourceId
    : getSourceIdentityId(sourceObject)
  if (!sourceId) {
    return null
  }

  const recordOptions = {
    copyPostRelations: true,
    ...options
  }
  const cacheKey = getCacheKey(collectionName, sourceObject, context)

  if (context.copyCache.has(cacheKey)) {
    return context.copyCache.get(cacheKey)
  }

  const recordId = recordOptions.recordId || new mongoose.Types.ObjectId()
  const shouldSeedPlaceholder =
    collectionName === 'posts' && Boolean(recordOptions.recordId)

  if (shouldSeedPlaceholder) {
    context.copyCache.set(cacheKey, { _id: recordId })
  }

  return await getOrCreateCopyResult(context, cacheKey, async () => {
    const model = getMultilingualModel(collectionName)
    const existingRecord = await findExistingTranslationRecord(
      model,
      collectionName,
      sourceObject,
      context,
      recordOptions
    )
    if (existingRecord) {
      increaseCopiedCount(context, collectionName, 'reused')
      context.copyCache.set(cacheKey, existingRecord)
      return existingRecord
    }

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
    await new model(data).save()
    const createdRecord = { _id: recordId }
    if (collectionName === 'sorts') {
      cacheDataUtils.invalidateSortListCache(context.languageCode)
    }
    increaseCopiedCount(context, collectionName, 'created')
    context.copyCache.set(cacheKey, createdRecord)
    return createdRecord
  })
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
    sourceRecordId,
    context
  )
  if (!sourceRecord) {
    return null
  }

  const relationContext = {
    ...context,
    languageCode,
    sourceSnapshotId:
      toObjectId(sourceRecord) || sourceSnapshotId || context.sourceSnapshotId
  }
  const options = {}
  if (collectionName === 'posts') {
    options.copyPostRelations = false
    options.useSelfTranslationGroup = true
  }

  return await copySourceSnapshotRecord(
    collectionName,
    sourceRecord,
    relationContext,
    options
  )
}

function buildCopyContext(sourcePost, languageCode, now) {
  const sourceIdentity = getRequiredSourcePostSnapshotIdentity(sourcePost)
  return {
    languageCode,
    sourceLanguageCode: sourcePost.sourceLanguageCode,
    translationGroupId: sourceIdentity.translationGroupId,
    sourceSnapshotId: sourceIdentity.sourceSnapshotId,
    snapshotVersion: sourcePost.snapshotVersion || 1,
    sourceSnapshotAt: sourcePost.sourceSnapshotAt || now,
    now,
    copiedCounts: {},
    copyCache: new Map()
  }
}

async function findSourcePostSnapshotSummary(sourceSnapshotId) {
  if (!mongoose.Types.ObjectId.isValid(sourceSnapshotId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  const PostModel = getPostModel()
  const sourcePost = await PostModel.findOne(
    {
      _id: new mongoose.Types.ObjectId(sourceSnapshotId),
      recordKind: SOURCE_RECORD_KIND,
      sourceCollection: SOURCE_POST_COLLECTION
    },
    '_id sourceId translationGroupId sourceLanguageCode alias type snapshotVersion sourceSnapshotAt'
  ).lean()

  if (!sourcePost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  return await normalizeSourcePostSnapshotIdentity(sourcePost)
}

async function normalizeSourcePostSnapshotIdentity(sourcePost) {
  const sourceSnapshotId = toObjectId(sourcePost)
  if (!sourceSnapshotId) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'source snapshot id invalid',
      'sourceSnapshotId',
      404
    )
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

async function findSourcePostSnapshot(sourceSnapshotId) {
  const sourcePostSummary =
    await findSourcePostSnapshotSummary(sourceSnapshotId)

  const PostModel = getPostModel()
  const sourcePost = await PostModel.findOne({
    _id: sourcePostSummary._id,
    recordKind: SOURCE_RECORD_KIND,
    sourceCollection: SOURCE_POST_COLLECTION
  })
    .populate(buildMultilingualPostPopulate())
    .lean()

  if (!sourcePost) {
    return sourcePost
  }

  return await normalizeSourcePostSnapshotIdentity(sourcePost)
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

  const missingFields = POST_RELATION_FIELDS.filter(field => {
    if (!isPostRelationMissing(post, field)) {
      return false
    }

    return hasRelationValue(sourcePost[field])
  })

  const updateEntries = await mapWithConcurrency(
    missingFields,
    RELATION_COPY_CONCURRENCY,
    async field => {
      return {
        field,
        value: await copyPostRelationFieldToLanguage(field, sourcePost, context)
      }
    }
  )

  for (const entry of updateEntries) {
    updateData[entry.field] = entry.value
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

function parseCreateRelationTranslationInput(body = {}) {
  const postId = String(body.postId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_ID_INVALID,
      'translation post id invalid',
      'postId',
      400
    )
  }

  const sourceSnapshotId = String(body.sourceSnapshotId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceSnapshotId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  const relationField = String(body.relationField || '').trim()
  if (
    POST_ARRAY_RELATION_COLLECTIONS[relationField] !== SOURCE_POST_COLLECTION
  ) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'relationField is not a post relation field',
      'relationField',
      400
    )
  }

  return {
    postId,
    sourceSnapshotId,
    relationField
  }
}

function assertSourcePostTypeMatchesRelationField(relationField, sourcePost) {
  const expectedType = POST_RELATION_EXPECTED_TYPE_MAP[relationField]
  if (!expectedType) {
    return
  }

  const actualType = Number(sourcePost?.type)
  if (actualType === expectedType) {
    return
  }

  throw new ApiError(
    ERROR_CODES.CONTENT_FIELD_INVALID,
    '关联字段与源文章类型不匹配',
    'relationField',
    400,
    {
      expectedType,
      actualType,
      relationField
    }
  )
}

async function findExistingTranslationForSourcePost(sourcePost, languageCode) {
  const sourceIdentity = getRequiredSourcePostSnapshotIdentity(sourcePost)
  const sourceSnapshotId = sourceIdentity.sourceSnapshotId
  const sourceId = sourceIdentity.sourceId
  const translationGroupId = sourceIdentity.translationGroupId
  const PostModel = getPostModel()
  const existingTranslation = await PostModel.findOne({
    translationGroupId,
    sourceSnapshotId,
    sourceId,
    languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select('_id sourceId sourceSnapshotId translationGroupId languageCode')
    .lean()
  if (existingTranslation) {
    return existingTranslation
  }

  const conflictingTranslation = await PostModel.findOne({
    translationGroupId,
    languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select('_id sourceId sourceSnapshotId translationGroupId languageCode')
    .lean()
  if (!conflictingTranslation) {
    return null
  }

  if (canRepairLegacyPostIdentity(conflictingTranslation, sourceIdentity)) {
    await PostModel.updateOne(
      { _id: conflictingTranslation._id },
      {
        $set: {
          sourceCollection: SOURCE_POST_COLLECTION,
          sourceId,
          sourceSnapshotId,
          translationGroupId
        }
      }
    )

    return { _id: conflictingTranslation._id }
  }

  throw new ApiError(
    ERROR_CODES.CONTENT_FIELD_INVALID,
    '已存在的语言版本与当前源快照身份不匹配，已停止创建以避免串源',
    'sourceSnapshotId',
    409,
    {
      translationPostId: conflictingTranslation._id,
      expectedSourceSnapshotId: sourceSnapshotId,
      actualSourceSnapshotId: conflictingTranslation.sourceSnapshotId,
      expectedSourceId: sourceId,
      actualSourceId: conflictingTranslation.sourceId,
      languageCode
    }
  )
}

function getTranslationPostCreateLockKey(translationGroupId, languageCode) {
  return [
    'multilingualTranslationPostCreate',
    String(translationGroupId),
    languageCode
  ].join(':')
}

async function createTranslationPost(body = {}, options = {}) {
  const input = parseCreateInput(body)
  const sourcePostSummary = await findSourcePostSnapshotSummary(
    input.sourceSnapshotId
  )
  const sourceIdentity =
    getRequiredSourcePostSnapshotIdentity(sourcePostSummary)
  const translationGroupId = sourceIdentity.translationGroupId

  return await utils.executeInLock(
    getTranslationPostCreateLockKey(translationGroupId, input.languageCode),
    async () => {
      const existingTranslation = await findExistingTranslationForSourcePost(
        sourcePostSummary,
        input.languageCode
      )

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

      let sourcePost = await findSourcePostSnapshot(input.sourceSnapshotId)
      sourcePost = await ensureSourcePostSnapshotRelations(sourcePost)

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

      cacheDataUtils.invalidateSortListCache(input.languageCode)
      if (options.skipContentRefresh !== true) {
        await contentRefreshUtils.refreshArticlePublishing(input.languageCode)
      }

      return {
        translationPostId: translationPost._id,
        translationGroupId,
        languageCode: input.languageCode,
        copiedCounts: context.copiedCounts
      }
    }
  )
}

async function createMissingPostRelationTranslation(body = {}) {
  const input = parseCreateRelationTranslationInput(body)
  const PostModel = getPostModel()
  const post = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(input.postId),
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!post) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation post not found',
      'postId',
      404
    )
  }

  const sourcePostSummary = await findSourcePostSnapshotSummary(
    input.sourceSnapshotId
  )
  assertSourcePostTypeMatchesRelationField(
    input.relationField,
    sourcePostSummary
  )
  let translationPostId = null
  let created = false
  const existingTranslation = await findExistingTranslationForSourcePost(
    sourcePostSummary,
    post.languageCode
  )

  if (existingTranslation) {
    translationPostId = existingTranslation._id
  } else {
    const createResult = await createTranslationPost({
      sourceSnapshotId: input.sourceSnapshotId,
      languageCode: post.languageCode,
      copyMode: 'source'
    })
    translationPostId = createResult.translationPostId
    created = true
  }

  await PostModel.updateOne(
    { _id: post._id, recordKind: TRANSLATION_RECORD_KIND },
    {
      $addToSet: {
        [input.relationField]: translationPostId
      },
      $set: {
        lastChangDate: new Date()
      }
    }
  )
  await contentRefreshUtils.refreshArticlePublishing(post.languageCode)

  return {
    post: await getTranslationPostDetail(post._id),
    relationField: input.relationField,
    translationPostId,
    created
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

function getSourcePostGroupKey(sourcePost) {
  return String(
    getRequiredSourcePostSnapshotIdentity(sourcePost).translationGroupId
  )
}

function isTranslationMatchedSourcePost(translation, sourcePost) {
  if (!translation || !sourcePost) {
    return false
  }

  if (
    !isSameObjectIdValue(
      translation.translationGroupId,
      sourcePost.translationGroupId
    )
  ) {
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

async function repairTranslationPostIdentityForSource(record, sourcePost) {
  if (isTranslationMatchedSourcePost(record, sourcePost)) {
    return record
  }

  if (
    !isSameObjectIdValue(
      record.translationGroupId,
      sourcePost.translationGroupId
    )
  ) {
    return record
  }

  if (!isSameObjectIdValue(record.sourceId, sourcePost.sourceId)) {
    return record
  }

  const recordSourceSnapshotId = toObjectId(record.sourceSnapshotId)
  if (
    recordSourceSnapshotId &&
    !isSameObjectIdValue(recordSourceSnapshotId, sourcePost._id)
  ) {
    return record
  }

  const PostModel = getPostModel()
  await PostModel.updateOne(
    { _id: record._id, recordKind: TRANSLATION_RECORD_KIND },
    {
      $set: {
        sourceCollection: SOURCE_POST_COLLECTION,
        sourceId: sourcePost.sourceId,
        sourceSnapshotId: sourcePost._id,
        translationGroupId: sourcePost.translationGroupId
      }
    }
  )

  record.sourceCollection = SOURCE_POST_COLLECTION
  record.sourceId = sourcePost.sourceId
  record.sourceSnapshotId = sourcePost._id
  record.translationGroupId = sourcePost.translationGroupId
  return record
}

async function buildTranslationMatrixMap(sourcePosts) {
  const matrixMap = {}
  const sourcePostMap = new Map()
  for (const sourcePost of sourcePosts) {
    const groupKey = getSourcePostGroupKey(sourcePost)
    matrixMap[groupKey] = buildEmptyTranslationMatrix()
    sourcePostMap.set(groupKey, sourcePost)
  }

  const translationGroupIds = Array.from(sourcePostMap.keys()).map(id => {
    return new mongoose.Types.ObjectId(id)
  })
  if (translationGroupIds.length === 0) {
    return matrixMap
  }

  const PostModel = getPostModel()
  const translations = await PostModel.find({
    translationGroupId: { $in: translationGroupIds },
    recordKind: TRANSLATION_RECORD_KIND
  })
    .select(TRANSLATION_POST_LIST_SELECT_FIELDS)
    .populate(buildMultilingualPostPopulate())
    .lean()

  for (const translation of translations) {
    const groupKey = String(translation.translationGroupId)
    const sourcePost = sourcePostMap.get(groupKey)
    if (!isTranslationMatchedSourcePost(translation, sourcePost)) {
      continue
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

  if (query.sourceSnapshotId) {
    if (!mongoose.Types.ObjectId.isValid(query.sourceSnapshotId)) {
      throw new ApiError(
        ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
        undefined,
        'sourceSnapshotId',
        404
      )
    }
    sourceParams._id = new mongoose.Types.ObjectId(query.sourceSnapshotId)
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
    .select(SOURCE_POST_LIST_SELECT_FIELDS)
    .populate(buildMultilingualPostPopulate())
    .sort({ sourceSnapshotAt: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  const normalizedSourcePosts =
    await normalizeSourcePostSnapshotIdentityList(sourcePosts)
  const matrixMap = await buildTranslationMatrixMap(normalizedSourcePosts)
  const list = normalizedSourcePosts.map(sourcePost => {
    const groupKey = getSourcePostGroupKey(sourcePost)
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

  for (const field of POST_SINGLE_RELATION_EDIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updateData, field)) {
      updateData[field] = normalizeOptionalRelationId(updateData[field], field)
    }
  }

  for (const field of POST_ARRAY_RELATION_EDIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updateData, field)) {
      updateData[field] = normalizeRelationIdList(updateData[field], field)
    }
  }

  return updateData
}

function normalizeOptionalRelationId(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const objectId = toObjectId(value)
  if (!objectId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${fieldName} is not a valid relation id`,
      fieldName,
      400
    )
  }
  return objectId
}

function normalizeRelationIdList(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return []
  }

  if (!Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${fieldName} must be an array`,
      fieldName,
      400
    )
  }

  return value.map(item => normalizeOptionalRelationId(item, fieldName))
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

async function updateTranslationPost(body = {}, options = {}) {
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
  if (options.skipContentRefresh !== true) {
    await contentRefreshUtils.refreshArticlePublishing(post.languageCode)
  }

  return await getTranslationPostDetail(post._id)
}

function parseRestoreRecordInput(body = {}) {
  const collectionName = String(body.collectionName || 'posts').trim()
  if (!RESTORABLE_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }

  const id = String(body.id || '').trim()
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.CONTENT_ID_INVALID, undefined, 'id', 400)
  }

  const sourceSnapshotId = String(body.sourceSnapshotId || '').trim()
  if (sourceSnapshotId && !mongoose.Types.ObjectId.isValid(sourceSnapshotId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      undefined,
      'sourceSnapshotId',
      404
    )
  }

  const languageCode = body.languageCode
    ? normalizeLanguageCode(body.languageCode)
    : ''
  if (body.languageCode && !languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  return {
    collectionName,
    id,
    sourceSnapshotId,
    languageCode
  }
}

async function findTranslationRecord(collectionName, id) {
  const Model = getMultilingualModel(collectionName)
  return await Model.findOne({
    _id: new mongoose.Types.ObjectId(id),
    recordKind: TRANSLATION_RECORD_KIND
  })
}

async function findSourceRecordSnapshot(
  collectionName,
  record,
  sourceSnapshotId
) {
  if (collectionName === 'posts') {
    return await findSourcePostSnapshot(
      sourceSnapshotId || record.sourceSnapshotId
    )
  }

  const sourceId = toObjectId(record.sourceId)
  if (!sourceId) {
    return null
  }

  const Model = getMultilingualModel(collectionName)
  const query = Model.findOne({
    sourceCollection: collectionName,
    sourceId,
    sourceLanguageCode: record.sourceLanguageCode,
    recordKind: SOURCE_RECORD_KIND
  })
  const populate = getSnapshotPopulateForCollection(collectionName)
  if (populate) {
    query.populate(populate)
  }
  return await query
}

function removeImmutableRestoreFields(data) {
  const updateData = { ...data }
  delete updateData._id
  delete updateData.id
  delete updateData.createdAt
  delete updateData.updatedAt
  delete updateData.__v
  delete updateData.languageCode
  delete updateData.sourceLanguageCode
  delete updateData.sourceId
  delete updateData.sourceCollection
  delete updateData.sourceSnapshotId
  delete updateData.translationGroupId
  delete updateData.recordKind
  delete updateData.aiTranslationSkip
  return updateData
}

async function buildPostRestoreUpdateData(record, sourceRecord, context, now) {
  const data = await buildTranslationRecordData(
    'posts',
    sourceRecord,
    context,
    {
      recordId: record._id,
      copyPostRelations: false,
      skipPostRelations: true
    }
  )
  const updateData = removeImmutableRestoreFields(data)
  const relationIndexUpdateData = await buildPostRelationIndexUpdateData(
    sourceRecord,
    context
  )

  Object.assign(updateData, relationIndexUpdateData)
  delete updateData.alias
  updateData.lastChangDate = now
  updateData.status = 0
  updateData.sourceChanged = false
  updateData.pendingReview = false
  updateData.sourceChangedAt = null
  await assertAliasAvailable(
    record.languageCode,
    record.alias,
    updateData.type,
    record._id,
    updateData.status
  )

  return updateData
}

async function restoreTranslationRecordFromSnapshot(body = {}) {
  const input = parseRestoreRecordInput(body)
  let record = await findTranslationRecord(input.collectionName, input.id)
  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation record not found',
      'id',
      404
    )
  }

  if (input.languageCode && input.languageCode !== record.languageCode) {
    throw new ApiError(
      ERROR_CODES.RELATION_LANGUAGE_MISMATCH,
      undefined,
      'languageCode',
      409
    )
  }

  let sourceRecord = await findSourceRecordSnapshot(
    input.collectionName,
    record,
    input.sourceSnapshotId
  )
  if (!sourceRecord) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'source snapshot record not found',
      'sourceId',
      404
    )
  }

  if (input.collectionName === 'posts') {
    sourceRecord = await ensureSourcePostSnapshotRelations(sourceRecord)
    record = await repairTranslationPostIdentityForSource(record, sourceRecord)
    if (!isTranslationMatchedSourcePost(record, sourceRecord)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '当前语言版本与源快照身份不匹配，已停止同步以避免串源',
        'sourceSnapshotId',
        409,
        {
          translationPostId: String(record._id),
          translationGroupId: record.translationGroupId
            ? String(record.translationGroupId)
            : null,
          sourceSnapshotId: record.sourceSnapshotId
            ? String(record.sourceSnapshotId)
            : null,
          sourceId: record.sourceId ? String(record.sourceId) : null,
          expectedTranslationGroupId: sourceRecord.translationGroupId
            ? String(sourceRecord.translationGroupId)
            : null,
          expectedSourceSnapshotId: sourceRecord._id
            ? String(sourceRecord._id)
            : null,
          expectedSourceId: sourceRecord.sourceId
            ? String(sourceRecord.sourceId)
            : null,
          languageCode: record.languageCode
        }
      )
    }
  }

  const now = new Date()
  const context = {
    languageCode: record.languageCode,
    sourceLanguageCode: record.sourceLanguageCode,
    translationGroupId: record.translationGroupId,
    sourceSnapshotId: record.sourceSnapshotId,
    snapshotVersion:
      sourceRecord.snapshotVersion || record.snapshotVersion || 1,
    sourceSnapshotAt: sourceRecord.sourceSnapshotAt || now,
    now,
    copiedCounts: {},
    copyCache: new Map()
  }
  let updateData = null

  if (input.collectionName === 'posts') {
    updateData = await buildPostRestoreUpdateData(
      record,
      sourceRecord,
      context,
      now
    )
  } else {
    const data = await buildTranslationRecordData(
      input.collectionName,
      sourceRecord,
      context,
      {
        recordId: record._id,
        copyPostRelations: true
      }
    )
    updateData = removeImmutableRestoreFields(data)
  }

  const Model = getMultilingualModel(input.collectionName)
  await Model.updateOne(
    { _id: record._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: updateData }
  )

  if (input.collectionName === 'posts' || input.collectionName === 'sorts') {
    cacheDataUtils.invalidateSortListCache(record.languageCode)
  }

  if (input.collectionName === 'posts') {
    await contentRefreshUtils.refreshArticlePublishing(record.languageCode)
    return await getTranslationPostDetail(record._id)
  }

  return await Model.findOne({ _id: record._id }).lean()
}

function normalizeAiImportResultList(body = {}) {
  if (!Array.isArray(body.results) || body.results.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请选择要保存的语言',
      'results',
      400
    )
  }

  return body.results.map((item, index) => {
    const languageCode = normalizeLanguageCode(item?.languageCode)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        `第 ${index + 1} 个语言不支持`,
        `results[${index}].languageCode`,
        400
      )
    }
    if (!item.payload || typeof item.payload !== 'object') {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        'AI 翻译结果缺失',
        `results[${index}].payload`,
        400
      )
    }
    if (!Array.isArray(item.payload.entries)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        'AI 翻译条目缺失',
        `results[${index}].payload.entries`,
        400
      )
    }
    return {
      languageCode,
      payload: item.payload,
      publish: item.publish === true
    }
  })
}

function normalizeAiBatchInput(body = {}) {
  const sourceId = String(body.sourceId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(ERROR_CODES.SOURCE_ID_INVALID, undefined, 'sourceId', 400)
  }

  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }

  return {
    sourceId,
    sourceLanguageCode,
    results: normalizeAiImportResultList(body)
  }
}

function parseSourcePostAiImportPreviewInput(query = {}) {
  const sourceId = String(query.sourceId || query.id || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(ERROR_CODES.SOURCE_ID_INVALID, undefined, 'sourceId', 400)
  }

  const sourceLanguageCode = normalizeLanguageCode(query.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }

  const targetLanguageCode = normalizeLanguageCode(query.targetLanguageCode)
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }

  return {
    sourceId,
    sourceLanguageCode,
    targetLanguageCode
  }
}

function addPreviewRelationSourceId(sourceIdMap, collectionName, record) {
  const sourceId = getSourceIdentityId(record)
  if (!sourceId) {
    return
  }
  if (!sourceIdMap.has(collectionName)) {
    sourceIdMap.set(collectionName, new Set())
  }
  sourceIdMap.get(collectionName).add(String(sourceId))
}

function collectPreviewRelationSources(
  sourceIdMap,
  collectionName,
  value,
  seen = new Set()
) {
  if (!value) {
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => {
      collectPreviewRelationSources(sourceIdMap, collectionName, item, seen)
    })
    return
  }
  if (!isDocumentObject(value)) {
    return
  }

  const sourceId = getSourceIdentityId(value)
  const seenKey = [collectionName, sourceId ? String(sourceId) : value._id].join(
    ':'
  )
  if (seen.has(seenKey)) {
    return
  }
  seen.add(seenKey)
  addPreviewRelationSourceId(sourceIdMap, collectionName, value)

  const dependencyFields =
    PREVIEW_RELATION_DEPENDENCY_FIELDS[collectionName] || []
  dependencyFields.forEach(dependency => {
    collectPreviewRelationSources(
      sourceIdMap,
      dependency.collectionName,
      value[dependency.field],
      seen
    )
  })
}

function collectPostPreviewRelationSources(sourcePost) {
  const sourceIdMap = new Map()
  const seen = new Set()
  POST_RELATION_FIELD_CONFIGS.forEach(config => {
    collectPreviewRelationSources(
      sourceIdMap,
      config.collectionName,
      sourcePost[config.field],
      seen
    )
  })
  return sourceIdMap
}

async function buildTranslationPreviewRecordMap(sourceIdMap, languageCode) {
  const recordMap = new Map()

  await Promise.all(
    Array.from(sourceIdMap.entries()).map(
      async ([collectionName, sourceIdSet]) => {
        const sourceIds = Array.from(sourceIdSet)
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id))
        if (sourceIds.length === 0) {
          return
        }

        const Model = getMultilingualModel(collectionName)
        let query = Model.find({
          sourceId: { $in: sourceIds },
          languageCode,
          recordKind: TRANSLATION_RECORD_KIND
        })
        const populate = getSnapshotPopulateForCollection(collectionName)
        if (populate) {
          query = query.populate(populate)
        }
        const records = await query.lean()
        records.forEach(record => {
          if (!record.sourceId) {
            return
          }
          recordMap.set(
            [collectionName, String(record.sourceId)].join(':'),
            record
          )
        })
      }
    )
  )

  return recordMap
}

function normalizeAiImportPreviewRecord(record, context, seen = new Map()) {
  if (!record || typeof record !== 'object') {
    return record
  }
  if (Array.isArray(record)) {
    return record.map(item => {
      return normalizeAiImportPreviewRecord(item, context, seen)
    })
  }

  const sourceId = getSourceIdentityId(record)
  const seenKey = sourceId
    ? [context.collectionName, String(sourceId)].join(':')
    : ''
  if (seenKey && seen.has(seenKey)) {
    return seen.get(seenKey)
  }

  const translationRecord = sourceId
    ? context.translationRecordMap.get(
        [context.collectionName, String(sourceId)].join(':')
      )
    : null
  const normalizedRecord = cloneValue(translationRecord || record)

  if (seenKey) {
    seen.set(seenKey, normalizedRecord)
  }

  if (!translationRecord) {
    if (sourceId) {
      normalizedRecord.sourceId = sourceId
    }
    normalizedRecord.languageCode = context.targetLanguageCode
    normalizedRecord.sourceLanguageCode = context.sourceLanguageCode
    normalizedRecord.recordKind = TRANSLATION_RECORD_KIND
  }

  const dependencyFields =
    PREVIEW_RELATION_DEPENDENCY_FIELDS[context.collectionName] || []
  dependencyFields.forEach(dependency => {
    normalizedRecord[dependency.field] = normalizeAiImportPreviewRecord(
      normalizedRecord[dependency.field],
      {
        ...context,
        collectionName: dependency.collectionName
      },
      seen
    )
  })

  return normalizedRecord
}

function buildAiImportPreviewTargetPost(sourcePost, context) {
  const targetPost = cloneValue(sourcePost)
  const sourceId = getSourceIdentityId(sourcePost)
  targetPost._id = `preview-${context.targetLanguageCode}-${String(sourceId)}`
  targetPost.id = targetPost._id
  targetPost.sourceId = sourceId
  targetPost.languageCode = context.targetLanguageCode
  targetPost.sourceLanguageCode = context.sourceLanguageCode
  targetPost.recordKind = TRANSLATION_RECORD_KIND

  const seen = new Map()
  POST_RELATION_FIELD_CONFIGS.forEach(config => {
    targetPost[config.field] = normalizeAiImportPreviewRecord(
      targetPost[config.field],
      {
        ...context,
        collectionName: config.collectionName
      },
      seen
    )
  })

  return targetPost
}

async function getSourcePostAiImportPreviewContext(query = {}) {
  const input = parseSourcePostAiImportPreviewInput(query)
  const sourceDetail = await importPostSourceService.getSourceDatabasePostDetail(
    {
      id: input.sourceId,
      sourceLanguageCode: input.sourceLanguageCode
    }
  )
  const sourcePost = sourceDetail.post
  if (!sourcePost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_POST_NOT_FOUND,
      '源文章不存在',
      'sourceId',
      404
    )
  }

  const sourceIdMap = collectPostPreviewRelationSources(sourcePost)
  const translationRecordMap = await buildTranslationPreviewRecordMap(
    sourceIdMap,
    input.targetLanguageCode
  )
  const targetPost = buildAiImportPreviewTargetPost(sourcePost, {
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    translationRecordMap
  })

  return {
    sourcePost,
    targetPost,
    targetLanguageCode: input.targetLanguageCode,
    translatedRelationCount: translationRecordMap.size
  }
}

function escapeRichTextAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeRichTextText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderRichTextDocumentNode(node) {
  if (!node || typeof node !== 'object') {
    return ''
  }
  if (node.type === 'root') {
    return Array.isArray(node.children)
      ? node.children.map(renderRichTextDocumentNode).join('')
      : ''
  }
  if (node.type === 'text') {
    return escapeRichTextText(node.text || '')
  }
  if (node.type !== 'element' || !node.tag) {
    return ''
  }

  const attrs = {
    ...(node.attrs || {}),
    ...(node.translatableAttrs || {})
  }
  const attrText = Object.keys(attrs)
    .filter(key => attrs[key] !== null && typeof attrs[key] !== 'undefined')
    .map(key => ` ${key}="${escapeRichTextAttribute(attrs[key])}"`)
    .join('')
  const childrenText = Array.isArray(node.children)
    ? node.children.map(renderRichTextDocumentNode).join('')
    : ''
  return `<${node.tag}${attrText}>${childrenText}</${node.tag}>`
}

function normalizeAiEntryValue(entry) {
  if (entry.valueType === 'richTextDocument') {
    return renderRichTextDocumentNode(entry.value)
  }
  return entry.value
}

function buildSourceIdCandidates(sourceId) {
  const text = String(sourceId || '').trim()
  if (!text) {
    return []
  }
  const candidates = [text]
  if (mongoose.Types.ObjectId.isValid(text)) {
    candidates.push(new mongoose.Types.ObjectId(text))
  }
  return candidates
}

function getRelationRecordModel(collectionName) {
  if (!relationService.ALLOWED_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }
  const repository = global.$mongodDB.multilingual.repositories[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }
  return repository.model
}

async function findTranslationRecordBySourceEntry(entry, languageCode) {
  const sourceIdCandidates = buildSourceIdCandidates(entry.sourceId)
  if (sourceIdCandidates.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '翻译条目缺少源内容身份',
      'sourceId',
      400
    )
  }
  const Model = getRelationRecordModel(entry.collectionName)
  const record = await Model.findOne({
    sourceId: { $in: sourceIdCandidates },
    languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标语言关联内容不存在',
      'sourceId',
      404
    )
  }
  return record
}

function applyVoteOptionTitlePatch(optionList, optionPatch) {
  const optionId = String(optionPatch.optionId || '').trim()
  let optionIndex = -1
  if (optionId) {
    optionIndex = optionList.findIndex(option => {
      return String(option._id || '') === optionId
    })
  }
  if (
    optionIndex < 0 &&
    Number.isInteger(Number(optionPatch.optionIndex))
  ) {
    optionIndex = Number(optionPatch.optionIndex)
  }
  if (optionIndex < 0 || !optionList[optionIndex]) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标语言投票选项不存在',
      'options',
      404
    )
  }
  optionList[optionIndex].title = optionPatch.title
}

async function buildRelationUpdatePayload(entry, languageCode) {
  const record = await findTranslationRecordBySourceEntry(entry, languageCode)
  const value = normalizeAiEntryValue(entry)
  if (
    entry.collectionName === 'votes' &&
    entry.fieldName === 'options.title'
  ) {
    return {
      collectionName: entry.collectionName,
      id: record._id,
      languageCode,
      payload: {},
      optionList: Array.isArray(record.options)
        ? JSON.parse(JSON.stringify(record.options))
        : [],
      optionTitlePatch: {
        optionId: entry.optionId,
        optionIndex: entry.optionIndex,
        title: value
      }
    }
  }

  if (!entry.fieldName) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '翻译条目缺少字段名',
      'fieldName',
      400
    )
  }
  return {
    collectionName: entry.collectionName,
    id: record._id,
    languageCode,
    payload: {
      [entry.fieldName]: value
    }
  }
}

async function applyAiTranslationPayload({
  payload,
  translationPost,
  publish
}) {
  const relationUpdateMap = new Map()
  const postPatch = {}

  for (const entry of payload.entries) {
    if (!entry || typeof entry !== 'object' || entry.aiSkipReason) {
      continue
    }
    if (entry.scope === 'post') {
      postPatch[entry.fieldName] = normalizeAiEntryValue(entry)
      postPatch.aiTranslationSkip = true
      continue
    }
    const updateItem = await buildRelationUpdatePayload(
      entry,
      translationPost.languageCode
    )
    updateItem.payload.aiTranslationSkip = true
    const updateKey = [
      updateItem.collectionName,
      String(updateItem.id)
    ].join(':')
    if (!relationUpdateMap.has(updateKey)) {
      if (updateItem.optionTitlePatch) {
        updateItem.payload.options = updateItem.optionList
        applyVoteOptionTitlePatch(
          updateItem.payload.options,
          updateItem.optionTitlePatch
        )
        delete updateItem.optionList
        delete updateItem.optionTitlePatch
      }
      relationUpdateMap.set(updateKey, updateItem)
      continue
    }
    const existingUpdateItem = relationUpdateMap.get(updateKey)
    if (updateItem.optionTitlePatch) {
      if (!Array.isArray(existingUpdateItem.payload.options)) {
        existingUpdateItem.payload.options = updateItem.optionList
      }
      applyVoteOptionTitlePatch(
        existingUpdateItem.payload.options,
        updateItem.optionTitlePatch
      )
      continue
    }
    Object.assign(existingUpdateItem.payload, updateItem.payload)
  }

  for (const updateItem of relationUpdateMap.values()) {
    await relationService.updateRelation(updateItem, {
      skipContentRefresh: true
    })
  }

  if (Object.keys(postPatch).length > 0 || publish) {
    const postUpdateBody = {
      ...postPatch,
      id: translationPost._id,
      languageCode: translationPost.languageCode,
      confirmReview: true
    }
    if (publish) {
      postUpdateBody.status = 1
    }
    await updateTranslationPost(
      postUpdateBody,
      { skipContentRefresh: true }
    )
  }

  return {
    relationUpdateCount: relationUpdateMap.size,
    postUpdated: Object.keys(postPatch).length > 0 || publish
  }
}

async function createOrGetTranslationPostForAiImport(
  sourceSnapshotId,
  languageCode
) {
  try {
    const createResult = await createTranslationPost(
      {
        sourceSnapshotId,
        languageCode,
        copyMode: 'source'
      },
      { skipContentRefresh: true }
    )
    return {
      translationPostId: createResult.translationPostId,
      created: true
    }
  } catch (error) {
    if (
      error?.name !== 'ApiError' ||
      error.code !== ERROR_CODES.TRANSLATION_EXISTS ||
      !error.extra?.translationPostId
    ) {
      throw error
    }
    return {
      translationPostId: error.extra.translationPostId,
      created: false
    }
  }
}

async function applySourcePostAiImport(body = {}) {
  const input = normalizeAiBatchInput(body)
  const refreshLanguageSet = new Set([input.sourceLanguageCode])
  const importResult = await importPostSourceService.importOrOverwriteSourcePost(
    {
      sourceId: input.sourceId,
      sourceLanguageCode: input.sourceLanguageCode,
      overwrite: false
    },
    false,
    { skipContentRefresh: true }
  )

  const results = []
  for (const item of input.results) {
    if (item.payload?.meta?.languageCode !== item.languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        'AI 翻译结果语言不匹配',
        'languageCode',
        400
      )
    }

    const createResult = await createOrGetTranslationPostForAiImport(
      importResult.sourceSnapshotId,
      item.languageCode
    )
    const translationPostDetail = await getTranslationPostDetail(
      createResult.translationPostId
    )
    const applyResult = await applyAiTranslationPayload({
      payload: item.payload,
      translationPost: translationPostDetail.post,
      publish: item.publish
    })
    refreshLanguageSet.add(item.languageCode)
    results.push({
      languageCode: item.languageCode,
      translationPostId: createResult.translationPostId,
      created: createResult.created,
      ...applyResult
    })
  }

  for (const languageCode of refreshLanguageSet) {
    await contentRefreshUtils.refreshArticlePublishing(languageCode)
  }

  return {
    snapshot: {
      ...importResult,
      sourceLanguageCode: input.sourceLanguageCode
    },
    results,
    refreshedLanguages: Array.from(refreshLanguageSet)
  }
}

module.exports = {
  applySourcePostAiImport,
  createMissingPostRelationTranslation,
  createTranslationPost,
  getSourcePostAiImportPreviewContext,
  getTranslationPostListBySource,
  getTranslationPostDetail,
  restoreTranslationRecordFromSnapshot,
  updateTranslationPost
}
