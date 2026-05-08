const mongoose = require('mongoose')
const mediaService = require('./mediaService')
const {
  buildCoverImageCleanupUpdate
} = require('./coverImageCleanupStateService')
const coverImageTempFileService = require('./coverImageTempFileService')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  COVER_IMAGE_ENTRY_TYPE
} = require('../utils/coverImageTranslationUtils')

const APPLY_ALLOWED_STATUS_SET = new Set([
  '等待审核',
  '不采纳',
  '部分采纳',
  '完全采纳'
])

function getRepositoryModel(collectionName) {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.[collectionName]
  if (!repository || !repository.model) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      `${collectionName} model is not ready`,
      collectionName,
      503
    )
  }
  return repository.model
}

function toObjectId(
  value,
  fieldName,
  errorCode = ERROR_CODES.CONTENT_ID_INVALID
) {
  const text = String(value || '').trim()
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    throw new ApiError(errorCode, undefined, fieldName, 400)
  }
  return new mongoose.Types.ObjectId(text)
}

function toOptionalObjectId(value) {
  const text = String(value || '').trim()
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    return null
  }
  return new mongoose.Types.ObjectId(text)
}

function normalizeArtifactId(value) {
  return String(value || '').trim()
}

function findArtifact(job, artifactId) {
  const artifactList = Array.isArray(job?.result?.coverImageArtifacts)
    ? job.result.coverImageArtifacts
    : []
  return artifactList.find(artifact => {
    return normalizeArtifactId(artifact?.artifactId) === artifactId
  })
}

function assertArtifactAdoptable(artifact) {
  if (!artifact) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      '封面图翻译产物不存在',
      'artifactId',
      404
    )
  }
  if (artifact.status !== 'generated') {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_STATUS_INVALID,
      '只有已生成的封面图产物可以采纳',
      'status',
      400
    )
  }
  if (artifact.adopted === true) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '该封面图产物已经采纳',
      'artifactId',
      409
    )
  }
  if (!artifact.generatedImage || !artifact.generatedImage.tempFilePath) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '封面图临时文件缺失，不能采纳',
      'generatedImage.tempFilePath',
      400
    )
  }
}

async function updateTargetPostCoverImage(targetPostId, attachmentId) {
  const PostModel = getRepositoryModel('posts')
  const targetPost = await PostModel.findOne({
    _id: toObjectId(
      targetPostId,
      'targetPostId',
      ERROR_CODES.CONTENT_ID_INVALID
    )
  }).lean()
  if (!targetPost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      '目标文章不存在，不能采纳封面图',
      'targetPostId',
      404
    )
  }
  const currentCoverImages = Array.isArray(targetPost.coverImages)
    ? targetPost.coverImages
    : []
  const nextCoverImages = [attachmentId]
  currentCoverImages.slice(1).forEach(coverImage => {
    nextCoverImages.push(coverImage)
  })
  await PostModel.updateOne(
    { _id: targetPost._id },
    {
      $set: {
        coverImages: nextCoverImages,
        lastChangDate: new Date()
      }
    }
  )
  return {
    targetPostId: String(targetPost._id),
    coverImages: nextCoverImages.map(item => String(item))
  }
}

function buildAttachmentBody(artifact, body) {
  const languageCode =
    String(body.languageCode || '').trim() ||
    String(artifact.languageCodes?.[0] || '').trim()
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
    name: String(body.name || artifact.targetTitle || 'ai-cover-image').trim(),
    description: 'AI translated cover image'
  }
}

function buildAttachmentFile(artifact, fileData) {
  const filename = `${artifact.generationKey || artifact.artifactId}.png`
  return {
    originalname: filename,
    filename,
    mimetype: fileData.mimeType || 'image/png',
    size: fileData.buffer.length,
    buffer: fileData.buffer
  }
}

function resolveCoverLanguageCode(body, artifact, previewEntry) {
  const languageCode = String(
    body.languageCode ||
      previewEntry?.languageCode ||
      artifact?.languageCodes?.[0] ||
      ''
  ).trim()
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      '封面图采纳缺少 languageCode',
      'languageCode',
      400
    )
  }
  return languageCode
}

async function resolveTargetPostId({ body, artifact, previewEntry }) {
  const explicitTargetPostId = toOptionalObjectId(body.targetPostId)
  if (explicitTargetPostId) {
    return String(explicitTargetPostId)
  }

  const inlineTargetPostId =
    toOptionalObjectId(artifact?.targetPostId) ||
    toOptionalObjectId(previewEntry?.targetPostId)
  if (inlineTargetPostId) {
    return String(inlineTargetPostId)
  }

  const sourcePostId = toObjectId(
    artifact?.sourcePostId || previewEntry?.sourcePostId,
    'sourcePostId',
    ERROR_CODES.SOURCE_ID_INVALID
  )
  const languageCode = resolveCoverLanguageCode(body, artifact, previewEntry)
  const PostModel = getRepositoryModel('posts')
  const targetPost = await PostModel.findOne({
    sourceCollection: 'posts',
    sourceId: sourcePostId,
    languageCode,
    recordKind: 'translation'
  })
    .select('_id')
    .lean()
  if (!targetPost?._id) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标翻译文章不存在，不能采纳封面图',
      'targetPostId',
      404
    )
  }
  return String(targetPost._id)
}

function updateArtifactList(job, artifactId, updateData) {
  const artifactList = Array.isArray(job.result?.coverImageArtifacts)
    ? job.result.coverImageArtifacts
    : []
  return artifactList.map(artifact => {
    if (normalizeArtifactId(artifact?.artifactId) !== artifactId) {
      return artifact
    }
    return {
      ...artifact,
      ...updateData,
      updatedAt: new Date()
    }
  })
}

function updatePreviewEntries(job, artifactId, attachment) {
  const previewEntries = Array.isArray(job.result?.previewEntries)
    ? job.result.previewEntries
    : []
  return previewEntries.map(entry => {
    if (
      entry?.entryType !== COVER_IMAGE_ENTRY_TYPE ||
      normalizeArtifactId(entry.artifactId) !== artifactId
    ) {
      return entry
    }
    return {
      ...entry,
      adopted: true,
      adoptedAt: new Date(),
      adoptedAttachmentId: attachment._id,
      adoptedCoverUrl: attachment.filepath || attachment.localFilepath || ''
    }
  })
}

function buildCoverImageAdoptionEntry({
  job,
  artifact,
  previewEntry,
  targetPostId,
  adminSnapshot,
  applyBatchId,
  now
}) {
  return {
    entryKey: String(previewEntry?.entryKey || '').trim(),
    scope: 'coverImage',
    collectionName: 'posts',
    sourceId: toObjectId(
      artifact?.sourcePostId || previewEntry?.sourcePostId,
      'sourcePostId',
      ERROR_CODES.SOURCE_ID_INVALID
    ),
    recordId: toObjectId(
      targetPostId,
      'targetPostId',
      ERROR_CODES.CONTENT_ID_INVALID
    ),
    fieldName: 'coverImages',
    fieldKey: 'coverImages',
    optionIndex: null,
    urlIndex: null,
    applied: true,
    appliedAt: now,
    appliedBy: adminSnapshot,
    applyBatchId: String(applyBatchId || '').trim(),
    sourceSnapshotVersionAtApply:
      Number(job?.source?.snapshotVersion || 0) || null,
    currentValueHashAtApply: '',
    forced: false,
    forceReason: '',
    conflict: null
  }
}

function updateAdoptionEntries(job, adoptionEntry, adminSnapshot, now) {
  const existingEntryList = Array.isArray(job?.adoption?.entries)
    ? job.adoption.entries
    : []
  let matched = false
  const nextEntryList = existingEntryList.map(entry => {
    if (String(entry?.entryKey || '').trim() !== adoptionEntry.entryKey) {
      return entry
    }
    matched = true
    return adoptionEntry
  })
  if (!matched) {
    nextEntryList.push(adoptionEntry)
  }
  return {
    adoptionEntries: nextEntryList,
    adoptionMeta: {
      adoptedBy: adminSnapshot,
      adoptedAt: now,
      lastApplyBatchId: adoptionEntry.applyBatchId
    }
  }
}

function resolveNextJobStatus(job, adoptionEntries) {
  const previewEntries = Array.isArray(job?.result?.previewEntries)
    ? job.result.previewEntries
    : []
  const selectableEntryKeySet = new Set(
    previewEntries
      .filter(entry => entry?.entryKey && !entry.aiSkipReason)
      .map(entry => String(entry.entryKey))
  )
  const appliedEntryCount = adoptionEntries.filter(entry => {
    return (
      entry?.applied === true &&
      selectableEntryKeySet.has(String(entry.entryKey))
    )
  }).length
  if (
    selectableEntryKeySet.size > 0 &&
    appliedEntryCount >= selectableEntryKeySet.size
  ) {
    return '完全采纳'
  }
  if (appliedEntryCount > 0) {
    return '部分采纳'
  }
  return APPLY_ALLOWED_STATUS_SET.has(job?.status) ? job.status : '等待审核'
}

async function adoptCoverImage(body = {}, options = {}) {
  const jobId = toObjectId(
    body.jobId,
    'jobId',
    ERROR_CODES.TRANSLATION_JOB_ID_INVALID
  )
  const artifactId = normalizeArtifactId(body.artifactId)
  const applyBatchId = String(body.applyBatchId || '').trim()
  if (!artifactId) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'artifactId is required',
      'artifactId',
      400
    )
  }

  const JobModel = getRepositoryModel('translationJobs')
  const job = await JobModel.findOne({
    _id: jobId,
    'storage.deletedAt': null
  }).lean()
  if (!job) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_NOT_FOUND,
      undefined,
      'jobId',
      404
    )
  }

  const artifact = findArtifact(job, artifactId)
  assertArtifactAdoptable(artifact)
  const coverBuffer = await coverImageTempFileService.readGeneratedCoverFile(
    artifact,
    String(jobId)
  )
  const fileData = {
    mimeType: artifact.generatedImage?.mimeType || 'image/png',
    buffer: coverBuffer
  }
  const attachment = await mediaService.createLocalAttachment(
    buildAttachmentBody(artifact, body),
    buildAttachmentFile(artifact, fileData)
  )
  const previewEntryBeforeAdopt = Array.isArray(job.result?.previewEntries)
    ? job.result.previewEntries.find(entry => {
        return (
          entry?.entryType === COVER_IMAGE_ENTRY_TYPE &&
          normalizeArtifactId(entry.artifactId) === artifactId
        )
      })
    : null
  const resolvedTargetPostId = await resolveTargetPostId({
    body,
    artifact,
    previewEntry: previewEntryBeforeAdopt
  })
  const targetUpdate = await updateTargetPostCoverImage(
    resolvedTargetPostId,
    attachment._id
  )

  const now = new Date()
  const artifactUpdateData = {
    adopted: true,
    adoptedAt: now,
    adoptedBy: options.admin
      ? {
          id: options.admin._id || options.admin.id || null,
          username: options.admin.username || '',
          displayName: options.admin.displayName || options.admin.username || ''
        }
      : null,
    adoptedAttachmentId: attachment._id,
    generatedImage: {
      ...artifact.generatedImage,
      adoptedUrl: attachment.filepath || attachment.localFilepath || ''
    }
  }
  const coverImageArtifacts = updateArtifactList(
    job,
    artifactId,
    artifactUpdateData
  )
  const previewEntries = updatePreviewEntries(job, artifactId, attachment)
  const previewEntry = previewEntries.find(entry => {
    return (
      entry?.entryType === COVER_IMAGE_ENTRY_TYPE &&
      normalizeArtifactId(entry.artifactId) === artifactId
    )
  })
  if (!previewEntry?.entryKey) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '封面图预览条目缺少 entryKey，不能写入采纳记录',
      'entryKey',
      400
    )
  }
  const adminSnapshot = options.admin
    ? {
        id: options.admin._id || options.admin.id || null,
        username: options.admin.username || '',
        displayName: options.admin.displayName || options.admin.username || ''
      }
    : null
  const adoptionEntry = buildCoverImageAdoptionEntry({
    job,
    artifact,
    previewEntry,
    targetPostId: resolvedTargetPostId,
    adminSnapshot,
    applyBatchId,
    now
  })
  const adoptionState = updateAdoptionEntries(
    job,
    adoptionEntry,
    adminSnapshot,
    now
  )
  const nextStatus = resolveNextJobStatus(job, adoptionState.adoptionEntries)
  await JobModel.updateOne(
    { _id: jobId },
    {
      $set: {
        'result.coverImageArtifacts': coverImageArtifacts,
        'result.previewEntries': previewEntries,
        'adoption.entries': adoptionState.adoptionEntries,
        'adoption.adoptedBy': adoptionState.adoptionMeta.adoptedBy,
        'adoption.adoptedAt': adoptionState.adoptionMeta.adoptedAt,
        'adoption.lastApplyBatchId':
          adoptionState.adoptionMeta.lastApplyBatchId,
        status: nextStatus,
        'queueControl.active': false,
        'progress.percent': 100,
        updatedBy: adminSnapshot
      }
    }
  )

  return {
    jobId: String(jobId),
    artifactId,
    entryKey: previewEntry.entryKey,
    adoptionEntry,
    attachment,
    targetPost: targetUpdate
  }
}

async function adoptPreviewCoverImage(body = {}) {
  const artifact = body.artifact
  const previewEntry =
    body.previewEntry &&
    typeof body.previewEntry === 'object' &&
    !Array.isArray(body.previewEntry)
      ? body.previewEntry
      : null

  assertArtifactAdoptable(artifact)
  const coverBuffer =
    await coverImageTempFileService.readGeneratedCoverFile(artifact)
  const fileData = {
    mimeType: artifact.generatedImage?.mimeType || 'image/png',
    buffer: coverBuffer
  }
  const attachment = await mediaService.createLocalAttachment(
    buildAttachmentBody(artifact, body),
    buildAttachmentFile(artifact, fileData)
  )
  const resolvedTargetPostId = await resolveTargetPostId({
    body,
    artifact,
    previewEntry
  })
  const targetUpdate = await updateTargetPostCoverImage(
    resolvedTargetPostId,
    attachment._id
  )

  return {
    artifactId: normalizeArtifactId(artifact?.artifactId),
    entryKey: String(previewEntry?.entryKey || '').trim(),
    attachment,
    targetPost: targetUpdate
  }
}

async function cleanupCoverImageTempFiles(body = {}) {
  const jobId = toObjectId(body.jobId, 'jobId')
  const JobModel = getRepositoryModel('translationJobs')
  const job = await JobModel.findOne({
    _id: jobId,
    'storage.deletedAt': null
  }).lean()
  if (!job) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_NOT_FOUND,
      undefined,
      'jobId',
      404
    )
  }
  const cleanupResult =
    await coverImageTempFileService.cleanupJobCoverImageTempFiles(job, {
      ignoreMissing: true
    })
  const cleanupUpdate = buildCoverImageCleanupUpdate(job.result, cleanupResult)
  await JobModel.updateOne(
    { _id: jobId },
    {
      $set: {
        'result.coverImageArtifacts': cleanupUpdate.coverImageArtifacts,
        'result.previewEntries': cleanupUpdate.previewEntries
      }
    }
  )
  return {
    jobId: String(jobId),
    cleaned: cleanupResult.cleanupStatus === 'cleaned',
    cleanupStatus: cleanupResult.cleanupStatus,
    cleanedArtifactIds: cleanupResult.cleanedArtifactIds,
    failedArtifactIds: cleanupResult.failedArtifactIds
  }
}

module.exports = {
  adoptCoverImage,
  adoptPreviewCoverImage,
  cleanupCoverImageTempFiles
}
