const mongoose = require('mongoose')
const cacheDataUtils = require('../../../config/cacheData')
const contentRefreshUtils = require('../../../utils/contentRefresh')
const { normalizeTagName } = require('../../../utils/tagName')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const TRANSLATION_RECORD_KIND = 'translation'
const SOURCE_RECORD_KIND = 'source'

const ALLOWED_COLLECTION_NAMES = new Set([
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

const DEFAULT_LIST_COLLECTION_NAMES = Array.from(
  ALLOWED_COLLECTION_NAMES
).filter(collectionName => {
  return collectionName !== 'attachments'
})

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

const BUSINESS_FIELDS = {
  users: new Set(['nickname', 'photo', 'email', 'description', 'cover']),
  sorts: new Set([
    'sortname',
    'alias',
    'taxis',
    'parent',
    'description',
    'template'
  ]),
  tags: new Set(['tagname']),
  mappoints: new Set([
    'title',
    'summary',
    'longitude',
    'latitude',
    'zIndex',
    'status'
  ]),
  bangumis: new Set([
    'title',
    'cover',
    'coverFolder',
    'coverFileName',
    'summary',
    'rating',
    'year',
    'season',
    'giveUp',
    'urlList',
    'label',
    'postLinkOpen',
    'status'
  ]),
  movies: new Set([
    'title',
    'cover',
    'coverFolder',
    'coverFileName',
    'summary',
    'rating',
    'year',
    'month',
    'day',
    'urlList',
    'label',
    'postLinkOpen',
    'status'
  ]),
  games: new Set([
    'gamePlatform',
    'title',
    'cover',
    'coverFolder',
    'coverFileName',
    'summary',
    'rating',
    'label',
    'screenshotAlbum',
    'urlList',
    'startTime',
    'endTime',
    'giveUp',
    'postLinkOpen',
    'status'
  ]),
  gamePlatforms: new Set(['name', 'color']),
  books: new Set([
    'booktype',
    'title',
    'cover',
    'coverFolder',
    'coverFileName',
    'summary',
    'rating',
    'label',
    'urlList',
    'startTime',
    'endTime',
    'giveUp',
    'postLinkOpen',
    'status'
  ]),
  booktypes: new Set(['name', 'color']),
  events: new Set([
    'eventtype',
    'title',
    'color',
    'urlList',
    'content',
    'startTime',
    'endTime',
    'status'
  ]),
  eventtypes: new Set(['name', 'color']),
  posts: new Set([
    'title',
    'excerpt',
    'alias',
    'status',
    'allowRemark',
    'top',
    'sortop'
  ]),
  votes: new Set([
    'title',
    'options',
    'maxSelect',
    'showResultAfter',
    'endTime',
    'status'
  ]),
  attachments: new Set(['name', 'description', 'album', 'is360Panorama'])
}

function getMultilingualModel(collectionName) {
  const repository = global.$mongodDB.multilingual.repositories[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }

  return repository.model
}

function getAllowedCollectionNameList() {
  return Array.from(ALLOWED_COLLECTION_NAMES)
}

function parsePositiveInteger(value, defaultValue, maxValue) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return defaultValue
  }

  if (maxValue && numberValue > maxValue) {
    return maxValue
  }

  return numberValue
}

function parseOptionalObjectId(value, fieldName) {
  const id = String(value || '').trim()
  if (!id) {
    return null
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.SOURCE_ID_INVALID, undefined, fieldName, 400)
  }
  return new mongoose.Types.ObjectId(id)
}

function parseCollectionNameList(value) {
  if (!value) {
    return []
  }

  let rawList = value
  if (!Array.isArray(rawList)) {
    rawList = String(value).split(',')
  }

  const collectionNameList = []
  rawList.forEach(rawItem => {
    const collectionName = String(rawItem || '').trim()
    if (!collectionName) {
      return
    }

    if (!ALLOWED_COLLECTION_NAMES.has(collectionName)) {
      throw new ApiError(
        ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
        'collectionName is not supported',
        'excludeCollectionNames',
        400
      )
    }

    if (!collectionNameList.includes(collectionName)) {
      collectionNameList.push(collectionName)
    }
  })

  return collectionNameList
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseRelationListQuery(query = {}) {
  const recordKind =
    query.recordKind === SOURCE_RECORD_KIND
      ? SOURCE_RECORD_KIND
      : TRANSLATION_RECORD_KIND

  const collectionName = String(query.collectionName || '').trim()
  if (collectionName && !ALLOWED_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }

  const rawLanguageCode = String(query.languageCode || '').trim()
  const languageCode = rawLanguageCode
    ? normalizeLanguageCode(rawLanguageCode)
    : ''
  if (rawLanguageCode && !languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  return {
    collectionName,
    excludeCollectionNames: parseCollectionNameList(
      query.excludeCollectionNames
    ),
    languageCode,
    recordKind,
    sourceId: parseOptionalObjectId(query.sourceId, 'sourceId'),
    keyword: String(query.keyword || '').trim(),
    page: parsePositiveInteger(query.page, 1),
    limit: parsePositiveInteger(query.limit, 20, 100)
  }
}

function buildKeywordParams(keyword) {
  if (!keyword) {
    return null
  }

  const reg = new RegExp(escapeRegExp(keyword), 'i')
  const orList = [
    { title: reg },
    { excerpt: reg },
    { name: reg },
    { nickname: reg },
    { username: reg },
    { tagname: reg },
    { sortname: reg },
    { filename: reg },
    { description: reg },
    { summary: reg },
    { alias: reg }
  ]
  if (mongoose.Types.ObjectId.isValid(keyword)) {
    const objectId = new mongoose.Types.ObjectId(keyword)
    orList.push({ _id: objectId })
    orList.push({ sourceId: objectId })
    orList.push({ translationGroupId: objectId })
  }

  return { $or: orList }
}

function getRelationDisplayName(record) {
  if (Number(record.type) === 2 && record.excerpt) {
    return record.excerpt
  }

  return (
    record.title ||
    record.excerpt ||
    record.name ||
    record.nickname ||
    record.username ||
    record.tagname ||
    record.sortname ||
    record.filename ||
    record.alias ||
    String(record._id)
  )
}

function buildRelationListParams(input) {
  const params = {
    recordKind: input.recordKind
  }

  if (input.languageCode) {
    params.languageCode = input.languageCode
  }

  if (input.sourceId) {
    params.sourceId = input.sourceId
  }

  const keywordParams = buildKeywordParams(input.keyword)
  if (keywordParams) {
    params.$or = keywordParams.$or
  }

  return params
}

function toRelationListItem(item, collectionName) {
  return {
    ...item,
    collectionName,
    displayName: getRelationDisplayName(item)
  }
}

function getRelationListPopulate(collectionName) {
  if (collectionName === 'sorts') {
    return {
      path: 'parent'
    }
  }

  return undefined
}

async function listRelationsAcrossCollections(input) {
  const collectionNameList = input.collectionName
    ? [input.collectionName]
    : DEFAULT_LIST_COLLECTION_NAMES.filter(collectionName => {
        return !input.excludeCollectionNames.includes(collectionName)
      })
  const params = buildRelationListParams(input)
  const resultList = []

  await Promise.all(
    collectionNameList.map(async collectionName => {
      const Model = getMultilingualModel(collectionName)
      let query = Model.find(params).sort({ updatedAt: -1, _id: -1 })
      const populate = getRelationListPopulate(collectionName)
      if (populate) {
        query = query.populate(populate)
      }
      const list = await query.lean()

      list.forEach(item => {
        resultList.push(toRelationListItem(item, collectionName))
      })
    })
  )

  resultList.sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(
      right.updatedAt || right.createdAt || 0
    ).getTime()
    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }
    return String(right._id).localeCompare(String(left._id))
  })

  const startIndex = (input.page - 1) * input.limit
  const endIndex = startIndex + input.limit

  return {
    list: resultList.slice(startIndex, endIndex),
    total: resultList.length,
    page: input.page,
    limit: input.limit
  }
}

async function listRelations(queryParams = {}) {
  const input = parseRelationListQuery(queryParams)

  if (!input.collectionName) {
    return listRelationsAcrossCollections(input)
  }

  const Model = getMultilingualModel(input.collectionName)
  const params = buildRelationListParams(input)

  const total = await Model.countDocuments(params)
  let query = Model.find(params)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit)
  const populate = getRelationListPopulate(input.collectionName)
  if (populate) {
    query = query.populate(populate)
  }
  const list = await query.lean()

  return {
    list: list.map(item => {
      return toRelationListItem(item, input.collectionName)
    }),
    total,
    page: input.page,
    limit: input.limit
  }
}

function parseRelationInput(body = {}) {
  const collectionName = String(body.collectionName || '').trim()
  if (!ALLOWED_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }

  const id = String(body.id || '').trim()
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(ERROR_CODES.SOURCE_ID_INVALID, undefined, 'id', 400)
  }

  const languageCode = normalizeLanguageCode(body.languageCode)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  let payload = body.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    payload = {}
  }

  return {
    collectionName,
    id,
    languageCode,
    payload
  }
}

function isSafePayloadField(field) {
  if (!field) {
    return false
  }

  if (field.startsWith('$')) {
    return false
  }

  if (field.includes('.')) {
    return false
  }

  return true
}

function buildRelationUpdateData(collectionName, payload, schema) {
  const updateData = {}
  const businessFields = BUSINESS_FIELDS[collectionName] || new Set()

  for (const field of Object.keys(payload)) {
    if (!isSafePayloadField(field)) {
      continue
    }

    if (SYSTEM_FIELDS.has(field)) {
      continue
    }

    if (!businessFields.has(field)) {
      continue
    }

    if (!schema.path(field)) {
      continue
    }

    updateData[field] = payload[field]
  }

  if (collectionName === 'tags' && updateData.tagname !== undefined) {
    updateData.tagname = normalizeTagName(updateData.tagname)
    if (!updateData.tagname) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        'tagname is required',
        'tagname',
        400
      )
    }
  }

  return updateData
}

function normalizeVoteOptionsForUpdate(inputOptions, existingOptions = []) {
  if (!Array.isArray(inputOptions)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'options must be an array',
      'options',
      400
    )
  }

  const submittedOptionMap = new Map()
  inputOptions.forEach((option, index) => {
    const optionId = String(option?._id || '').trim()
    if (!optionId) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        `options[${index}]._id is required`,
        'options',
        400
      )
    }
    submittedOptionMap.set(optionId, option)
  })

  if (submittedOptionMap.size !== existingOptions.length) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'options can only update existing option titles',
      'options',
      400
    )
  }

  return existingOptions.map((existingOption, index) => {
    const optionObject =
      typeof existingOption.toObject === 'function'
        ? existingOption.toObject()
        : existingOption
    const optionId = String(optionObject._id || '').trim()
    const submittedOption = submittedOptionMap.get(optionId)
    if (!submittedOption) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        `options[${index}] is missing`,
        'options',
        400
      )
    }

    const title = String(submittedOption.title || '').trim()
    if (!title) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        `options[${index}].title is required`,
        'options',
        400
      )
    }

    return {
      ...optionObject,
      title
    }
  })
}

async function updateRelation(body = {}) {
  const input = parseRelationInput(body)
  const Model = getMultilingualModel(input.collectionName)
  const record = await Model.findOne({
    _id: new mongoose.Types.ObjectId(input.id),
    recordKind: TRANSLATION_RECORD_KIND
  })

  if (!record) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'relation record not found',
      'id',
      404
    )
  }

  if (record.languageCode !== input.languageCode) {
    throw new ApiError(
      ERROR_CODES.RELATION_LANGUAGE_MISMATCH,
      undefined,
      'languageCode',
      409
    )
  }

  const updateData = buildRelationUpdateData(
    input.collectionName,
    input.payload,
    Model.schema
  )
  if (
    input.collectionName === 'votes' &&
    Object.prototype.hasOwnProperty.call(updateData, 'options')
  ) {
    updateData.options = normalizeVoteOptionsForUpdate(
      updateData.options,
      record.options || []
    )
  }
  if (Object.keys(updateData).length === 0) {
    return record.toObject()
  }

  await Model.updateOne(
    { _id: record._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: updateData }
  )

  if (input.collectionName === 'sorts') {
    cacheDataUtils.invalidateSortListCache(record.languageCode)
  }
  if (input.collectionName === 'posts') {
    await contentRefreshUtils.refreshArticlePublishing(record.languageCode)
  }

  return await Model.findOne({ _id: record._id }).lean()
}

module.exports = {
  ALLOWED_COLLECTION_NAMES,
  SYSTEM_FIELDS,
  listRelations,
  updateRelation
}
