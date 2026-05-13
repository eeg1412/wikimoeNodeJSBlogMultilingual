const deepSeekTranslationService = require('./deepSeekTranslationService')
const mongoose = require('mongoose')
const { getLanguageText } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_TYPES
} = require('../../../utils/translationJobConstants')
const translationPayloadApplyService = require('./translationPayloadApplyService')
const translationEntryBuildService = require('./translationEntryBuildService')
const translationPostService = require('./translationPostService')
const coverImageTranslationService = require('./coverImageTranslationService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
const {
  STRUCTURED_RICH_TEXT_VALUE_TYPE,
  renderRichTextDocumentNode
} = require('../utils/richTextDocumentUtils')

const POST_RELATED_POST_FIELDS = [
  'postList',
  'tweetList',
  'contentPostList',
  'contentTweetList'
]
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'

function getJobId(job) {
  return String(job && job._id ? job._id : '')
}

function getPostModel() {
  const repository = global.$mongodDB?.multilingual?.repositories?.posts
  if (!repository || !repository.model) {
    throw new Error('multilingual posts repository not found')
  }
  return repository.model
}

function isValidObjectId(value) {
  const text = String(value || '').trim()
  return Boolean(text && mongoose.Types.ObjectId.isValid(text))
}

function shouldTranslateCoverImage(job, defaultValue) {
  let defaultMode = 'never'
  if (defaultValue === true) {
    defaultMode = 'auto'
  }
  const mode = getCoverImageTranslationMode(job, defaultMode)
  return coverImageTranslationService.shouldTranslateCoverImageForMode(mode)
}

function getCoverImageTranslationMode(job, defaultMode = 'never') {
  const options = job?.request?.options || {}
  if (typeof options.coverImageTranslationMode === 'string') {
    return coverImageTranslationService.normalizeCoverImageTranslationMode(
      options.coverImageTranslationMode,
      defaultMode
    )
  }
  if (typeof options.translateCoverImage === 'boolean') {
    if (options.translateCoverImage) {
      return 'auto'
    }
    return 'never'
  }
  return coverImageTranslationService.normalizeCoverImageTranslationMode(
    defaultMode,
    'never'
  )
}

function shouldSkipCoverImageRecognition(job) {
  return coverImageTranslationService.shouldSkipCoverImageRecognitionForMode(
    getCoverImageTranslationMode(job, 'never')
  )
}

function shouldSearchOfficialTermTranslations(job) {
  const options = job?.request?.options || {}
  return options.searchOfficialTermTranslations === true
}

function getJobTargetLanguageCodes(job) {
  const languageCodes = []
  const targetLanguageCode = String(job?.target?.languageCode || '').trim()
  if (targetLanguageCode) {
    languageCodes.push(targetLanguageCode)
  }
  if (Array.isArray(job?.target?.languageCodes)) {
    job.target.languageCodes.forEach(languageCodeValue => {
      const languageCode = String(languageCodeValue || '').trim()
      if (!languageCode || languageCodes.includes(languageCode)) {
        return
      }
      languageCodes.push(languageCode)
    })
  }
  return languageCodes
}

async function findPostById(id) {
  if (!isValidObjectId(id)) {
    return null
  }
  const PostModel = getPostModel()
  return await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(String(id))
  }).lean()
}

async function findSourcePostForTarget(job, targetPost) {
  if (targetPost?.sourceSnapshotId) {
    const sourcePost = await findPostById(targetPost.sourceSnapshotId)
    if (sourcePost) {
      return sourcePost
    }
  }
  if (job?.source?.snapshotId) {
    const sourcePost = await findPostById(job.source.snapshotId)
    if (sourcePost) {
      return sourcePost
    }
  }
  if (job?.source?.postId) {
    return await findPostById(job.source.postId)
  }
  return null
}

function appendCoverImageResult(result, coverResult, registry, options = {}) {
  if (!coverResult) {
    return result
  }
  if (coverResult.previewEntry) {
    result.previewEntries.push(coverResult.previewEntry)
  }
  if (Array.isArray(coverResult.warnings)) {
    result.warningList.push(...coverResult.warnings)
  }
  const snapshot = coverImageTranslationService.buildRegistrySnapshot(registry)
  result.coverImageArtifacts = snapshot.coverImageArtifacts
  if (coverResult.artifact) {
    const hasArtifact = result.coverImageArtifacts.some(artifact => {
      return artifact.artifactId === coverResult.artifact.artifactId
    })
    if (!hasArtifact) {
      result.coverImageArtifacts.push(coverResult.artifact)
    }
  }
  result.coverImageGenerationMap = snapshot.coverImageGenerationMap
  result.coverImageRecognitionMap = snapshot.coverImageRecognitionMap
  if (options.appendAiJsonLogs !== false) {
    result.aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
      result.aiJsonLogs,
      translationAiJsonLogService.buildCoverImageAiJsonLogs({
        snapshot,
        sourceLanguageCode: options.sourceLanguageCode || '',
        targetLanguageCode: options.targetLanguageCode || '',
        meta: {
          requestId: result.requestId || '',
          jobId: getJobId(options.job)
        }
      })
    )
  }
  return result
}

async function appendPostTranslationCoverImageResult(job, result, context) {
  if (!shouldTranslateCoverImage(job, false)) {
    return result
  }
  await context.updateProgress({
    currentStage: 'TranslateCoverImage',
    currentStep: '正在处理文章封面图 AI 翻译'
  })
  const targetDetail = await translationPostService.getTranslationPostDetail(
    String(job.target.postId)
  )
  const targetPost = targetDetail.post
  const sourcePost = await findSourcePostForTarget(job, targetPost)
  if (!sourcePost) {
    result.warningList.push({
      code: 'cover-source-post-not-found',
      scope: 'cover-image-translation',
      message: '源文章快照不存在，不能处理封面图翻译'
    })
    return result
  }
  const registry = coverImageTranslationService.createCoverImageRegistry()
  const coverResult =
    await coverImageTranslationService.processCoverImageTranslation({
      job,
      registry,
      sourcePost,
      targetPost,
      previewEntries: result.previewEntries,
      targetTitle: job.target?.title,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: job.target.languageCode,
      skipRecognition: true,
      cancellation: context.cancellation
    })
  appendCoverImageResult(result, coverResult, registry, {
    job,
    sourceLanguageCode: job.source.languageCode,
    targetLanguageCode: job.target.languageCode
  })
  await context.saveCheckpoint({
    stage: 'TranslateCoverImage',
    stateSummary: {
      artifactCount: result.coverImageArtifacts.length,
      previewEntryCount: result.previewEntries.length
    }
  })
  return result
}

async function resolveEntries(job, context) {
  const entries = job && job.request && job.request.entries
  if (Array.isArray(entries) && entries.length > 0) {
    return entries
  }

  await context.updateProgress({
    currentStage: 'BuildEntries',
    currentStep: '正在从源快照和目标内容构建翻译条目'
  })

  const result =
    await translationEntryBuildService.buildTranslationJobEntries(job)
  if (!Array.isArray(result.entries) || result.entries.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '后台翻译任务没有可翻译条目',
      'request.entries',
      400,
      { retryable: false }
    )
  }

  await context.saveCheckpoint({
    stage: 'BuildEntries',
    stateSummary: {
      entryCount: result.entries.length,
      skippedEntryCount: result.skippedEntries.length,
      sourceEntryCount: result.sourceEntryCount,
      targetEntryCount: result.targetEntryCount
    }
  })

  return result.entries
}

async function resolvePostTranslationEntries(job, context) {
  const entries = job && job.request && job.request.entries
  if (Array.isArray(entries)) {
    return entries
  }
  return await resolveEntries(job, context)
}

function createEmptyPostTranslationData() {
  return {
    payload: {
      schema: 'wikimoe.ai.translation.empty',
      version: 1,
      entries: []
    },
    usage: null,
    model: '',
    requestId: null,
    aiJsonLogs: []
  }
}

function getPrompt(job) {
  if (!job || !job.request) {
    return ''
  }

  return String(job.request.prompt || '').trim()
}

function getPayloadEntryCount(payload) {
  if (!payload || !Array.isArray(payload.entries)) {
    return 0
  }

  return payload.entries.length
}

function clampProgressPercent(value) {
  const percent = Number(value)
  if (!Number.isFinite(percent)) {
    return 0
  }
  if (percent < 0) {
    return 0
  }
  if (percent > 99) {
    return 99
  }
  return Math.round(percent)
}

function getStatusFraction(message) {
  const match = String(message || '').match(/第\s*(\d+)\s*\/\s*(\d+)/)
  if (!match) {
    return null
  }
  const current = Number(match[1])
  const total = Number(match[2])
  if (!Number.isInteger(current) || !Number.isInteger(total) || total < 1) {
    return null
  }
  if (/已完成/.test(message)) {
    return Math.min(current / total, 1)
  }
  return Math.min(Math.max((current - 1) / total, 0), 1)
}

function getProgressRange(progressRange) {
  if (!progressRange || typeof progressRange !== 'object') {
    return { start: 20, end: 85 }
  }
  const start = Number(progressRange.start)
  const end = Number(progressRange.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { start: 20, end: 85 }
  }
  return {
    start,
    end
  }
}

function getRangePercent(progressRange, startRatio, endRatio, fraction = 0) {
  const range = getProgressRange(progressRange)
  const width = range.end - range.start
  const safeFraction = Math.min(Math.max(Number(fraction) || 0, 0), 1)
  const start = range.start + width * startRatio
  const end = range.start + width * endRatio
  return clampProgressPercent(start + (end - start) * safeFraction)
}

function buildLanguageProgressRange(index, total) {
  const safeTotal = Math.max(Number(total) || 1, 1)
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), safeTotal - 1)
  const start = 10 + (safeIndex / safeTotal) * 78
  const end = 10 + ((safeIndex + 1) / safeTotal) * 78
  return {
    start,
    end
  }
}

function getStatusProgressPercent(message, progressRange) {
  const text = String(message || '')
  const fraction = getStatusFraction(text)
  if (/准备专有名词翻译数据库/.test(text)) {
    return getRangePercent(progressRange, 0, 0.08)
  }
  if (/提取专有名词/.test(text)) {
    return getRangePercent(progressRange, 0.08, 0.28, fraction || 0)
  }
  if (/联网检索/.test(text)) {
    return getRangePercent(progressRange, 0.28, 0.42)
  }
  if (/已整理|未抽取到需要检索/.test(text)) {
    return getRangePercent(progressRange, 0.42, 0.46)
  }
  if (/准备\s*\d+\s*个翻译批次/.test(text)) {
    return getRangePercent(progressRange, 0.46, 0.5)
  }
  if (/翻译第|已完成第|已读取第/.test(text)) {
    return getRangePercent(progressRange, 0.5, 0.95, fraction || 0)
  }
  if (/封面图/.test(text)) {
    return getRangePercent(progressRange, 0.95, 1, fraction || 0)
  }
  return getRangePercent(progressRange, 0, 0.02)
}

function createHandlers(context, stage, progressRange) {
  function runWithoutAwait(promise) {
    Promise.resolve(promise).catch(error => {
      const message = error && error.message ? error.message : String(error)
      if (
        context.cancellation &&
        typeof context.cancellation.cancel === 'function'
      ) {
        context.cancellation.cancel(`任务进度写入失败：${message}`)
      }
    })
  }

  return {
    onStatus(status) {
      if (!context || typeof context.updateProgress !== 'function') {
        return
      }
      const progress = {
        currentStage: stage,
        currentStep:
          status && status.message ? status.message : 'AI 翻译执行中',
        percent: getStatusProgressPercent(status?.message, progressRange)
      }
      if (status && status.workflow) {
        progress.aiWorkflow = status.workflow
      }
      runWithoutAwait(context.updateProgress(progress))
    },
    onResult(result) {
      if (!context || typeof context.saveCheckpoint !== 'function') {
        return
      }
      runWithoutAwait(
        context.saveCheckpoint({
          stage,
          stateSummary: {
            requestId: result && result.requestId ? result.requestId : '',
            model: result && result.model ? result.model : '',
            entryCount: getPayloadEntryCount(result && result.payload)
          }
        })
      )
    },
    async readAiChunkCache(cacheOptions) {
      if (!context || typeof context.readAiChunkCache !== 'function') {
        return null
      }
      return await context.readAiChunkCache(cacheOptions)
    },
    async writeAiChunkCache(cacheRecord) {
      if (!context || typeof context.writeAiChunkCache !== 'function') {
        return null
      }
      return await context.writeAiChunkCache(cacheRecord)
    },
    cancellation: context.cancellation
  }
}

async function buildResult(job, data) {
  const payload = data && data.payload ? data.payload : null
  if (!payload || !Array.isArray(payload.entries)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'AI 翻译结果缺少 payload.entries',
      'payload.entries',
      502,
      { retryable: true }
    )
  }

  const previewEntries =
    await translationPayloadApplyService.buildTranslationJobReviewSnapshot(
      job,
      payload
    )

  return {
    payload,
    previewEntries,
    warningList: [],
    aiSkipList: payload.entries.filter(entry => Boolean(entry.aiSkipReason)),
    relatedResults: [],
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(data.aiJsonLogs),
    aiUsage: data.usage || {},
    model: data.model || '',
    requestId: data.requestId || null
  }
}

async function executePostAiTranslation(job, context) {
  const entries = await resolvePostTranslationEntries(job, context)
  let data = null
  if (entries.length > 0) {
    await context.updateProgress({
      currentStage: 'TranslatePost',
      currentStep: '正在执行文章 AI 翻译',
      percent: 20
    })
    data = await deepSeekTranslationService.translatePostEntriesStream(
      {
        postId: String(job.target.postId),
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: job.target.languageCode,
        targetLanguageCodes: getJobTargetLanguageCodes(job),
        cacheKey: getJobId(job),
        cacheScopeKey: 'post',
        prompt: getPrompt(job),
        searchOfficialTermTranslations:
          shouldSearchOfficialTermTranslations(job),
        entries
      },
      createHandlers(context, 'TranslatePost', { start: 20, end: 85 })
    )
  } else {
    if (!shouldTranslateCoverImage(job, false)) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '文章翻译后台任务没有选择正文条目，也未启用封面图翻译',
        'request.entries',
        400,
        { retryable: false }
      )
    }
    await context.updateProgress({
      currentStage: 'TranslatePost',
      currentStep: '未选择正文条目，跳过文章正文 AI 翻译',
      percent: 20
    })
    data = createEmptyPostTranslationData()
  }

  const result = await buildResult(job, data)
  return await appendPostTranslationCoverImageResult(job, result, context)
}

async function executeContentAiTranslation(job, context) {
  const entries = await resolveEntries(job, context)
  const contentId = job.target.contentId || job.target.postId
  const contentType =
    job.target.collectionName ||
    job.source.collectionName ||
    job.request.options.contentType ||
    'content'
  await context.updateProgress({
    currentStage: 'TranslateContent',
    currentStep: '正在执行通用内容 AI 翻译',
    percent: 20
  })
  const data = await deepSeekTranslationService.translateContentEntriesStream(
    {
      contentId: String(contentId || ''),
      contentType,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: job.target.languageCode,
      targetLanguageCodes: getJobTargetLanguageCodes(job),
      cacheKey: getJobId(job),
      cacheScopeKey: `content:${contentType}`,
      prompt: getPrompt(job),
      searchOfficialTermTranslations: shouldSearchOfficialTermTranslations(job),
      entries,
      snapshotVersion: job.source.snapshotVersion || 1,
      sourceSnapshotId: job.source.snapshotId || null
    },
    createHandlers(context, 'TranslateContent', { start: 20, end: 85 })
  )

  return await buildResult(job, data)
}

function getRecordSourceId(record) {
  if (!record || typeof record !== 'object') {
    return ''
  }
  return String(record.sourceId || record._id || '').trim()
}

function collectRelatedSourceIds(sourcePost, targetPost) {
  const sourceIdSet = new Set()
  POST_RELATED_POST_FIELDS.forEach(fieldName => {
    const sourceRelationList = Array.isArray(sourcePost?.[fieldName])
      ? sourcePost[fieldName]
      : []
    const targetRelationList = Array.isArray(targetPost?.[fieldName])
      ? targetPost[fieldName]
      : []
    const targetRelationMap = new Map()
    targetRelationList.forEach(record => {
      const sourceId = getRecordSourceId(record)
      if (sourceId) {
        targetRelationMap.set(sourceId, record)
      }
    })

    sourceRelationList.forEach(record => {
      const sourceId = getRecordSourceId(record)
      if (!sourceId) {
        return
      }
      const targetRecord = targetRelationMap.get(sourceId)
      if (!targetRecord || targetRecord.aiTranslationSkip !== true) {
        sourceIdSet.add(sourceId)
      }
    })
  })
  return Array.from(sourceIdSet)
}

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function getSourcePostId(sourcePost) {
  return normalizeString(sourcePost?.sourceId || sourcePost?._id)
}

function hasCurrentSnapshotVersion(post) {
  const snapshotId = normalizeString(post?.sourceSnapshotId)
  if (!snapshotId) {
    return false
  }
  return !snapshotId.startsWith('preview-source-')
}

function buildPreviewHtml(valueType, value) {
  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return normalizeString(value)
  }
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return renderRichTextDocumentNode(value)
  }
  return ''
}

function buildSourcePostReviewEntryKey(languageCode, sourceId, entry) {
  const stableEntryKey =
    translationEntryBuildService.buildStableEntryKey(entry, {
      sourcePostId: sourceId
    }) ||
    entry.id ||
    entry.entryKey
  return [languageCode, sourceId, stableEntryKey].map(normalizeString).join(':')
}

function buildSourcePostSkippedEntryKey(languageCode, sourceId, id) {
  return ['skip', languageCode, sourceId, id].map(normalizeString).join(':')
}

function buildAiSkippedEntryPreview({
  entry,
  reason,
  message,
  id,
  hideCurrent
}) {
  const targetValue = hideCurrent ? '' : entry.currentPreviewRawValue || ''
  const targetHtml = hideCurrent
    ? ''
    : entry.currentPreviewHtml ||
      buildPreviewHtml(entry.valueType, entry.currentValue)
  return {
    id,
    scope: entry.scope,
    label: entry.label || entry.recordLabel || entry.id,
    groupLabel: entry.groupLabel,
    groupCategory: entry.groupCategory,
    groupTitle: entry.groupTitle,
    valueType: entry.valueType,
    fieldName: entry.fieldName,
    fieldLabel: entry.fieldLabel,
    recordLabel: entry.recordLabel,
    relationTypeLabel: entry.relationTypeLabel,
    collectionName: entry.collectionName,
    postType: entry.postType,
    optional: entry.optional,
    entryKind: entry.entryKind,
    segmentIndex: entry.segmentIndex,
    segmentTotal: entry.segmentTotal,
    hasSourceValue: true,
    hasCurrentValue: Boolean(targetValue || targetHtml),
    sourceRecordLabel: entry.recordLabel || '',
    sourceValue: entry.sourcePreviewRawValue || entry.previewRawValue || '',
    sourceHtml:
      entry.sourcePreviewHtml || buildPreviewHtml(entry.valueType, entry.value),
    targetRecordLabel: entry.recordLabel || '',
    targetValue,
    targetHtml,
    reason,
    message,
    aiSkipReason: reason
  }
}

function buildMappedSkippedReviewEntries({
  skippedEntries,
  languageCode,
  sourceId,
  hideCurrent
}) {
  return skippedEntries.map((item, index) => {
    const entry = item.entry || item
    const targetEntry = item.targetEntry || null
    const reasonMap = {
      missingSourceId: '源快照缺少 sourceId',
      missingTarget: '缺少当前语言版本',
      typeMismatch: '数据类型不一致'
    }
    const reason = reasonMap[item.reason] || item.reason || 'AI 已跳过'
    const label = entry.label || entry.recordLabel || entry.id || '未知条目'
    const id = buildSourcePostSkippedEntryKey(
      languageCode,
      sourceId,
      `${item.reason || 'mapped'}:${entry.id || index}`
    )
    return {
      ...buildAiSkippedEntryPreview({
        entry: {
          ...entry,
          currentPreviewRawValue: targetEntry?.previewRawValue || '',
          currentPreviewHtml: targetEntry?.previewHtml || ''
        },
        id,
        reason,
        message: `${label}：${reason}`,
        hideCurrent
      }),
      languageCode,
      sourceId,
      entryKey: id
    }
  })
}

function buildAiTranslationSkipEntries({
  entries,
  languageCode,
  sourceId,
  hideCurrent
}) {
  const skippedEntryMap = new Map()
  entries.forEach(entry => {
    if (entry.aiTranslationSkip !== true) {
      return
    }
    const key = [
      entry.scope || '',
      entry.collectionName || '',
      entry.recordId || '',
      entry.fieldName || entry.id || ''
    ].join(':')
    if (skippedEntryMap.has(key)) {
      return
    }
    const label = entry.label || entry.recordLabel || entry.id
    skippedEntryMap.set(key, {
      ...buildAiSkippedEntryPreview({
        entry,
        id: buildSourcePostSkippedEntryKey(
          languageCode,
          sourceId,
          `aiTranslationSkip:${key}`
        ),
        reason: 'AI翻译时跳过',
        message: `${label}：已标记为 AI 翻译时跳过`,
        hideCurrent
      }),
      languageCode,
      sourceId
    })
  })
  return Array.from(skippedEntryMap.values())
}

function shouldSubmitAiImportEntry(entry) {
  return entry.aiTranslationSkip !== true
}

function shouldSkipRelatedPostRelationEntry(entry, relatedSourceIdSet) {
  if (entry.scope !== 'relation' || entry.collectionName !== 'posts') {
    return false
  }
  const sourceId = normalizeString(entry.sourceId)
  return Boolean(sourceId && relatedSourceIdSet.has(sourceId))
}

function deduplicateAiImportEntries({
  entries,
  sourcePostId,
  relatedSourceIds,
  translatedEntryKeySet,
  languageCode,
  hideCurrent
}) {
  const relatedSourceIdSet = new Set(relatedSourceIds.map(String))
  const nextEntries = []
  const skippedEntries = []
  const skippedEntryKeySet = new Set()

  entries.forEach(entry => {
    const entryKey = translationEntryBuildService.buildStableEntryKey(entry, {
      sourcePostId
    })
    if (shouldSkipRelatedPostRelationEntry(entry, relatedSourceIdSet)) {
      const skipKey = `relatedPost:${entryKey || entry.id}`
      if (!skippedEntryKeySet.has(skipKey)) {
        skippedEntryKeySet.add(skipKey)
        const label = entry.label || entry.recordLabel || entry.id
        skippedEntries.push({
          ...buildAiSkippedEntryPreview({
            entry,
            id: buildSourcePostSkippedEntryKey(
              languageCode,
              sourcePostId,
              skipKey
            ),
            reason: '关联文章独立翻译',
            message: `${label}：关联文章会作为独立文章翻译，已跳过当前关联字段`,
            hideCurrent
          }),
          languageCode,
          sourceId: sourcePostId
        })
      }
      return
    }

    if (!entryKey) {
      nextEntries.push(entry)
      return
    }

    if (translatedEntryKeySet.has(entryKey)) {
      const skipKey = `duplicate:${entryKey}`
      if (!skippedEntryKeySet.has(skipKey)) {
        skippedEntryKeySet.add(skipKey)
        const label = entry.label || entry.recordLabel || entry.id
        skippedEntries.push({
          ...buildAiSkippedEntryPreview({
            entry,
            id: buildSourcePostSkippedEntryKey(
              languageCode,
              sourcePostId,
              skipKey
            ),
            reason: '本次已处理',
            message: `${label}：本次翻译已处理相同内容，已跳过重复请求`,
            hideCurrent
          }),
          languageCode,
          sourceId: sourcePostId
        })
      }
      return
    }

    translatedEntryKeySet.add(entryKey)
    nextEntries.push(entry)
  })

  return {
    entries: nextEntries,
    skippedEntries
  }
}

function buildSourcePostPreviewEntries({
  payload,
  requestEntries,
  targetPost,
  languageCode,
  sourceId
}) {
  const requestEntryMap = new Map()
  requestEntries.forEach(entry => {
    if (entry?.id) {
      requestEntryMap.set(String(entry.id), entry)
    }
  })
  const hideCurrentPreview = !hasCurrentSnapshotVersion(targetPost)

  return payload.entries.map(entry => {
    const requestEntry = requestEntryMap.get(String(entry.id || '')) || {}
    const originalEntryKey =
      translationEntryBuildService.buildStableEntryKey(entry, {
        sourcePostId: sourceId
      }) ||
      entry.id ||
      ''
    let currentPreviewText =
      entry.currentPreviewText || requestEntry.currentPreviewText || ''
    let currentPreviewRawValue =
      entry.currentPreviewRawValue || requestEntry.currentPreviewRawValue || ''
    let currentPreviewHtml =
      entry.currentPreviewHtml || requestEntry.currentPreviewHtml || ''
    if (hideCurrentPreview) {
      currentPreviewText = ''
      currentPreviewRawValue = ''
      currentPreviewHtml = ''
    }
    const sourcePreviewText =
      entry.sourcePreviewText || requestEntry.sourcePreviewText || ''
    const sourcePreviewRawValue =
      entry.sourcePreviewRawValue || requestEntry.sourcePreviewRawValue || ''
    const sourcePreviewHtml =
      entry.sourcePreviewHtml || requestEntry.sourcePreviewHtml || ''
    const nextPreviewText = entry.nextPreviewText || entry.previewText || ''
    const nextPreviewRawValue = entry.nextPreviewRawValue || entry.value || ''
    const nextPreviewHtml =
      entry.nextPreviewHtml || buildPreviewHtml(entry.valueType, entry.value)

    const previewEntry = {
      ...entry,
      languageCode,
      sourcePostId: sourceId,
      originalEntryKey,
      entryKey: buildSourcePostReviewEntryKey(languageCode, sourceId, entry),
      currentPreviewText,
      currentPreviewRawValue,
      currentPreviewHtml,
      sourcePreviewText,
      sourcePreviewRawValue,
      sourcePreviewHtml,
      nextPreviewText,
      nextPreviewRawValue,
      nextPreviewHtml,
      hasCurrentValue: Boolean(currentPreviewRawValue || currentPreviewHtml)
    }
    if (entry.scope === 'post' || !previewEntry.sourceId) {
      previewEntry.sourceId = sourceId
    }
    return previewEntry
  })
}

async function translateSourcePostForLanguage({
  job,
  context,
  sourceId,
  languageCode,
  targetLanguageCodes,
  officialTermGlossaryTaskCache,
  progressRange,
  isRoot,
  depth,
  translatedEntryKeySet,
  coverImageTasks
}) {
  await context.updateProgress({
    currentStage: 'BuildEntries',
    currentStep: `正在准备 ${getLanguageText(languageCode)} 预览上下文`,
    percent: getRangePercent(progressRange, 0, 0.03)
  })
  const previewContext =
    await translationPostService.getSourcePostAiImportPreviewContext({
      sourceId,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: languageCode
    })
  const sourcePostId =
    getSourcePostId(previewContext.sourcePost) || String(sourceId)
  const sourceEntries =
    translationEntryBuildService.buildPostTranslationEntries({
      post: previewContext.sourcePost
    })
  const targetEntries =
    translationEntryBuildService.buildPostTranslationEntries(
      { post: previewContext.targetPost },
      true
    )
  const mappedResult = translationEntryBuildService.buildMappedEntries(
    sourceEntries,
    targetEntries
  )
  const relatedSourceIds = collectRelatedSourceIds(
    previewContext.sourcePost,
    previewContext.targetPost
  )
  const hideCurrentPreview = !hasCurrentSnapshotVersion(
    previewContext.targetPost
  )
  const aiTranslationSkippedEntries = buildAiTranslationSkipEntries({
    entries: mappedResult.entries,
    languageCode,
    sourceId: sourcePostId,
    hideCurrent: hideCurrentPreview
  })
  const deduplicationResult = deduplicateAiImportEntries({
    entries: mappedResult.entries.filter(shouldSubmitAiImportEntry),
    sourcePostId,
    relatedSourceIds,
    translatedEntryKeySet,
    languageCode,
    hideCurrent: hideCurrentPreview
  })
  const entries = deduplicationResult.entries
  let data = {
    payload: {
      schema: 'wikimoe.translation.post',
      version: 1,
      meta: {
        contentId: String(previewContext.targetPost._id),
        contentType: 'sourcePostImport',
        languageCode,
        sourceLanguageCode: job.source.languageCode
      },
      entries: []
    },
    usage: {},
    model: '',
    requestId: null
  }
  if (entries.length > 0) {
    await context.updateProgress({
      currentStage: 'TranslatePost',
      currentStep: `正在执行 ${getLanguageText(languageCode)} AI 翻译`,
      percent: getRangePercent(progressRange, 0.05, 0.08)
    })
    data = await deepSeekTranslationService.translateContentEntriesStream(
      {
        contentId: String(previewContext.targetPost._id),
        contentType: 'sourcePostImport',
        properNounScopeKey: `sourcePostImport:${sourcePostId}`,
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: languageCode,
        targetLanguageCodes,
        cacheKey: getJobId(job),
        cacheScopeKey: `sourcePostImport:${languageCode}`,
        prompt: getPrompt(job),
        searchOfficialTermTranslations:
          shouldSearchOfficialTermTranslations(job),
        officialTermGlossaryTaskCache,
        entries
      },
      createHandlers(context, `TranslatePost:${languageCode}`, progressRange)
    )
  }
  const payload = data.payload || { entries: [] }
  const translatedPreviewEntries = buildSourcePostPreviewEntries({
    payload,
    requestEntries: entries,
    targetPost: previewContext.targetPost,
    languageCode,
    sourceId: sourcePostId
  })
  const skippedPreviewEntries = [
    ...buildMappedSkippedReviewEntries({
      skippedEntries: mappedResult.skippedEntries || [],
      languageCode,
      sourceId: sourcePostId,
      hideCurrent: hideCurrentPreview
    }),
    ...aiTranslationSkippedEntries,
    ...deduplicationResult.skippedEntries
  ]
  const previewEntries = translatedPreviewEntries.concat(skippedPreviewEntries)
  const result = {
    payload: {
      ...payload,
      entries: translatedPreviewEntries
    },
    previewEntries,
    warningList: [],
    aiSkipList: previewEntries.filter(entry => Boolean(entry.aiSkipReason)),
    relatedResults: [],
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(data.aiJsonLogs),
    aiUsage: data.usage || {},
    model: data.model || '',
    requestId: data.requestId || null
  }
  if (shouldTranslateCoverImage(job, true) && Array.isArray(coverImageTasks)) {
    coverImageTasks.push({
      job,
      sourcePost: previewContext.sourcePost,
      targetPost: previewContext.targetPost,
      previewEntries: result.previewEntries,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: languageCode,
      skipRecognition: shouldSkipCoverImageRecognition(job),
      result
    })
  }
  await context.saveCheckpoint({
    stage: `TranslatePost:${languageCode}`,
    stateSummary: {
      sourceId: sourcePostId,
      entryCount: translatedPreviewEntries.length,
      skippedEntryCount: skippedPreviewEntries.length,
      coverImageEntryCount: result.previewEntries.filter(entry => {
        return entry && entry.entryType === 'coverImageTranslation'
      }).length,
      requestId: result.requestId || '',
      model: result.model || ''
    }
  })
  return {
    languageCode,
    sourceId: sourcePostId,
    isRoot: isRoot === true,
    depth,
    relatedSourceIds,
    result
  }
}

async function executeSourcePostLanguageDag({
  job,
  context,
  languageCode,
  targetLanguageCodes,
  officialTermGlossaryTaskCache,
  progressRange,
  maxDepth,
  coverImageTasks
}) {
  const queue = [
    {
      sourceId: String(job.source.postId),
      isRoot: true,
      depth: 1
    }
  ]
  const visited = new Set()
  const translatedEntryKeySet = new Set()
  const results = []

  while (queue.length > 0) {
    const task = queue.shift()
    const sourceId = String(task.sourceId || '').trim()
    if (!sourceId || visited.has(sourceId)) {
      continue
    }
    visited.add(sourceId)

    const result = await translateSourcePostForLanguage({
      job,
      context,
      sourceId,
      languageCode,
      targetLanguageCodes,
      officialTermGlossaryTaskCache,
      progressRange,
      isRoot: task.isRoot,
      depth: task.depth,
      translatedEntryKeySet,
      coverImageTasks
    })
    results.push(result)

    if (task.depth >= maxDepth) {
      continue
    }
    result.relatedSourceIds.forEach(relatedSourceId => {
      if (!visited.has(String(relatedSourceId))) {
        queue.push({
          sourceId: relatedSourceId,
          isRoot: false,
          depth: task.depth + 1
        })
      }
    })
  }

  return results
}

async function executeSourcePostAiImport(job, context) {
  const languageCodes = Array.isArray(job.target.languageCodes)
    ? job.target.languageCodes
    : []
  if (languageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '生成并 AI 翻译任务缺少 target.languageCodes',
      'target.languageCodes',
      400,
      { retryable: false }
    )
  }

  const maxDepth = Number(job.request?.recursion?.maxDepth || 3) || 3
  const coverImageTasks = []
  const languageResults = []
  const officialTermGlossaryTaskCache = new Map()
  for (
    let languageIndex = 0;
    languageIndex < languageCodes.length;
    languageIndex += 1
  ) {
    const languageCode = languageCodes[languageIndex]
    languageResults.push(
      ...(await executeSourcePostLanguageDag({
        job,
        context,
        languageCode,
        targetLanguageCodes: languageCodes,
        officialTermGlossaryTaskCache,
        progressRange: buildLanguageProgressRange(
          languageIndex,
          languageCodes.length
        ),
        maxDepth,
        coverImageTasks
      }))
    )
  }

  const coverImageRegistry =
    coverImageTranslationService.createCoverImageRegistry()
  if (coverImageTasks.length > 0) {
    await context.updateProgress({
      currentStage: 'TranslateCoverImage',
      currentStep: '正在按标题去重处理所有语言的封面图 AI 翻译',
      percent: 88
    })
    const coverBatchResult =
      await coverImageTranslationService.processCoverImageTranslationBatch({
        registry: coverImageRegistry,
        tasks: coverImageTasks,
        cancellation: context.cancellation,
        onTaskStart: async ({ task, taskIndex, taskCount }) => {
          await context.updateProgress({
            currentStage: 'TranslateCoverImage',
            currentStep: `正在处理 ${getLanguageText(
              task.targetLanguageCode
            )} 封面图 AI 翻译（${taskIndex + 1}/${taskCount}）`,
            percent: getRangePercent(
              { start: 88, end: 96 },
              0,
              1,
              taskIndex / Math.max(taskCount, 1)
            )
          })
        }
      })
    coverBatchResult.results.forEach(item => {
      appendCoverImageResult(
        item.task.result,
        item.coverResult,
        coverImageRegistry,
        { appendAiJsonLogs: false }
      )
    })
    await context.saveCheckpoint({
      stage: 'TranslateCoverImage',
      stateSummary: {
        taskCount: coverBatchResult.taskCount,
        dedupeGroupCount: coverBatchResult.groupCount,
        duplicateTitleCount: coverBatchResult.duplicateTitleCount,
        artifactCount: coverImageRegistry.artifacts.size
      }
    })
  }

  const previewEntries = languageResults.flatMap(item => {
    return item.result.previewEntries || []
  })
  const coverImageSnapshot =
    coverImageTranslationService.buildRegistrySnapshot(coverImageRegistry)
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    ...languageResults.map(item => item.result.aiJsonLogs || []),
    translationAiJsonLogService.buildCoverImageAiJsonLogs({
      snapshot: coverImageSnapshot,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: '',
      meta: {
        jobId: getJobId(job),
        recursive: true
      }
    })
  )
  const warningList = languageResults.flatMap(item => {
    return item.result.warningList || []
  })
  return {
    payload: {
      schema: 'wikimoe.ai.translation.aggregate',
      version: 1,
      entries: previewEntries
    },
    previewEntries,
    warningList,
    aiSkipList: previewEntries.filter(entry => Boolean(entry.aiSkipReason)),
    relatedResults: languageResults.map(item => ({
      languageCode: item.languageCode,
      isRoot: item.isRoot,
      sourceId: item.sourceId,
      depth: item.depth,
      entryCount: item.result.previewEntries.length,
      requestId: item.result.requestId,
      model: item.result.model
    })),
    languageResults,
    translationPostMap: {},
    aiJsonLogs,
    coverImageArtifacts: coverImageSnapshot.coverImageArtifacts,
    coverImageGenerationMap: coverImageSnapshot.coverImageGenerationMap,
    coverImageRecognitionMap: coverImageSnapshot.coverImageRecognitionMap,
    sourceSnapshotId: null,
    aiUsage: {
      languageResults: languageResults.map(item => ({
        languageCode: item.languageCode,
        usage: item.result.aiUsage || {}
      }))
    }
  }
}

async function executeTranslationJob(job, context) {
  if (!job || !job.jobType) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '后台翻译任务数据不完整',
      'job',
      400,
      { retryable: false }
    )
  }

  await context.saveCheckpoint({
    stage: 'ValidateJob',
    stateSummary: {
      jobId: getJobId(job),
      jobType: job.jobType
    }
  })

  if (job.jobType === TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    return await executePostAiTranslation(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
    return await executeContentAiTranslation(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    return await executeSourcePostAiImport(job, context)
  }

  throw new ApiError(
    ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
    `后台翻译任务类型不支持：${job.jobType}`,
    'jobType',
    400,
    { retryable: false }
  )
}

module.exports = {
  executeTranslationJob
}
