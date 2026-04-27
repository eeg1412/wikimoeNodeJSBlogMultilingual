const mongoose = require('mongoose')
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseRelationListQuery(query = {}) {
  const collectionName = String(query.collectionName || '').trim()
  if (!ALLOWED_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }

  const languageCode = normalizeLanguageCode(query.languageCode)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  const recordKind =
    query.recordKind === SOURCE_RECORD_KIND
      ? SOURCE_RECORD_KIND
      : TRANSLATION_RECORD_KIND

  return {
    collectionName,
    languageCode,
    recordKind,
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
  return (
    record.title ||
    record.excerpt ||
    record.name ||
    record.tagname ||
    record.sortname ||
    record.filename ||
    record.alias ||
    String(record._id)
  )
}

async function listRelations(query = {}) {
  const input = parseRelationListQuery(query)
  const Model = getMultilingualModel(input.collectionName)
  const params = {
    recordKind: input.recordKind,
    languageCode: input.languageCode
  }
  const keywordParams = buildKeywordParams(input.keyword)
  if (keywordParams) {
    params.$or = keywordParams.$or
  }

  const total = await Model.countDocuments(params)
  const list = await Model.find(params)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit)
    .lean()

  return {
    list: list.map(item => {
      return {
        ...item,
        displayName: getRelationDisplayName(item)
      }
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

  return updateData
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
  if (Object.keys(updateData).length === 0) {
    return record.toObject()
  }

  await Model.updateOne(
    { _id: record._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: updateData }
  )

  return await Model.findOne({ _id: record._id }).lean()
}

module.exports = {
  ALLOWED_COLLECTION_NAMES,
  SYSTEM_FIELDS,
  listRelations,
  updateRelation
}
