const fs = require('fs-extra')
const path = require('path')
const crypto = require('crypto')
const db = require('../mongodb')
const env = require('../config/env')
const HttpError = require('../utils/httpError')
const { hashObject, sha256 } = require('../utils/hash')
const { getEntityConfig } = require('./entityRegistry')
const { TRANSLATION_STATUS, ATTACHMENT_SOURCE_TYPE } = require('../../common/constants')

const ENTITY_POST_RELATION_FIELDS = {
  attachment: ['coverImages'],
  author: ['author'],
  bangumi: ['bangumiList', 'contentBangumiList'],
  book: ['bookList', 'contentBookList'],
  event: ['eventList', 'contentEventList'],
  game: ['gameList', 'contentGameList'],
  mappoint: ['mappointList'],
  movie: ['movieList', 'contentMovieList'],
  sort: ['sort'],
  tag: ['tags'],
  vote: ['voteList', 'contentVoteList']
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function markRelatedPostsValidationDirty(entityType, entityId) {
  const fields = ENTITY_POST_RELATION_FIELDS[entityType] || []
  if (fields.length === 0) {
    return
  }

  const filter = {
    $or: fields.map(field => ({ [field]: entityId }))
  }

  await db.utils.posts.updateMany(filter, {
    $set: {
      'validationState.needsRefresh': true,
      'validationState.updatedAt': new Date()
    }
  })
}

function buildEntityFilter(entityType, query) {
  const config = getEntityConfig(entityType)
  const filter = {}

  if (query.languageCode) {
    filter.languageCode = query.languageCode
  }
  if (query.translationStatus) {
    filter.translationStatus = query.translationStatus
  }
  if (typeof query.status === 'number' && config.modelName !== 'attachments') {
    filter.status = query.status
  }
  if (query.keyword) {
    const keywordRegex = new RegExp(escapeRegex(query.keyword.trim()), 'i')
    filter.$or = config.keywordFields.map(field => ({ [field]: keywordRegex }))
  }
  if (entityType === 'attachment' && query.attachmentSourceType) {
    filter.attachmentSourceType = query.attachmentSourceType
  }

  return filter
}

async function listEntities(entityType, query) {
  const config = getEntityConfig(entityType)
  return db.utils[config.modelName].findPage(
    buildEntityFilter(entityType, query),
    { updatedAt: -1 },
    query.page,
    query.limit,
    undefined,
    { scope: 'detail' }
  )
}

async function getEntityDetail(entityType, id) {
  const config = getEntityConfig(entityType)
  const doc = await db.utils[config.modelName].findOne(
    { _id: id },
    undefined,
    { scope: 'detail' }
  )
  if (!doc) {
    throw new HttpError(404, '数据不存在')
  }
  return doc
}

async function updateEntity(entityType, payload) {
  const config = getEntityConfig(entityType)
  const current = await getEntityDetail(entityType, payload.id)
  const updateData = { ...payload }
  delete updateData.id

  if (!updateData.translationStatus) {
    updateData.translationStatus = TRANSLATION_STATUS.MANUAL_DRAFT
  }
  updateData.isManualEdited = true

  if (updateData.sourceSnapshot && !updateData.sourceHash) {
    updateData.sourceHash = hashObject(updateData.sourceSnapshot)
  }
  const updated = await db.utils[config.modelName].upsertOne(
    { _id: current._id },
    updateData,
    { new: true }
  )

  await markRelatedPostsValidationDirty(entityType, current._id)
  return updated
}

function buildLocalizedAttachmentPaths(languageCode, originalFilename) {
  const extension = path.extname(originalFilename || '').toLowerCase()
  const randomName = `${crypto.randomUUID()}${extension}`
  const relativeStoragePath = path.join(languageCode, randomName)
  return {
    publicPath: `${env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH.replace(/\/$/, '')}/${languageCode}/${randomName}`,
    relativeStoragePath,
    storagePath: path.join(env.LOCAL_ATTACHMENT_STORAGE_ABS_DIR, relativeStoragePath)
  }
}

async function uploadLocalizedAttachment(payload, file) {
  if (!file) {
    throw new HttpError(400, '缺少上传文件')
  }

  const filePaths = buildLocalizedAttachmentPaths(payload.languageCode, file.originalname)
  await fs.ensureDir(path.dirname(filePaths.storagePath))
  await fs.writeFile(filePaths.storagePath, file.buffer)

  const fileHash = sha256(file.buffer)
  const updateData = {
    attachmentGroupKey: payload.attachmentGroupKey,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED,
    languageCode: payload.languageCode,
    filename: file.originalname,
    filepath: filePaths.publicPath.replace(/\\/g, '/'),
    storagePath: filePaths.relativeStoragePath.replace(/\\/g, '/'),
    name: payload.name,
    description: payload.description,
    filesize: file.size,
    mimetype: file.mimetype,
    fileHash,
    sourceSnapshot: {
      filename: file.originalname,
      filesize: file.size,
      mimetype: file.mimetype,
      filepath: filePaths.publicPath.replace(/\\/g, '/')
    },
    sourceHash: fileHash,
    translationStatus: TRANSLATION_STATUS.MANUAL_DRAFT,
    isManualEdited: true,
    importOrigin: 'localizedUpload'
  }

  const doc = await db.utils.attachments.upsertOne(
    {
      attachmentGroupKey: payload.attachmentGroupKey,
      attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED,
      languageCode: payload.languageCode
    },
    updateData
  )

  await markRelatedPostsValidationDirty('attachment', doc._id)
  return doc
}

module.exports = {
  getEntityDetail,
  listEntities,
  markRelatedPostsValidationDirty,
  updateEntity,
  uploadLocalizedAttachment
}