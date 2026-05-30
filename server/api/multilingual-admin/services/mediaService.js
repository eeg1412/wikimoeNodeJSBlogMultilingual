const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const utils = require('../../../utils/utils')
const {
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('../../../utils/language')
const { getSourceSeoSettings } = require('../../../utils/sourceSeoSettings')
const mediaSettingsService = require('./mediaSettingsService')
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

function parseMediaTypeList(value) {
  if (!value) {
    return []
  }

  let rawList = value
  if (!Array.isArray(rawList)) {
    rawList = String(value).split(',')
  }

  const typeList = []
  rawList.forEach(item => {
    const type = String(item || '').trim()
    if (type !== 'image' && type !== 'video') {
      return
    }
    if (!typeList.includes(type)) {
      typeList.push(type)
    }
  })

  return typeList
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (value === true || value === 'true' || value === '1') {
    return true
  }

  if (value === false || value === 'false' || value === '0') {
    return false
  }

  return null
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseAttachmentListQuery(query = {}) {
  let recordKind = TRANSLATION_RECORD_KIND
  if (query.recordKind === SOURCE_RECORD_KIND) {
    recordKind = SOURCE_RECORD_KIND
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

  let mediaMode = String(query.mediaMode || '').trim()
  if (mediaMode && mediaMode !== 'remote' && mediaMode !== 'local') {
    mediaMode = ''
  }

  return {
    languageCode,
    recordKind,
    mediaMode,
    typeList: parseMediaTypeList(query.typeList || query['typeList[]']),
    is360Panorama: parseOptionalBoolean(query.is360Panorama),
    sourceId: parseOptionalObjectId(query.sourceId, 'sourceId'),
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

function buildAttachmentTypeParams(typeList) {
  if (!typeList || typeList.length === 0 || typeList.length >= 2) {
    return null
  }

  return {
    mimetype: new RegExp(`^${typeList[0]}/`, 'i')
  }
}

function buildAttachmentListParams(input) {
  const params = {
    recordKind: input.recordKind
  }
  if (input.languageCode) {
    params.languageCode = input.languageCode
  }
  if (input.mediaMode) {
    params.mediaMode = input.mediaMode
  }
  if (input.sourceId) {
    params.sourceId = input.sourceId
  }
  if (input.is360Panorama !== null) {
    params.is360Panorama = input.is360Panorama
  }

  const keywordParams = buildAttachmentKeywordParams(input.keyword)
  const typeParams = buildAttachmentTypeParams(input.typeList)
  if (keywordParams) {
    if (typeParams) {
      params.$and = [keywordParams, typeParams]
    } else {
      params.$or = keywordParams.$or
    }
  } else if (typeParams) {
    Object.assign(params, typeParams)
  }

  return params
}

function buildEmptyAttachmentTranslationMatrix() {
  return SUPPORTED_LANGUAGE_CODES.reduce((matrix, languageCode) => {
    matrix[languageCode] = null
    return matrix
  }, {})
}

function parseAttachmentListBySourceQuery(query = {}) {
  const input = parseAttachmentListQuery({
    ...query,
    languageCode: query.sourceLanguageCode || '',
    recordKind: SOURCE_RECORD_KIND
  })
  const rawTargetLanguageCode = String(query.languageCode || '').trim()
  const targetLanguageCode = rawTargetLanguageCode
    ? normalizeLanguageCode(rawTargetLanguageCode)
    : ''
  if (rawTargetLanguageCode && !targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'languageCode',
      400
    )
  }
  return {
    ...input,
    targetLanguageCode
  }
}

async function applyAttachmentTargetLanguageFilter(
  AttachmentModel,
  params,
  targetLanguageCode
) {
  if (!targetLanguageCode) {
    return true
  }

  const translationGroupList = await AttachmentModel.find({
    recordKind: TRANSLATION_RECORD_KIND,
    languageCode: targetLanguageCode
  })
    .select('translationGroupId')
    .lean()
  const translationGroupIdList = translationGroupList
    .map(item => item.translationGroupId)
    .filter(translationGroupId => Boolean(translationGroupId))
  if (translationGroupIdList.length === 0) {
    return false
  }

  params.translationGroupId = { $in: translationGroupIdList }
  return true
}

async function listAttachments(query = {}) {
  const input = parseAttachmentListQuery(query)
  const AttachmentModel = getAttachmentModel()
  const params = buildAttachmentListParams(input)

  const total = await AttachmentModel.countDocuments(params)
  const list = await AttachmentModel.find(params)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit)
    .lean()
  const sourceSettings = await getSourceSeoSettings()

  return {
    list,
    total,
    page: input.page,
    limit: input.limit,
    sourceSiteUrl: sourceSettings.siteUrl || ''
  }
}

async function listAttachmentsBySource(query = {}) {
  const input = parseAttachmentListBySourceQuery(query)
  const AttachmentModel = getAttachmentModel()
  const sourceParams = buildAttachmentListParams(input)
  const shouldQuery = await applyAttachmentTargetLanguageFilter(
    AttachmentModel,
    sourceParams,
    input.targetLanguageCode
  )
  if (!shouldQuery) {
    const sourceSettings = await getSourceSeoSettings()
    return {
      list: [],
      total: 0,
      page: input.page,
      limit: input.limit,
      sourceSiteUrl: sourceSettings.siteUrl || ''
    }
  }

  const total = await AttachmentModel.countDocuments(sourceParams)
  const sourceRecords = await AttachmentModel.find(sourceParams)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((input.page - 1) * input.limit)
    .limit(input.limit)
    .lean()
  const sourceIdList = sourceRecords
    .map(item => item.sourceId)
    .filter(sourceId => Boolean(sourceId))
  const translationMap = new Map()

  sourceRecords.forEach(sourceRecord => {
    translationMap.set(
      String(sourceRecord.sourceId),
      buildEmptyAttachmentTranslationMatrix()
    )
  })

  if (sourceIdList.length > 0) {
    const translations = await AttachmentModel.find({
      recordKind: TRANSLATION_RECORD_KIND,
      sourceId: { $in: sourceIdList }
    })
      .select(
        '_id languageCode sourceId translationGroupId snapshotVersion aiTranslationSkip pendingReview updatedAt'
      )
      .lean()
    translations.forEach(translation => {
      const sourceKey = String(translation.sourceId)
      const matrix = translationMap.get(sourceKey)
      if (!matrix) {
        return
      }
      matrix[translation.languageCode] = translation
    })
  }

  const sourceSettings = await getSourceSeoSettings()

  return {
    list: sourceRecords.map(sourceRecord => {
      const sourceKey = String(sourceRecord.sourceId)
      return {
        sourceRecord,
        translations:
          translationMap.get(sourceKey) ||
          buildEmptyAttachmentTranslationMatrix()
      }
    }),
    total,
    page: input.page,
    limit: input.limit,
    sourceSiteUrl: sourceSettings.siteUrl || ''
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

function parseBooleanOption(value) {
  return value === true || value === 'true' || value === '1'
}

function parseImageReplacementOptions(body = {}) {
  let imgSettingCompressMaxSize = null
  if (/^[1-9]\d*$/.test(String(body.imgSettingCompressMaxSize || ''))) {
    imgSettingCompressMaxSize = Number(body.imgSettingCompressMaxSize)
  }

  return {
    noCompress: parseBooleanOption(body.noCompress),
    noThumbnail: parseBooleanOption(body.noThumbnail),
    is360Panorama: parseBooleanOption(body.is360Panorama),
    imgSettingCompressMaxSize
  }
}

async function getSourceImageSettings() {
  return await mediaSettingsService.getMediaSettingValues()
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

function isVideoFile(file) {
  return Boolean(file && file.mimetype && file.mimetype.startsWith('video'))
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
  suffix,
  options = {}
) {
  const originalName = decodeOriginalName(file)
  const originalExtname = getFileExtname(originalName, file.mimetype)
  const config = await getSourceImageSettings()
  if (options.imgSettingCompressMaxSize) {
    config.imgSettingCompressMaxSize = options.imgSettingCompressMaxSize
  }
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
    is360Panorama: options.is360Panorama,
    status: 1
  }
  const createdFiles = []

  try {
    if (config.imgSettingEnableImgThumbnail && !options.noThumbnail) {
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
      !options.noCompress &&
      config.imgSettingEnableImgCompressWebp
    ) {
      outputExtname = '.webp'
      updateData.mimetype = 'image/webp'
    }

    const localFilePath = path.join(
      yearMonthPath,
      `${attachmentId}-${suffix}${outputExtname}`
    )
    if (config.imgSettingEnableImgCompress && !options.noCompress) {
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

async function buildVideoStorageData(
  file,
  coverFile,
  attachmentId,
  yearMonthPath,
  suffix,
  body = {}
) {
  if (!coverFile || !coverFile.buffer) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '视频替换必须上传封面图',
      'cover',
      400
    )
  }
  if (!isImageFile(coverFile)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '视频封面必须是图片文件',
      'cover',
      400
    )
  }

  const width = parsePositiveInteger(body.width, 0)
  const height = parsePositiveInteger(body.height, 0)
  if (!width || !height) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '视频宽高不能为空',
      'width',
      400
    )
  }

  const filename = String(body.filename || decodeOriginalName(file)).trim()
  const videoPath = path.join(yearMonthPath, `${attachmentId}-${suffix}.mp4`)
  const coverPath = path.join(
    yearMonthPath,
    `thum-${attachmentId}-${suffix}.webp`
  )
  const createdFiles = []

  try {
    await fs.promises.writeFile(videoPath, file.buffer)
    createdFiles.push(videoPath)
    await fs.promises.writeFile(coverPath, coverFile.buffer)
    createdFiles.push(coverPath)

    const videoStats = await fs.promises.stat(videoPath)
    const coverInfo = await utils.imageMetadata(coverFile.buffer)

    return {
      updateData: {
        filename,
        filesize: videoStats.size,
        filepath: toPublicPath(videoPath),
        width,
        height,
        mimetype: 'video/mp4',
        thumfor: toPublicPath(coverPath),
        thumWidth: coverInfo.width || 0,
        thumHeight: coverInfo.height || 0,
        status: 1
      },
      createdFiles
    }
  } catch (error) {
    await cleanupCreatedFiles(createdFiles)
    throw error
  }
}

async function saveLocalFile(file, attachmentId, options = {}) {
  const yearMonth = buildYearMonth()
  const yearMonthPath = await ensureUploadDir(yearMonth)
  const suffix = createFileSuffix()

  if (isVideoFile(file)) {
    return await buildVideoStorageData(
      file,
      options.coverFile,
      attachmentId,
      yearMonthPath,
      suffix,
      options.body
    )
  }

  if (isImageFile(file)) {
    return await buildImageStorageData(
      file,
      attachmentId,
      yearMonthPath,
      suffix,
      options.imageOptions
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

function getAttachmentLocalPathList(attachment) {
  const pathList = []
  if (!attachment) {
    return pathList
  }

  if (attachment.localFilepath) {
    pathList.push(attachment.localFilepath)
  }
  if (attachment.localThumbnailPath) {
    pathList.push(attachment.localThumbnailPath)
  }

  const isStoredLocalFile =
    attachment.mediaMode === 'local' ||
    attachment.localStorageStatus === 'stored'
  if (isStoredLocalFile) {
    if (attachment.filepath) {
      pathList.push(attachment.filepath)
    }
    if (attachment.thumfor) {
      pathList.push(attachment.thumfor)
    }
  }

  return pathList
}

function buildNormalizedContentPathSet(storedPathList = []) {
  const pathSet = new Set()
  for (const storedPath of storedPathList) {
    const filePath = normalizeStoredContentPath(storedPath)
    if (filePath) {
      pathSet.add(path.normalize(filePath))
    }
  }
  return pathSet
}

function getReplacedAttachmentLocalPathList(
  attachment,
  nextStoredPathList = []
) {
  const nextPathSet = buildNormalizedContentPathSet(nextStoredPathList)
  const oldPathSet = new Set()
  const replacedPathList = []

  for (const storedPath of getAttachmentLocalPathList(attachment)) {
    const filePath = normalizeStoredContentPath(storedPath)
    if (!filePath) {
      continue
    }

    const pathKey = path.normalize(filePath)
    if (oldPathSet.has(pathKey)) {
      continue
    }
    oldPathSet.add(pathKey)

    if (nextPathSet.has(pathKey)) {
      continue
    }

    replacedPathList.push(storedPath)
  }

  return replacedPathList
}

async function deleteAttachmentLocalFiles(attachment, nextStoredPathList = []) {
  const replacedPathList = getReplacedAttachmentLocalPathList(
    attachment,
    nextStoredPathList
  )
  await safeDeleteContentFiles(replacedPathList)
}

function validateReplacementFileType(attachment, file) {
  if (attachment.mimetype && attachment.mimetype.startsWith('image')) {
    if (!isImageFile(file)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '图片媒体只能替换为图片文件',
        'file',
        400
      )
    }
    return
  }

  if (attachment.mimetype && attachment.mimetype.startsWith('video')) {
    if (!isVideoFile(file)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '视频媒体只能替换为视频文件',
        'file',
        400
      )
    }
    return
  }

  throw new ApiError(
    ERROR_CODES.CONTENT_FIELD_INVALID,
    '当前媒体类型暂不支持替换',
    'file',
    400
  )
}

async function replaceLocalAttachment(body = {}, file, coverFile) {
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
  validateReplacementFileType(attachment, file)
  const AttachmentModel = getAttachmentModel()
  const storageData = await saveLocalFile(file, String(attachment._id), {
    body,
    coverFile,
    imageOptions: parseImageReplacementOptions(body)
  })
  const updateData = {
    ...storageData.updateData,
    mediaMode: 'local',
    localFilepath: storageData.updateData.filepath,
    localThumbnailPath: storageData.updateData.thumfor || '',
    localStorageStatus: 'stored'
  }
  const nextLocalPathList = [
    storageData.updateData.filepath,
    storageData.updateData.thumfor
  ]
  const replacedLocalPathList = getReplacedAttachmentLocalPathList(
    attachment,
    nextLocalPathList
  )

  let updatedAttachment = null
  try {
    updatedAttachment = await AttachmentModel.findOneAndUpdate(
      { _id: attachment._id, recordKind: TRANSLATION_RECORD_KIND },
      { $set: updateData },
      { new: true }
    ).lean()

    if (!updatedAttachment) {
      throw new Error('attachment update failed')
    }
  } catch (error) {
    await cleanupCreatedFiles(storageData.createdFiles)
    throw error
  }

  await safeDeleteContentFiles(replacedLocalPathList)
  return updatedAttachment
}

function parseLocalAttachmentInput(body = {}) {
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
    languageCode,
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    imageOptions: parseImageReplacementOptions(body)
  }
}

function hasRemoteOrigin(attachment) {
  if (attachment.remoteSourceId) {
    return true
  }

  if (attachment.remoteFilepath) {
    return true
  }

  if (
    attachment.remoteSnapshot &&
    Object.keys(attachment.remoteSnapshot).length > 0
  ) {
    return true
  }

  return false
}

function isPureLocalAttachment(attachment) {
  if (!attachment || attachment.mediaMode !== 'local') {
    return false
  }

  return !hasRemoteOrigin(attachment)
}

async function createLocalAttachment(body = {}, file, coverFile) {
  if (!file || !file.buffer) {
    throw new ApiError(
      ERROR_CODES.UPLOAD_INVALID,
      'file is required',
      'file',
      400
    )
  }

  const input = parseLocalAttachmentInput(body)
  const AttachmentModel = getAttachmentModel()
  const attachmentId = new mongoose.Types.ObjectId()
  const storageData = await saveLocalFile(file, String(attachmentId), {
    body,
    coverFile,
    imageOptions: input.imageOptions
  })

  const now = new Date()
  const createData = {
    _id: attachmentId,
    ...storageData.updateData,
    name: input.name || storageData.updateData.filename || 'local-file',
    description: input.description,
    languageCode: input.languageCode,
    sourceLanguageCode: input.languageCode,
    sourceId: attachmentId,
    sourceCollection: 'attachments',
    sourceSnapshotId: null,
    translationGroupId: attachmentId,
    recordKind: TRANSLATION_RECORD_KIND,
    snapshotVersion: 1,
    sourceSnapshotAt: now,
    sourceUpdatedAt: null,
    sourceHash: `local:${String(attachmentId)}`,
    mediaMode: 'local',
    remoteSourceId: null,
    remoteFilepath: '',
    remoteSnapshot: {},
    localFilepath: storageData.updateData.filepath,
    localThumbnailPath: storageData.updateData.thumfor || '',
    localStorageStatus: 'stored'
  }

  try {
    const attachment = await AttachmentModel.create(createData)
    return attachment.toObject()
  } catch (error) {
    await cleanupCreatedFiles(storageData.createdFiles)
    throw error
  }
}

async function deletePureLocalAttachment(body = {}) {
  const input = parseAttachmentInput(body)
  const attachment = await findAttachment(input)

  if (!isPureLocalAttachment(attachment)) {
    throw new ApiError(
      ERROR_CODES.MEDIA_MODE_INVALID,
      '仅纯本地媒体允许直接删除',
      'mediaMode',
      400
    )
  }

  await deleteAttachmentLocalFiles(attachment)

  await attachment.deleteOne()

  return {
    id: input.id,
    deleted: true
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

  if (!hasRemoteOrigin(attachment)) {
    throw new ApiError(
      ERROR_CODES.MEDIA_MODE_INVALID,
      '纯本地媒体不能转回远程',
      'mediaMode',
      400
    )
  }

  await deleteAttachmentLocalFiles(attachment)

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
  listAttachmentsBySource,
  createLocalAttachment,
  deletePureLocalAttachment,
  replaceLocalAttachment,
  convertLocalAttachmentToRemote,
  normalizeStoredContentPath,
  safeDeleteContentFiles,
  deleteAttachmentLocalFiles,
  isPureLocalAttachment
}
