const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const utils = require('../../../utils/utils')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const TRANSLATION_RECORD_KIND = 'translation'
const SOURCE_RECORD_KIND = 'source'
const DELETE_LOCAL_FILE_CONFIRM_TEXT = 'DELETE_LOCAL_FILE'
const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..')
const PUBLIC_ROOT = path.join(SERVER_ROOT, 'public')
const CONTENT_ROOT = path.join(PUBLIC_ROOT, 'content')
const UPLOAD_ROOT = path.join(CONTENT_ROOT, 'uploadfile')
const MULTILINGUAL_PUBLIC_ASSET_PREFIX = '/multilingual-assets'

const SOURCE_IMAGE_SETTING_DEFAULTS = {
  imgSettingEnableImgCompress: false,
  imgSettingEnableImgCompressWebp: false,
  imgSettingCompressQuality: 80,
  imgSettingCompressMaxSize: 1920,
  imgSettingEnableImgThumbnail: false,
  imgSettingThumbnailQuality: 40,
  imgSettingThumbnailMaxSize: 680
}

function getAttachmentModel() {
  const repository = global.$mongodDB.multilingual.repositories.attachments
  if (!repository || !repository.model) {
    throw new Error('multilingual attachment repository not found')
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

function parseAttachmentListQuery(query = {}) {
  const languageCode = normalizeLanguageCode(query.languageCode)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }

  let recordKind = TRANSLATION_RECORD_KIND
  if (query.recordKind === SOURCE_RECORD_KIND) {
    recordKind = SOURCE_RECORD_KIND
  }

  let mediaMode = String(query.mediaMode || '').trim()
  if (mediaMode && mediaMode !== 'remote' && mediaMode !== 'local') {
    mediaMode = ''
  }

  return {
    languageCode,
    recordKind,
    mediaMode,
    keyword: String(query.keyword || '').trim(),
    page: parsePositiveInteger(query.page, 1),
    limit: parsePositiveInteger(query.limit, 20, 100)
  }
}

function buildAttachmentKeywordParams(keyword) {
  if (!keyword) {
    return null
  }

  const reg = new RegExp(escapeRegExp(keyword), 'i')
  const orList = [
    { name: reg },
    { filename: reg },
    { filepath: reg },
    { remoteFilepath: reg },
    { localFilepath: reg },
    { description: reg },
    { mimetype: reg }
  ]
  if (mongoose.Types.ObjectId.isValid(keyword)) {
    const objectId = new mongoose.Types.ObjectId(keyword)
    orList.push({ _id: objectId })
    orList.push({ sourceId: objectId })
    orList.push({ remoteSourceId: objectId })
    orList.push({ translationGroupId: objectId })
  }

  return { $or: orList }
}

async function listAttachments(query = {}) {
  const input = parseAttachmentListQuery(query)
  const AttachmentModel = getAttachmentModel()
  const params = {
    recordKind: input.recordKind,
    languageCode: input.languageCode
  }
  if (input.mediaMode) {
    params.mediaMode = input.mediaMode
  }
  const keywordParams = buildAttachmentKeywordParams(input.keyword)
  if (keywordParams) {
    params.$or = keywordParams.$or
  }

  const total = await AttachmentModel.countDocuments(params)
  const list = await AttachmentModel.find(params)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit)
    .lean()

  return {
    list,
    total,
    page: input.page,
    limit: input.limit
  }
}

function parseAttachmentInput(body = {}) {
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

  return {
    id,
    languageCode
  }
}

async function findAttachment(input) {
  const AttachmentModel = getAttachmentModel()
  const attachment = await AttachmentModel.findOne({
    _id: new mongoose.Types.ObjectId(input.id),
    recordKind: TRANSLATION_RECORD_KIND
  })

  if (!attachment) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'attachment not found',
      'id',
      404
    )
  }

  if (attachment.languageCode !== input.languageCode) {
    throw new ApiError(
      ERROR_CODES.RELATION_LANGUAGE_MISMATCH,
      undefined,
      'languageCode',
      409
    )
  }

  return attachment
}

function parseSourceOptionValue(defaultValue, value) {
  if (typeof defaultValue === 'number') {
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) {
      return numberValue
    }
    return defaultValue
  }

  if (typeof defaultValue === 'boolean') {
    return value === true || value === 'true'
  }

  return value
}

async function getSourceImageSettings() {
  const config = { ...SOURCE_IMAGE_SETTING_DEFAULTS }
  const repository = global.$mongodDB.source.repositories.options
  if (!repository) {
    return config
  }

  const optionList = await repository.find({}, 'name value', { lean: true })
  for (const item of optionList) {
    if (!Object.prototype.hasOwnProperty.call(config, item.name)) {
      continue
    }

    config[item.name] = parseSourceOptionValue(config[item.name], item.value)
  }

  return config
}

function decodeOriginalName(file) {
  if (!file || !file.originalname) {
    return 'local-file'
  }

  return Buffer.from(file.originalname, 'latin1').toString('utf8')
}

function getFileExtname(originalName, mimetype) {
  const extname = path.extname(originalName).toLowerCase()
  if (extname) {
    return extname
  }

  const mimetypeExtnameMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4'
  }

  if (mimetypeExtnameMap[mimetype]) {
    return mimetypeExtnameMap[mimetype]
  }

  return '.bin'
}

function buildYearMonth() {
  const date = new Date()
  const year = date.getFullYear()
  let month = date.getMonth() + 1
  if (month < 10) {
    month = '0' + month
  }

  return String(year) + String(month)
}

async function ensureUploadDir(yearMonth) {
  const yearMonthPath = path.join(UPLOAD_ROOT, yearMonth)
  await fs.promises.mkdir(yearMonthPath, { recursive: true })
  return yearMonthPath
}

function createFileSuffix() {
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
}

function toPublicPath(filePath) {
  const relativePath = path.relative(PUBLIC_ROOT, filePath).replace(/\\/g, '/')
  return `${MULTILINGUAL_PUBLIC_ASSET_PREFIX}/${relativePath}`
}

function isImageFile(file) {
  return Boolean(file && file.mimetype && file.mimetype.startsWith('image'))
}

function normalizeImageDimensions(imageInfo) {
  let width = imageInfo.width || 0
  let height = imageInfo.height || 0
  if (imageInfo.orientation && [5, 6, 7, 8].includes(imageInfo.orientation)) {
    const rotatedWidth = height
    height = width
    width = rotatedWidth
  }

  return { width, height }
}

function calculateResizeDimensions(width, height, maxSize) {
  const max = Math.max(width, height)
  if (!maxSize || max <= maxSize) {
    return {
      width: null,
      height: null
    }
  }

  const scale = maxSize / max
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

async function cleanupCreatedFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }

    try {
      await fs.promises.unlink(filePath)
    } catch (error) {
      continue
    }
  }
}

async function buildImageStorageData(
  file,
  attachmentId,
  yearMonthPath,
  suffix
) {
  const originalName = decodeOriginalName(file)
  const originalExtname = getFileExtname(originalName, file.mimetype)
  const config = await getSourceImageSettings()
  const imageInfo = await utils.imageMetadata(file.buffer)
  const dimensions = normalizeImageDimensions(imageInfo)
  const animated = imageInfo.pages > 1
  const updateData = {
    filename: originalName,
    filesize: file.size,
    filepath: '',
    width: dimensions.width,
    height: dimensions.height,
    mimetype: file.mimetype,
    thumfor: '',
    thumWidth: 0,
    thumHeight: 0,
    status: 1
  }
  const createdFiles = []

  try {
    if (config.imgSettingEnableImgThumbnail) {
      const thumbnailDimensions = calculateResizeDimensions(
        dimensions.width,
        dimensions.height,
        config.imgSettingThumbnailMaxSize
      )
      if (
        thumbnailDimensions.width &&
        thumbnailDimensions.height &&
        config.imgSettingThumbnailMaxSize < config.imgSettingCompressMaxSize
      ) {
        const thumbnailPath = path.join(
          yearMonthPath,
          `thum-${attachmentId}-${suffix}.webp`
        )
        await utils.imageCompress(
          '.webp',
          file.buffer,
          animated,
          thumbnailDimensions.width,
          thumbnailDimensions.height,
          config.imgSettingThumbnailQuality,
          thumbnailPath
        )
        createdFiles.push(thumbnailPath)
        updateData.thumfor = toPublicPath(thumbnailPath)
        updateData.thumWidth = thumbnailDimensions.width
        updateData.thumHeight = thumbnailDimensions.height
      }
    }

    let outputExtname = originalExtname
    if (
      config.imgSettingEnableImgCompress &&
      config.imgSettingEnableImgCompressWebp
    ) {
      outputExtname = '.webp'
      updateData.mimetype = 'image/webp'
    }

    const localFilePath = path.join(
      yearMonthPath,
      `${attachmentId}-${suffix}${outputExtname}`
    )
    if (config.imgSettingEnableImgCompress) {
      const resizedDimensions = calculateResizeDimensions(
        dimensions.width,
        dimensions.height,
        config.imgSettingCompressMaxSize
      )
      if (resizedDimensions.width && resizedDimensions.height) {
        updateData.width = resizedDimensions.width
        updateData.height = resizedDimensions.height
      }

      await utils.imageCompress(
        outputExtname,
        file.buffer,
        animated,
        resizedDimensions.width,
        resizedDimensions.height,
        config.imgSettingCompressQuality,
        localFilePath
      )
    } else {
      await fs.promises.writeFile(localFilePath, file.buffer)
    }

    createdFiles.push(localFilePath)
    const stats = await fs.promises.stat(localFilePath)
    updateData.filesize = stats.size
    updateData.filepath = toPublicPath(localFilePath)

    return {
      updateData,
      createdFiles
    }
  } catch (error) {
    await cleanupCreatedFiles(createdFiles)
    throw error
  }
}

async function buildFileStorageData(file, attachmentId, yearMonthPath, suffix) {
  const originalName = decodeOriginalName(file)
  const extname = getFileExtname(originalName, file.mimetype)
  const localFilePath = path.join(
    yearMonthPath,
    `${attachmentId}-${suffix}${extname}`
  )
  const createdFiles = []

  try {
    await fs.promises.writeFile(localFilePath, file.buffer)
    createdFiles.push(localFilePath)
    const stats = await fs.promises.stat(localFilePath)

    return {
      updateData: {
        filename: originalName,
        filesize: stats.size,
        filepath: toPublicPath(localFilePath),
        width: 0,
        height: 0,
        mimetype: file.mimetype || '',
        thumfor: '',
        thumWidth: 0,
        thumHeight: 0,
        status: 1
      },
      createdFiles
    }
  } catch (error) {
    await cleanupCreatedFiles(createdFiles)
    throw error
  }
}

async function saveLocalFile(file, attachmentId) {
  const yearMonth = buildYearMonth()
  const yearMonthPath = await ensureUploadDir(yearMonth)
  const suffix = createFileSuffix()

  if (isImageFile(file)) {
    return await buildImageStorageData(
      file,
      attachmentId,
      yearMonthPath,
      suffix
    )
  }

  return await buildFileStorageData(file, attachmentId, yearMonthPath, suffix)
}

function getContentRelativePath(storedPath) {
  let relativePath = storedPath
  while (relativePath.startsWith('./')) {
    relativePath = relativePath.slice(2)
  }
  relativePath = relativePath.replace(/^\/+/, '')

  if (relativePath === 'content') {
    return ''
  }

  if (relativePath.startsWith('content/')) {
    return relativePath.slice('content/'.length)
  }

  if (relativePath === 'multilingual-assets/content') {
    return ''
  }

  if (relativePath.startsWith('multilingual-assets/content/')) {
    return relativePath.slice('multilingual-assets/content/'.length)
  }

  if (relativePath === 'public/content') {
    return ''
  }

  if (relativePath.startsWith('public/content/')) {
    return relativePath.slice('public/content/'.length)
  }

  return null
}

function normalizeStoredContentPath(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') {
    return null
  }

  const normalizedText = storedPath.trim().replace(/\\/g, '/')
  if (!normalizedText) {
    return null
  }

  const contentRelativePath = getContentRelativePath(normalizedText)
  let filePath = ''
  if (contentRelativePath !== null) {
    filePath = path.resolve(CONTENT_ROOT, contentRelativePath)
  } else if (path.isAbsolute(normalizedText)) {
    filePath = path.resolve(normalizedText)
  } else {
    filePath = path.resolve(CONTENT_ROOT, normalizedText)
  }

  const relativeFromRoot = path.relative(CONTENT_ROOT, filePath)
  if (
    !relativeFromRoot ||
    relativeFromRoot.startsWith('..') ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error('local file path is outside content root')
  }

  return filePath
}

async function safeDeleteContentFile(storedPath) {
  const filePath = normalizeStoredContentPath(storedPath)
  if (!filePath) {
    return
  }

  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return
    }
    throw error
  }
}

async function safeDeleteContentFiles(storedPathList) {
  const uniquePathSet = new Set()
  for (const storedPath of storedPathList) {
    if (storedPath) {
      uniquePathSet.add(storedPath)
    }
  }

  try {
    for (const storedPath of uniquePathSet) {
      await safeDeleteContentFile(storedPath)
    }
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.LOCAL_FILE_DELETE_FAILED,
      undefined,
      'localFilepath',
      400
    )
  }
}

async function replaceLocalAttachment(body = {}, file) {
  if (!file || !file.buffer) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      'file is required',
      'file',
      400
    )
  }

  const input = parseAttachmentInput(body)
  const attachment = await findAttachment(input)
  const AttachmentModel = getAttachmentModel()
  const storageData = await saveLocalFile(file, String(attachment._id))
  const updateData = {
    ...storageData.updateData,
    mediaMode: 'local',
    localFilepath: storageData.updateData.filepath,
    localThumbnailPath: storageData.updateData.thumfor || '',
    localStorageStatus: 'stored'
  }

  try {
    const updatedAttachment = await AttachmentModel.findOneAndUpdate(
      { _id: attachment._id, recordKind: TRANSLATION_RECORD_KIND },
      { $set: updateData },
      { new: true }
    ).lean()

    if (!updatedAttachment) {
      throw new Error('attachment update failed')
    }

    return updatedAttachment
  } catch (error) {
    await cleanupCreatedFiles(storageData.createdFiles)
    throw error
  }
}

function getSnapshotValue(snapshot, field, fallbackValue) {
  if (snapshot && snapshot[field] !== undefined && snapshot[field] !== null) {
    return snapshot[field]
  }

  return fallbackValue
}

function buildRemoteUpdateData(attachment) {
  const remoteSnapshot = attachment.remoteSnapshot || {}
  let remoteFilepath = ''
  if (remoteSnapshot.filepath) {
    remoteFilepath = remoteSnapshot.filepath
  } else if (attachment.remoteFilepath) {
    remoteFilepath = attachment.remoteFilepath
  }

  return {
    mediaMode: 'remote',
    filepath: remoteFilepath,
    thumfor: remoteSnapshot.thumfor || '',
    filename: getSnapshotValue(remoteSnapshot, 'filename', attachment.filename),
    filesize: getSnapshotValue(
      remoteSnapshot,
      'filesize',
      attachment.filesize || 0
    ),
    width: getSnapshotValue(remoteSnapshot, 'width', attachment.width || 0),
    height: getSnapshotValue(remoteSnapshot, 'height', attachment.height || 0),
    mimetype: getSnapshotValue(
      remoteSnapshot,
      'mimetype',
      attachment.mimetype || ''
    ),
    thumWidth: getSnapshotValue(
      remoteSnapshot,
      'thumWidth',
      attachment.thumWidth || 0
    ),
    thumHeight: getSnapshotValue(
      remoteSnapshot,
      'thumHeight',
      attachment.thumHeight || 0
    ),
    localFilepath: '',
    localThumbnailPath: '',
    localStorageStatus: 'none'
  }
}

async function convertLocalAttachmentToRemote(body = {}) {
  const input = parseAttachmentInput(body)
  if (body.confirmText !== DELETE_LOCAL_FILE_CONFIRM_TEXT) {
    throw new ApiError(
      ERROR_CODES.CONFIRM_TEXT_REQUIRED,
      undefined,
      'confirmText',
      400
    )
  }

  const attachment = await findAttachment(input)
  if (attachment.mediaMode !== 'local') {
    throw new ApiError(
      ERROR_CODES.MEDIA_MODE_INVALID,
      undefined,
      'mediaMode',
      400
    )
  }

  const localPathList = [
    attachment.localFilepath || attachment.filepath,
    attachment.localThumbnailPath || attachment.thumfor
  ]
  await safeDeleteContentFiles(localPathList)

  const AttachmentModel = getAttachmentModel()
  const updatedAttachment = await AttachmentModel.findOneAndUpdate(
    { _id: attachment._id, recordKind: TRANSLATION_RECORD_KIND },
    { $set: buildRemoteUpdateData(attachment) },
    { new: true }
  ).lean()

  if (!updatedAttachment) {
    throw new Error('attachment update failed')
  }

  return updatedAttachment
}

module.exports = {
  DELETE_LOCAL_FILE_CONFIRM_TEXT,
  listAttachments,
  replaceLocalAttachment,
  convertLocalAttachmentToRemote,
  normalizeStoredContentPath,
  safeDeleteContentFiles
}
