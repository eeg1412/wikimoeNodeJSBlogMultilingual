const translationWorkflowAiService = require('./translationWorkflowAiService')
const mongoose = require('mongoose')
const { getLanguageText } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_TYPES,
  TRANSLATION_JOB_TASK_ROLES,
  TRANSLATION_JOB_CHILD_KINDS
} = require('../../../utils/translationJobConstants')
const translationPayloadApplyService = require('./translationPayloadApplyService')
const translationEntryBuildService = require('./translationEntryBuildService')
const translationPostService = require('./translationPostService')
const coverImageTranslationService = require('./coverImageTranslationService')
const importPostSourceService = require('./importPostSourceService')
const sourcePostProperNounRelationService = require('./sourcePostProperNounRelationService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
const translationValidationService = require('./translationValidationService')
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
const POST_RELATED_ARTICLE_FIELDS = ['postList', 'contentPostList']
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const TRANSLATION_MEMO_SCHEMA = 'wikimoe.ai.translation.task-family.memo'
const TRANSLATION_MEMO_VERSION = 1
const MAX_TRANSLATION_MEMO_ENTRIES_PER_LANGUAGE = 30
const MAX_TRANSLATION_MEMO_TEXT_LENGTH = 1600
const MAX_TRANSLATION_MEMO_TITLE_LENGTH = 160
const TRANSLATION_MEMO_TITLE_UNIFY_INSTRUCTION =
  '如果已经存在已翻译标题并且是有关联的标题。请保证标题的翻译统一！'

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

function getTranslationJobModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.translationJobs
  if (!repository || !repository.model) {
    throw new Error('multilingual translationJobs repository not found')
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

function getJobTaskRelation(job) {
  if (!job || !job.taskRelation || typeof job.taskRelation !== 'object') {
    return {}
  }
  return job.taskRelation
}

function isTaskRelationChildJob(job) {
  return getJobTaskRelation(job).role === 'child'
}

function isSourcePostImportChildJob(job) {
  return isTaskRelationChildJob(job)
}

function shouldSyncRelatedPosts(job) {
  const options = job?.request?.options || {}
  if (options.syncRelatedPosts === false) {
    return false
  }
  if (options.translateRelatedPosts === false) {
    return false
  }
  return true
}

function shouldOrganizeRelatedPosts(job) {
  const options = job?.request?.options || {}
  if (options.syncRelatedPosts === true) {
    return true
  }
  return options.organizeRelatedPosts === true
}

function shouldCreateRelatedChildJobs(job) {
  if (!shouldSyncRelatedPosts(job)) {
    return false
  }
  return !isSourcePostImportChildJob(job)
}

function shouldCreateProperNounOrganizeChildJobs(job) {
  if (!shouldOrganizeRelatedPosts(job)) {
    return false
  }
  return !isTaskRelationChildJob(job)
}

function normalizeRelatedSourceFeatureScopeList(value) {
  const sourceIdList = []
  if (!Array.isArray(value)) {
    return sourceIdList
  }
  value.forEach(item => {
    const sourceId = normalizeString(item)
    if (!sourceId || sourceIdList.includes(sourceId)) {
      return
    }
    sourceIdList.push(sourceId)
  })
  return sourceIdList
}

function getRelatedSourceFeatureScopes(job) {
  const scopes = job?.request?.options?.relatedSourceFeatureScopes
  if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes)) {
    return null
  }
  return {
    autoOrganizeOfficialTermGlossary: normalizeRelatedSourceFeatureScopeList(
      scopes.autoOrganizeOfficialTermGlossary
    ),
    searchOfficialTermTranslations: normalizeRelatedSourceFeatureScopeList(
      scopes.searchOfficialTermTranslations
    ),
    coverImageTranslation: normalizeRelatedSourceFeatureScopeList(
      scopes.coverImageTranslation
    )
  }
}

function isRelatedSourceFeatureSelected(scopes, featureKey, sourceId) {
  if (!scopes) {
    return true
  }
  const selectedSourceIds = scopes[featureKey]
  if (!Array.isArray(selectedSourceIds)) {
    return false
  }
  return selectedSourceIds.includes(sourceId)
}

function applyChildTaskFeatureScopes({ job, planItem, options }) {
  const scopes = getRelatedSourceFeatureScopes(job)
  if (!scopes) {
    return options
  }
  const sourceId = normalizeString(planItem?.sourceId)
  const autoOrganizeSelected = isRelatedSourceFeatureSelected(
    scopes,
    'autoOrganizeOfficialTermGlossary',
    sourceId
  )
  const searchSelected = isRelatedSourceFeatureSelected(
    scopes,
    'searchOfficialTermTranslations',
    sourceId
  )
  const coverImageSelected = isRelatedSourceFeatureSelected(
    scopes,
    'coverImageTranslation',
    sourceId
  )

  options.autoOrganizeOfficialTermGlossary =
    options.autoOrganizeOfficialTermGlossary !== false && autoOrganizeSelected
  options.searchOfficialTermTranslations =
    options.searchOfficialTermTranslations === true &&
    autoOrganizeSelected &&
    searchSelected
  if (!coverImageSelected) {
    options.coverImageTranslationMode = 'never'
    options.translateCoverImage = false
  }
  return options
}

function getSharedTranslationCacheKey(job) {
  const relation = getJobTaskRelation(job)
  const sharedCacheKey = normalizeString(job?.request?.options?.sharedCacheKey)
  if (sharedCacheKey) {
    return sharedCacheKey
  }
  if (relation.rootId) {
    return String(relation.rootId)
  }
  if (relation.parentId) {
    return String(relation.parentId)
  }
  return getJobId(job)
}

function getTranslationMemoRootId(job) {
  const relation = getJobTaskRelation(job)
  if (relation.rootId) {
    return String(relation.rootId)
  }
  if (relation.parentId) {
    return String(relation.parentId)
  }
  return getJobId(job)
}

function getTranslationMemoRootObjectId(job) {
  const rootId = getTranslationMemoRootId(job)
  const rootObjectId = toObjectId(rootId)
  if (!rootObjectId) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '跨任务翻译 memo 缺少有效根任务 ID',
      'taskRelation.rootId',
      400,
      { retryable: false }
    )
  }
  return rootObjectId
}

async function loadTranslationMemoRootJob(job) {
  const JobModel = getTranslationJobModel()
  const rootJob = await JobModel.findOne(
    { _id: getTranslationMemoRootObjectId(job) },
    { _id: 1, taskRelation: 1 }
  ).lean()
  if (!rootJob) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_NOT_FOUND,
      '跨任务翻译 memo 根任务不存在',
      'taskRelation.rootId',
      404,
      { retryable: false }
    )
  }
  return rootJob
}

function normalizeMemoText(
  value,
  maxLength = MAX_TRANSLATION_MEMO_TEXT_LENGTH
) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  let text = ''
  if (typeof value === 'string') {
    text = value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value)
  } else {
    return ''
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function getTranslationMemoLanguageState(rootJob, languageCode) {
  const plan = rootJob?.taskRelation?.plan
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return null
  }
  const memoByLanguage = plan.translationMemoByLanguage
  if (
    !memoByLanguage ||
    typeof memoByLanguage !== 'object' ||
    Array.isArray(memoByLanguage)
  ) {
    return null
  }
  const memoState = memoByLanguage[languageCode]
  if (!memoState || typeof memoState !== 'object' || Array.isArray(memoState)) {
    return null
  }
  return memoState
}

function normalizeMemoTitle(value) {
  return normalizeMemoText(value, MAX_TRANSLATION_MEMO_TITLE_LENGTH)
}

function getTranslationMemoArticleCount(memoState, translatedTitleCount) {
  const articleCount = Number(memoState?.articleCount || 0)
  if (Number.isInteger(articleCount) && articleCount > 0) {
    return articleCount
  }
  const sourceCount = Number(memoState?.sourceCount || 0)
  if (Number.isInteger(sourceCount) && sourceCount > 0) {
    return sourceCount + 1
  }
  return translatedTitleCount
}

function collectTranslationMemoTranslatedTitles(entries) {
  const titleList = []
  if (!Array.isArray(entries)) {
    return titleList
  }
  entries.slice(-MAX_TRANSLATION_MEMO_ENTRIES_PER_LANGUAGE).forEach(entry => {
    const translatedTitle = normalizeMemoTitle(entry?.translatedTitle)
    if (!translatedTitle) {
      return
    }
    if (titleList.includes(translatedTitle)) {
      return
    }
    titleList.push(translatedTitle)
  })
  return titleList
}

function canAppendTranslationMemoPromptLine(lines, nextLine, reservedLines) {
  const candidateLines = [...lines, nextLine, ...reservedLines]
  return candidateLines.join('\n').length <= MAX_TRANSLATION_MEMO_TEXT_LENGTH
}

function buildTranslationMemoPromptFromState(memoState) {
  if (!memoState || !Array.isArray(memoState.entries)) {
    return ''
  }
  const translatedTitleList = collectTranslationMemoTranslatedTitles(
    memoState.entries
  )
  if (translatedTitleList.length === 0) {
    return ''
  }

  const articleCount = getTranslationMemoArticleCount(
    memoState,
    translatedTitleList.length
  )
  const lines = [`一共有 ${articleCount} 篇文章，当前已翻译标题：`]
  const reservedFooterLines = ['', TRANSLATION_MEMO_TITLE_UNIFY_INSTRUCTION]
  for (let index = 0; index < translatedTitleList.length; index += 1) {
    const translatedTitle = translatedTitleList[index]
    const titleLine = `${index + 1}.${translatedTitle}`
    if (
      !canAppendTranslationMemoPromptLine(lines, titleLine, reservedFooterLines)
    ) {
      break
    }
    lines.push(titleLine)
  }
  lines.push(...reservedFooterLines)
  return lines.join('\n')
}

function isTweetSourcePost(sourcePost) {
  return Number(sourcePost?.type || 0) === 2
}

function hasRelatedArticleSourceIds(relatedArticleSourceIds) {
  return (
    Array.isArray(relatedArticleSourceIds) && relatedArticleSourceIds.length > 0
  )
}

function shouldUseTranslationMemoForJob(job, options = {}) {
  if (job?.jobType !== TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    return false
  }
  if (isTweetSourcePost(options.sourcePost)) {
    return false
  }
  if (isSourcePostImportChildJob(job)) {
    return true
  }
  return hasRelatedArticleSourceIds(options.relatedArticleSourceIds)
}

async function getTranslationMemoPromptForLanguage(
  job,
  languageCode,
  options = {}
) {
  const normalizedLanguageCode = normalizeString(languageCode)
  if (!normalizedLanguageCode) {
    return ''
  }
  if (!shouldUseTranslationMemoForJob(job, options)) {
    return ''
  }
  const rootJob = await loadTranslationMemoRootJob(job)
  const memoState = getTranslationMemoLanguageState(
    rootJob,
    normalizedLanguageCode
  )
  return buildTranslationMemoPromptFromState(memoState)
}

function getMemoPreviewText(entry, fieldNames) {
  for (const fieldName of fieldNames) {
    const text = normalizeMemoText(
      entry?.[fieldName],
      MAX_TRANSLATION_MEMO_TITLE_LENGTH
    )
    if (text) {
      return text
    }
  }
  return ''
}

function getMemoPreviewSourceText(entry) {
  return getMemoPreviewText(entry, [
    'sourcePreviewText',
    'sourcePreviewRawValue'
  ])
}

function getMemoPreviewTargetText(entry) {
  return getMemoPreviewText(entry, [
    'nextPreviewText',
    'previewText',
    'nextPreviewRawValue',
    'value'
  ])
}

function isPostMemoPreviewEntry(entry) {
  const scope = normalizeString(entry?.scope)
  if (scope === 'post') {
    return true
  }
  const id = normalizeString(entry?.id).toLowerCase()
  return id.startsWith('post.')
}

function getMemoPreviewFieldName(entry) {
  const fieldName = normalizeString(entry?.fieldName).toLowerCase()
  if (fieldName) {
    return fieldName
  }
  const id = normalizeString(entry?.id).toLowerCase()
  if (id.startsWith('post.')) {
    return id.slice('post.'.length)
  }
  return ''
}

function isTitleMemoPreviewEntry(entry) {
  if (!isPostMemoPreviewEntry(entry)) {
    return false
  }
  const fieldName = getMemoPreviewFieldName(entry)
  const id = normalizeString(entry?.id).toLowerCase()
  if (fieldName === 'title' || fieldName.endsWith('.title')) {
    return true
  }
  if (id === 'title' || id.endsWith('.title') || id.endsWith(':title')) {
    return true
  }
  return false
}

function findTranslationMemoTitleEntry(previewEntries) {
  for (const entry of previewEntries) {
    if (!isTitleMemoPreviewEntry(entry)) {
      continue
    }
    const sourceText = getMemoPreviewSourceText(entry)
    const targetText = getMemoPreviewTargetText(entry)
    if (sourceText && targetText) {
      return entry
    }
  }
  return null
}

function findTranslationMemoEntryBySourceText(previewEntries, sourceText) {
  const normalizedSourceText = normalizeMemoTitle(sourceText)
  if (!normalizedSourceText) {
    return null
  }
  for (const entry of previewEntries) {
    if (!isTitleMemoPreviewEntry(entry)) {
      continue
    }
    const entrySourceText = getMemoPreviewSourceText(entry)
    const entryTargetText = getMemoPreviewTargetText(entry)
    if (entrySourceText === normalizedSourceText && entryTargetText) {
      return entry
    }
  }
  return null
}

function buildTranslationMemoEntry({
  job,
  languageCode,
  sourceId,
  sourceTitle,
  result
}) {
  let previewEntries = []
  if (Array.isArray(result?.previewEntries)) {
    previewEntries = result.previewEntries
  }
  const titleEntry = findTranslationMemoTitleEntry(previewEntries)
  let memoSourceTitle = normalizeMemoTitle(sourceTitle)
  if (!memoSourceTitle && titleEntry) {
    memoSourceTitle = getMemoPreviewSourceText(titleEntry)
  }
  let translatedTitle = ''
  if (titleEntry) {
    translatedTitle = getMemoPreviewTargetText(titleEntry)
  }
  if (!translatedTitle && memoSourceTitle) {
    const titlePairEntry = findTranslationMemoEntryBySourceText(
      previewEntries,
      memoSourceTitle
    )
    if (titlePairEntry) {
      translatedTitle = getMemoPreviewTargetText(titlePairEntry)
    }
  }
  if (!translatedTitle) {
    return null
  }

  return {
    jobId: getJobId(job),
    sourceId: normalizeString(sourceId),
    languageCode: normalizeString(languageCode),
    sourceTitle: memoSourceTitle,
    translatedTitle,
    entryCount: previewEntries.length,
    requestId: normalizeString(result?.requestId),
    model: normalizeString(result?.model),
    createdAt: new Date()
  }
}

function getTranslationMemoArticleCountForUpdate(relatedArticleSourceIds) {
  if (!hasRelatedArticleSourceIds(relatedArticleSourceIds)) {
    return 0
  }
  return relatedArticleSourceIds.length + 1
}

async function appendTranslationMemoForLanguage({
  job,
  languageCode,
  sourceId,
  sourceTitle,
  sourcePost,
  relatedArticleSourceIds,
  result
}) {
  const normalizedLanguageCode = normalizeString(languageCode)
  if (!normalizedLanguageCode) {
    return null
  }
  if (
    !shouldUseTranslationMemoForJob(job, {
      sourcePost,
      relatedArticleSourceIds
    })
  ) {
    return null
  }
  const memoEntry = buildTranslationMemoEntry({
    job,
    languageCode: normalizedLanguageCode,
    sourceId,
    sourceTitle,
    result
  })
  if (!memoEntry) {
    return null
  }

  const JobModel = getTranslationJobModel()
  const now = new Date()
  const rootObjectId = getTranslationMemoRootObjectId(job)
  const memoPath = `taskRelation.plan.translationMemoByLanguage.${normalizedLanguageCode}`
  const updateSet = {
    [`${memoPath}.schema`]: TRANSLATION_MEMO_SCHEMA,
    [`${memoPath}.version`]: TRANSLATION_MEMO_VERSION,
    [`${memoPath}.languageCode`]: normalizedLanguageCode,
    [`${memoPath}.updatedAt`]: now
  }
  const articleCount = getTranslationMemoArticleCountForUpdate(
    relatedArticleSourceIds
  )
  if (!isSourcePostImportChildJob(job) && articleCount > 0) {
    updateSet[`${memoPath}.articleCount`] = articleCount
  }
  const updateResult = await JobModel.updateOne(
    { _id: rootObjectId },
    {
      $set: updateSet,
      $push: {
        [`${memoPath}.entries`]: {
          $each: [memoEntry],
          $slice: -MAX_TRANSLATION_MEMO_ENTRIES_PER_LANGUAGE
        }
      }
    }
  )
  if (updateResult.matchedCount !== 1) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_NOT_FOUND,
      '跨任务翻译 memo 根任务不存在，无法写入标题列表',
      'taskRelation.rootId',
      404,
      { retryable: false }
    )
  }
  return memoEntry
}

function getPlannedRelatedSourceIds(job, languageCode) {
  const relation = getJobTaskRelation(job)
  const relatedMap = relation.plannedRelatedSourceIdsByLanguage || {}
  const relatedList = relatedMap[languageCode]
  if (!Array.isArray(relatedList)) {
    return null
  }
  return relatedList.map(item => normalizeString(item)).filter(Boolean)
}

function getSourcePostDisplayTitle(post) {
  const title = normalizeString(post?.title)
  if (title) {
    return title
  }
  const excerpt = normalizeString(post?.excerpt).replace(/\s+/g, ' ')
  if (excerpt) {
    return excerpt.slice(0, 50)
  }
  const sourceId = getSourcePostId(post)
  if (sourceId) {
    return `源文章 ${sourceId}`
  }
  return '未命名内容'
}

function shouldSearchOfficialTermTranslations(job) {
  const options = job?.request?.options || {}
  if (options.autoOrganizeOfficialTermGlossary === false) {
    return false
  }
  return options.searchOfficialTermTranslations === true
}

function shouldAutoOrganizeOfficialTermGlossary(job) {
  const options = job?.request?.options || {}
  return options.autoOrganizeOfficialTermGlossary !== false
}

function shouldAllowAiKeepOriginalJudgement(job) {
  const options = job?.request?.options || {}
  return options.allowAiKeepOriginalJudgement === true
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
  const coverImageHandlers = createHandlers(context, 'TranslateCoverImage', {
    start: 88,
    end: 96
  })
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
      onStatus: coverImageHandlers.onStatus,
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
  if (Array.isArray(entries) && entries.length > 0) {
    return entries
  }
  // 批量翻译入口只下发 selectedEntryKeys（跨语言稳定匹配键），未携带具体 entries，
  // 此时按源/目标内容在执行阶段重建正文条目；若两者都为空则视为"仅封面图"，返回空条目。
  const selectedEntryKeys = job && job.request && job.request.selectedEntryKeys
  if (Array.isArray(selectedEntryKeys) && selectedEntryKeys.length > 0) {
    return await resolveEntries(job, context)
  }
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

function shouldRunAiValidation(job) {
  return job?.request?.options?.aiVerificationEnabled === true
}

// 在翻译产物生成后、进入等待审核前，调用校验 AI 对全部译文进行全局校验与修正。
async function applyTranslationValidation({
  job,
  result,
  sourceEntries,
  context,
  target
}) {
  if (!shouldRunAiValidation(job)) {
    return result
  }
  if (!result || !result.payload || !Array.isArray(result.payload.entries)) {
    return result
  }

  await context.updateProgress({
    currentStage: translationValidationService.VALIDATION_STAGE,
    currentStep: '正在启动翻译校验',
    percent: 86
  })

  const handlers = createHandlers(
    context,
    translationValidationService.VALIDATION_STAGE,
    { start: 86, end: 96 }
  )

  const validationResult =
    await translationValidationService.validateTranslationPayload({
      job,
      handlers,
      sourceEntries,
      payload: result.payload,
      target
    })

  result.payload = validationResult.payload
  result.previewEntries =
    await translationPayloadApplyService.buildTranslationJobReviewSnapshot(
      job,
      validationResult.payload
    )
  result.aiSkipList = validationResult.payload.entries.filter(entry =>
    Boolean(entry.aiSkipReason)
  )
  result.aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    result.aiJsonLogs,
    validationResult.aiJsonLogs
  )
  result.validation = validationResult.validation

  await context.saveCheckpoint({
    stage: translationValidationService.VALIDATION_STAGE,
    stateSummary: {
      changedEntries: validationResult.validation?.stats?.changedEntries || 0,
      totalEntries: validationResult.validation?.stats?.totalEntries || 0
    }
  })

  return result
}

// 仅校验任务标记：request.options.validateOnly=true 时只对已有译文做质检修正，不重新翻译。
function isValidateOnlyJob(job) {
  return job?.request?.options?.validateOnly === true
}

// 该条目是否已有目标语言译文（仅校验任务只处理已有译文的字段）。
function hasExistingTranslationValue(entry) {
  return Boolean(
    entry && (entry.currentPreviewRawValue || entry.currentPreviewHtml)
  )
}

// 仅校验：对已有译文的所选字段做质检并产出修正（不重新翻译），复用现有校验内核与审核采纳流程。
async function executePostAiValidationOnly(job, context, entries) {
  const targetEntries = entries
    .filter(hasExistingTranslationValue)
    .map(entry => {
      return {
        ...entry,
        value: entry.currentValue
      }
    })
  if (targetEntries.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '所选字段没有可校验的已有译文',
      'request.selectedEntryKeys',
      400,
      { retryable: false }
    )
  }
  await context.updateProgress({
    currentStage: translationValidationService.VALIDATION_STAGE,
    currentStep: '正在校验已有译文',
    percent: 15
  })
  const handlers = createHandlers(
    context,
    translationValidationService.VALIDATION_STAGE,
    { start: 15, end: 92 }
  )
  const validationPayload = {
    schema: 'wikimoe.translation.post',
    version: 1,
    meta: {
      contentId: String(job.target.postId),
      contentType: 'post',
      languageCode: job.target.languageCode,
      sourceLanguageCode: job.source.languageCode
    },
    entries: targetEntries
  }
  const validationResult =
    await translationValidationService.validateTranslationPayload({
      job,
      handlers,
      sourceEntries: entries,
      payload: validationPayload,
      target: {
        mode: 'post',
        postId: String(job.target.postId),
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: job.target.languageCode
      }
    })
  const data = {
    payload: validationResult.payload,
    usage: {},
    model: '',
    requestId: null,
    aiJsonLogs: validationResult.aiJsonLogs
  }
  const result = await buildResult(job, data)
  result.validation = validationResult.validation
  return result
}

async function executePostAiTranslation(job, context) {
  const entries = await resolvePostTranslationEntries(job, context)
  // 仅校验任务：不重新翻译，直接对已有译文的所选字段做质检并产出修正。
  if (isValidateOnlyJob(job)) {
    return await executePostAiValidationOnly(job, context, entries)
  }
  let data = null
  if (entries.length > 0) {
    await context.updateProgress({
      currentStage: 'TranslatePost',
      currentStep: '正在执行文章 AI 翻译',
      percent: 20
    })
    data = await translationWorkflowAiService.translatePostEntriesStream(
      {
        postId: String(job.target.postId),
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: job.target.languageCode,
        targetLanguageCodes: getJobTargetLanguageCodes(job),
        translationJobId: getJobId(job),
        cacheKey: getJobId(job),
        cacheScopeKey: 'post',
        prompt: getPrompt(job),
        translationMemoPrompt: await getTranslationMemoPromptForLanguage(
          job,
          job.target.languageCode
        ),
        autoOrganizeOfficialTermGlossary:
          shouldAutoOrganizeOfficialTermGlossary(job),
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

  let result = await buildResult(job, data)
  result = await applyTranslationValidation({
    job,
    result,
    sourceEntries: entries,
    context,
    target: {
      mode: 'post',
      postId: String(job.target.postId),
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: job.target.languageCode
    }
  })
  result = await appendPostTranslationCoverImageResult(job, result, context)
  await appendTranslationMemoForLanguage({
    job,
    languageCode: job.target.languageCode,
    sourceId: job.source.postId || job.target.postId,
    sourceTitle: job.source.title || job.target.title,
    result
  })
  return result
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
  const data = await translationWorkflowAiService.translateContentEntriesStream(
    {
      contentId: String(contentId || ''),
      contentType,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: job.target.languageCode,
      targetLanguageCodes: getJobTargetLanguageCodes(job),
      translationJobId: getJobId(job),
      cacheKey: getJobId(job),
      cacheScopeKey: `content:${contentType}`,
      prompt: getPrompt(job),
      translationMemoPrompt: await getTranslationMemoPromptForLanguage(
        job,
        job.target.languageCode
      ),
      searchOfficialTermTranslations: shouldSearchOfficialTermTranslations(job),
      entries,
      snapshotVersion: job.source.snapshotVersion || 1,
      sourceSnapshotId: job.source.snapshotId || null
    },
    createHandlers(context, 'TranslateContent', { start: 20, end: 85 })
  )

  const result = await buildResult(job, data)
  await applyTranslationValidation({
    job,
    result,
    sourceEntries: entries,
    context,
    target: {
      mode: 'content',
      contentId: String(contentId || ''),
      contentType,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: job.target.languageCode
    }
  })
  await appendTranslationMemoForLanguage({
    job,
    languageCode: job.target.languageCode,
    sourceId: job.source.contentId || job.source.postId || contentId,
    sourceTitle: job.source.title || job.target.title,
    result
  })
  return result
}

function getRecordSourceId(record) {
  if (record === null || typeof record === 'undefined') {
    return ''
  }
  if (typeof record === 'string' || typeof record === 'number') {
    return normalizeString(record)
  }
  if (record instanceof mongoose.Types.ObjectId) {
    return normalizeString(record)
  }
  if (typeof record !== 'object') {
    return ''
  }
  const sourceId = normalizeString(record.sourceId)
  if (sourceId) {
    return sourceId
  }
  const id = normalizeString(record._id)
  if (id) {
    return id
  }
  if (typeof record.toHexString === 'function') {
    return normalizeString(record.toHexString())
  }
  return ''
}

function collectRelatedSourceIdsByFields(sourcePost, targetPost, fieldNames) {
  const sourceIdSet = new Set()
  fieldNames.forEach(fieldName => {
    let sourceRelationList = []
    if (Array.isArray(sourcePost?.[fieldName])) {
      sourceRelationList = sourcePost[fieldName]
    }
    let targetRelationList = []
    if (Array.isArray(targetPost?.[fieldName])) {
      targetRelationList = targetPost[fieldName]
    }
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

function collectRelatedSourceIds(sourcePost, targetPost) {
  return collectRelatedSourceIdsByFields(
    sourcePost,
    targetPost,
    POST_RELATED_POST_FIELDS
  )
}

function collectRelatedArticleSourceIds(sourcePost, targetPost) {
  return collectRelatedSourceIdsByFields(
    sourcePost,
    targetPost,
    POST_RELATED_ARTICLE_FIELDS
  )
}

function isRelatedPostRelationEntry(entry) {
  if (!entry || entry.scope !== 'relation') {
    return false
  }
  if (entry.collectionName !== 'posts') {
    return false
  }
  return Boolean(normalizeString(entry.sourceId))
}

function shouldSubmitProperNounOrganizeEntry(entry) {
  if (!shouldSubmitAiImportEntry(entry)) {
    return false
  }
  return !isRelatedPostRelationEntry(entry)
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

// 是否为可跨家族文章复用的共享关联实体条目（番剧/分类/标签/电影/书籍/游戏等关联实体，
// 以及分类父级/游戏平台等父级关联实体；不含文章自身的标题/正文，这些条目跨文章天然不会重复）。
function isReusableDependencyEntry(entry) {
  if (!entry) {
    return false
  }
  return entry.scope === 'relation' || entry.scope === 'parentRelation'
}

// 解析家族根任务 ObjectId（共享关联实体译文缓存存放在该文档上）。非家族任务返回 null。
function getDependencyCacheRootObjectId(job) {
  const relation = getJobTaskRelation(job)
  const rootId = relation.rootId || relation.parentId
  if (!rootId) {
    return null
  }
  return toObjectId(String(rootId))
}

// 读取家族根任务上某语言的共享关联实体译文缓存。
// 返回 Map: 稳定条目键(entryKey) -> { valueType, value }。
async function loadFamilyDependencyTranslationCache(job, languageCode) {
  const rootObjectId = getDependencyCacheRootObjectId(job)
  if (!rootObjectId) {
    return new Map()
  }
  const JobModel = getTranslationJobModel()
  const rootJob = await JobModel.findOne(
    { _id: rootObjectId },
    { dependencyTranslationCache: 1 }
  ).lean()
  const cacheList = Array.isArray(rootJob?.dependencyTranslationCache)
    ? rootJob.dependencyTranslationCache
    : []
  const cacheMap = new Map()
  cacheList.forEach(item => {
    if (!item || item.languageCode !== languageCode || !item.entryKey) {
      return
    }
    if (!cacheMap.has(item.entryKey)) {
      cacheMap.set(item.entryKey, {
        valueType: item.valueType || '',
        value: item.value
      })
    }
  })
  return cacheMap
}

// 把本次新翻译的共享关联实体译文写入家族根任务缓存。
// 以 (语言 + 稳定条目键) 去重，只有首个写入者生效，保证同一关联实体在家族内只翻译一次；
// 采用条件 $push（不存在才写入），并发与失败重试均幂等，系统重启后仍可正确复用。
async function saveFamilyDependencyTranslationCache(
  job,
  languageCode,
  cacheEntries
) {
  if (!Array.isArray(cacheEntries) || cacheEntries.length === 0) {
    return
  }
  const rootObjectId = getDependencyCacheRootObjectId(job)
  if (!rootObjectId) {
    return
  }
  const JobModel = getTranslationJobModel()
  for (const cacheEntry of cacheEntries) {
    if (!cacheEntry || !cacheEntry.entryKey) {
      continue
    }
    await JobModel.updateOne(
      {
        _id: rootObjectId,
        dependencyTranslationCache: {
          $not: {
            $elemMatch: {
              languageCode,
              entryKey: cacheEntry.entryKey
            }
          }
        }
      },
      {
        $push: {
          dependencyTranslationCache: {
            languageCode,
            entryKey: cacheEntry.entryKey,
            valueType: cacheEntry.valueType || '',
            value: cacheEntry.value,
            createdAt: new Date()
          }
        }
      }
    )
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
      targetLanguageCode: languageCode,
      sourceSnapshotId: getJobSourceSnapshotIdForSource(job, sourceId)
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
    targetEntries,
    {
      allowAiKeepOriginalJudgement: shouldAllowAiKeepOriginalJudgement(job)
    }
  )
  let relatedSourceIds = []
  const plannedRelatedSourceIds = getPlannedRelatedSourceIds(job, languageCode)
  if (Array.isArray(plannedRelatedSourceIds)) {
    relatedSourceIds = plannedRelatedSourceIds
  } else if (shouldSyncRelatedPosts(job)) {
    relatedSourceIds = collectRelatedSourceIds(
      previewContext.sourcePost,
      previewContext.targetPost
    )
  }
  const relatedArticleSourceIds = collectRelatedArticleSourceIds(
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
  // 家族级共享关联实体去重：同一家族内其他文章已翻译过的共享关联实体（如番剧）按
  // (语言 + 稳定条目键) 命中缓存，则直接复用缓存译文、不再发给 AI，避免重复翻译浪费 token。
  const familyDependencyCache = await loadFamilyDependencyTranslationCache(
    job,
    languageCode
  )
  const aiRequestEntries = []
  const reusedDependencyEntries = []
  entries.forEach(entry => {
    const dependencyEntryKey = isReusableDependencyEntry(entry)
      ? translationEntryBuildService.buildStableEntryKey(entry, {
          sourcePostId
        })
      : ''
    if (dependencyEntryKey && familyDependencyCache.has(dependencyEntryKey)) {
      const cached = familyDependencyCache.get(dependencyEntryKey)
      reusedDependencyEntries.push({
        ...entry,
        value: cached.value,
        valueType: cached.valueType || entry.valueType
      })
      return
    }
    aiRequestEntries.push(entry)
  })
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
  if (aiRequestEntries.length > 0) {
    await context.updateProgress({
      currentStage: 'TranslatePost',
      currentStep: `正在执行 ${getLanguageText(languageCode)} AI 翻译`,
      percent: getRangePercent(progressRange, 0.05, 0.08)
    })
    data = await translationWorkflowAiService.translateContentEntriesStream(
      {
        contentId: String(previewContext.targetPost._id),
        contentType: 'sourcePostImport',
        properNounScopeKey: `sourcePostImport:${sourcePostId}`,
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: languageCode,
        targetLanguageCodes,
        translationJobId: getJobId(job),
        cacheKey: getSharedTranslationCacheKey(job),
        cacheScopeKey: `sourcePostImport:${languageCode}`,
        prompt: getPrompt(job),
        translationMemoPrompt: await getTranslationMemoPromptForLanguage(
          job,
          languageCode,
          {
            sourcePost: previewContext.sourcePost,
            relatedArticleSourceIds
          }
        ),
        autoOrganizeOfficialTermGlossary:
          shouldAutoOrganizeOfficialTermGlossary(job),
        searchOfficialTermTranslations:
          shouldSearchOfficialTermTranslations(job),
        officialTermGlossaryTaskCache,
        entries: aiRequestEntries
      },
      createHandlers(context, `TranslatePost:${languageCode}`, progressRange)
    )
    if (shouldAutoOrganizeOfficialTermGlossary(job)) {
      await context.updateProgress({
        currentStage: 'BindProperNouns',
        currentStep: `正在关联 ${getLanguageText(languageCode)} 专有名词词库`,
        percent: getRangePercent(progressRange, 0.82, 0.84)
      })
      await sourcePostProperNounRelationService.bindOrganizedTermsToSourcePost({
        sourceId: sourcePostId,
        sourceLanguageCode: job.source.languageCode,
        sourcePost: previewContext.sourcePost,
        extractedTerms:
          data.officialTermGlossaryBindingData?.extractedTerms || [],
        matchedTermIds:
          data.officialTermGlossaryBindingData?.matchedTermIds || [],
        matchedTermLinks:
          data.officialTermGlossaryBindingData?.matchedTermLinks || [],
        relationSource: 'translationWorkflow',
        lastOrganizedAt: new Date()
      })
    }
  }
  const payload = data.payload || { entries: [] }
  let nodeValidation = null
  if (
    shouldRunAiValidation(job) &&
    Array.isArray(payload.entries) &&
    payload.entries.length > 0
  ) {
    await context.updateProgress({
      currentStage: translationValidationService.VALIDATION_STAGE,
      currentStep: `正在校验 ${getLanguageText(languageCode)} AI 翻译`,
      percent: getRangePercent(progressRange, 0.85, 0.9)
    })
    const validationHandlers = createHandlers(
      context,
      `${translationValidationService.VALIDATION_STAGE}:${languageCode}`,
      progressRange
    )
    const nodeValidationResult =
      await translationValidationService.validateTranslationPayload({
        job,
        handlers: validationHandlers,
        sourceEntries: aiRequestEntries,
        payload,
        target: {
          mode: 'content',
          contentId: String(previewContext.targetPost._id),
          contentType: 'sourcePostImport',
          cacheScopeKey: `validation:${languageCode}:${sourcePostId}`,
          // 让校验精校阶段也按源文章绑定的专有名词数据库加载术语，避免推翻按名词库翻译的专有名词。
          properNounScopeKey: `sourcePostImport:${sourcePostId}`,
          sourceLanguageCode: job.source.languageCode,
          targetLanguageCode: languageCode
        }
      })
    payload.entries = nodeValidationResult.payload.entries
    nodeValidation = nodeValidationResult.validation
    data.aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
      data.aiJsonLogs,
      nodeValidationResult.aiJsonLogs
    )
  }
  // 把本次新翻译（含校验后定稿）的共享关联实体译文写入家族缓存，供家族内其他文章复用。
  const freshTranslatedEntries = Array.isArray(payload.entries)
    ? payload.entries
    : []
  const newDependencyCacheEntries = freshTranslatedEntries
    .filter(entry => isReusableDependencyEntry(entry) && !entry.aiSkipReason)
    .map(entry => ({
      entryKey: translationEntryBuildService.buildStableEntryKey(entry, {
        sourcePostId
      }),
      valueType: entry.valueType || '',
      value: entry.value
    }))
    .filter(item => Boolean(item.entryKey))
  await saveFamilyDependencyTranslationCache(
    job,
    languageCode,
    newDependencyCacheEntries
  )
  // 复用的共享关联实体译文条目并入最终译文产物，使本文章预览/采纳自包含（单独采纳也能落地译文）。
  if (reusedDependencyEntries.length > 0) {
    payload.entries = freshTranslatedEntries.concat(reusedDependencyEntries)
  }
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
    requestId: data.requestId || null,
    validation: nodeValidation
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
  const translationMemoEntry = await appendTranslationMemoForLanguage({
    job,
    languageCode,
    sourceId: sourcePostId,
    sourceTitle: getSourcePostDisplayTitle(previewContext.sourcePost),
    sourcePost: previewContext.sourcePost,
    relatedArticleSourceIds,
    result
  })
  await context.saveCheckpoint({
    stage: `TranslatePost:${languageCode}`,
    stateSummary: {
      sourceId: sourcePostId,
      entryCount: translatedPreviewEntries.length,
      skippedEntryCount: skippedPreviewEntries.length,
      coverImageEntryCount: result.previewEntries.filter(entry => {
        return entry && entry.entryType === 'coverImageTranslation'
      }).length,
      translationMemoUpdated: Boolean(translationMemoEntry),
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
  coverImageTasks,
  enqueueRelatedPosts
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

    if (enqueueRelatedPosts !== true) {
      continue
    }
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

function toObjectId(value) {
  const text = normalizeString(value)
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    return null
  }
  return new mongoose.Types.ObjectId(text)
}

function buildExecutionLog(message, level = 'info', stage = '') {
  return {
    message,
    level,
    stage,
    createdAt: new Date()
  }
}

function getPlanNode(planMap, sourceId) {
  const key = normalizeString(sourceId)
  if (!planMap.has(key)) {
    planMap.set(key, {
      sourceId: key,
      title: '',
      minDepth: Number.MAX_SAFE_INTEGER,
      parentSourceIds: [],
      languageCodes: [],
      plannedRelatedSourceIdsByLanguage: {}
    })
  }
  return planMap.get(key)
}

function appendUniqueValue(list, value) {
  const text = normalizeString(value)
  if (!text) {
    return
  }
  if (!list.includes(text)) {
    list.push(text)
  }
}

function updatePlanNodeForLanguage({
  planMap,
  sourceId,
  languageCode,
  depth,
  sourcePost,
  parentSourceId
}) {
  const node = getPlanNode(planMap, sourceId)
  if (depth < node.minDepth) {
    node.minDepth = depth
  }
  appendUniqueValue(node.languageCodes, languageCode)
  appendUniqueValue(node.parentSourceIds, parentSourceId)
  if (!node.title && sourcePost) {
    node.title = getSourcePostDisplayTitle(sourcePost)
  }
  return node
}

function setPlanNodeRelatedSourceIds({ node, languageCode, relatedSourceIds }) {
  const list = []
  relatedSourceIds.forEach(sourceId => {
    appendUniqueValue(list, sourceId)
  })
  node.plannedRelatedSourceIdsByLanguage[languageCode] = list
}

function getJobSourceSnapshotIdForSource(job, sourceId) {
  const jobSourceId = normalizeString(job.source?.postId)
  if (!jobSourceId || normalizeString(sourceId) !== jobSourceId) {
    return ''
  }
  return normalizeString(job.source?.snapshotId)
}

async function loadSourcePostImportPreviewContextForPlan({
  job,
  sourceId,
  languageCode
}) {
  return await translationPostService.getSourcePostAiImportPreviewContext({
    sourceId,
    sourceLanguageCode: job.source.languageCode,
    targetLanguageCode: languageCode,
    sourceSnapshotId: getJobSourceSnapshotIdForSource(job, sourceId)
  })
}

async function buildSourcePostImportChildPlan({
  job,
  languageCodes,
  maxDepth,
  context
}) {
  const rootSourceId = normalizeString(job.source.postId)
  if (!rootSourceId || maxDepth <= 1) {
    return []
  }

  const planMap = new Map()
  for (
    let languageIndex = 0;
    languageIndex < languageCodes.length;
    languageIndex += 1
  ) {
    const languageCode = languageCodes[languageIndex]
    const queue = [
      {
        sourceId: rootSourceId,
        parentSourceId: '',
        depth: 1
      }
    ]
    const visited = new Set()

    while (queue.length > 0) {
      const task = queue.shift()
      const sourceId = normalizeString(task.sourceId)
      if (!sourceId || visited.has(sourceId)) {
        continue
      }
      visited.add(sourceId)

      const previewContext = await loadSourcePostImportPreviewContextForPlan({
        job,
        sourceId,
        languageCode
      })
      const normalizedSourceId =
        getSourcePostId(previewContext.sourcePost) || sourceId
      if (normalizedSourceId !== rootSourceId) {
        updatePlanNodeForLanguage({
          planMap,
          sourceId: normalizedSourceId,
          languageCode,
          depth: task.depth,
          sourcePost: previewContext.sourcePost,
          parentSourceId: task.parentSourceId
        })
      }

      const relatedSourceIds = collectRelatedSourceIds(
        previewContext.sourcePost,
        previewContext.targetPost
      )
      if (normalizedSourceId !== rootSourceId) {
        const node = getPlanNode(planMap, normalizedSourceId)
        setPlanNodeRelatedSourceIds({
          node,
          languageCode,
          relatedSourceIds
        })
      }

      if (task.depth >= maxDepth) {
        continue
      }

      relatedSourceIds.forEach(relatedSourceId => {
        const relatedId = normalizeString(relatedSourceId)
        if (!relatedId || relatedId === rootSourceId) {
          return
        }
        updatePlanNodeForLanguage({
          planMap,
          sourceId: relatedId,
          languageCode,
          depth: task.depth + 1,
          sourcePost: null,
          parentSourceId: normalizedSourceId
        })
        if (!visited.has(relatedId)) {
          queue.push({
            sourceId: relatedId,
            parentSourceId: normalizedSourceId,
            depth: task.depth + 1
          })
        }
      })
    }

    if (context?.cancellation?.isCancelled) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_CANCELLED,
        '任务已停止，取消相关文章拆解',
        'translationJob',
        499,
        { retryable: false }
      )
    }
  }

  return Array.from(planMap.values())
    .filter(item => item.sourceId !== rootSourceId)
    .sort((leftItem, rightItem) => {
      if (leftItem.minDepth !== rightItem.minDepth) {
        return leftItem.minDepth - rightItem.minDepth
      }
      return leftItem.sourceId.localeCompare(rightItem.sourceId)
    })
}

function buildChildTaskRequest(job, planItem, rootId) {
  const request = job.request || {}
  let options = {
    ...(request.options || {}),
    syncRelatedPosts: true,
    sharedCacheKey: String(rootId),
    plannedRelatedSourceIdsByLanguage:
      planItem.plannedRelatedSourceIdsByLanguage || {}
  }
  options = applyChildTaskFeatureScopes({ job, planItem, options })
  return {
    selectedEntryKeys: Array.isArray(request.selectedEntryKeys)
      ? request.selectedEntryKeys
      : [],
    prompt: request.prompt || '',
    baseMode: request.baseMode || '',
    targetLanguageCodes: planItem.languageCodes,
    recursion: {
      maxDepth: 1
    },
    entries: [],
    options
  }
}

function buildChildTaskRelation({ job, planItem, rootId }) {
  return {
    role: 'child',
    rootId,
    parentId: job._id,
    depth: planItem.minDepth,
    sourcePostId: toObjectId(planItem.sourceId),
    childJobIds: [],
    plannedRelatedSourceIdsByLanguage:
      planItem.plannedRelatedSourceIdsByLanguage || {},
    plan: {
      parentSourceIds: planItem.parentSourceIds || [],
      languageCodes: planItem.languageCodes || []
    }
  }
}

async function createSourcePostImportChildJobs({
  job,
  languageCodes,
  maxDepth,
  context
}) {
  await context.updateProgress({
    currentStage: 'AnalyzeRelatedPosts',
    currentStep: '正在分析相关文章并拆解 AI 子任务',
    percent: 1
  })
  const childPlan = await buildSourcePostImportChildPlan({
    job,
    languageCodes,
    maxDepth,
    context
  })
  if (childPlan.length === 0) {
    await context.saveCheckpoint({
      stage: 'AnalyzeRelatedPosts',
      stateSummary: {
        childTaskCount: 0,
        message: '没有需要同步翻译的相关文章'
      }
    })
    return []
  }

  const JobModel = getTranslationJobModel()
  const rootId = getJobTaskRelation(job).rootId || job._id
  const childJobIds = []
  const childTaskResults = []
  for (const planItem of childPlan) {
    const sourcePostId = toObjectId(planItem.sourceId)
    if (!sourcePostId) {
      continue
    }
    const existingChild = await JobModel.findOne({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT,
      'taskRelation.parentId': job._id,
      'source.postId': sourcePostId
    }).lean()
    if (existingChild) {
      childJobIds.push(existingChild._id)
      childTaskResults.push({
        sourceId: planItem.sourceId,
        title: planItem.title || '',
        depth: planItem.minDepth,
        languageCodes: planItem.languageCodes,
        childJobId: existingChild._id
      })
      continue
    }

    const title = planItem.title || `源文章 ${planItem.sourceId}`
    const childJob = await JobModel.create({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT,
      status: TRANSLATION_JOB_STATUS.PENDING,
      queueControl: {
        active: true,
        deferred: false,
        priority: job.queueControl?.priority || 0
      },
      source: {
        postId: sourcePostId,
        languageCode: job.source.languageCode,
        overwriteSnapshot: job.source?.overwriteSnapshot === true,
        title,
        meta: {
          parentJobId: getJobId(job),
          rootJobId: String(rootId)
        }
      },
      target: {
        languageCodes: planItem.languageCodes,
        title
      },
      request: buildChildTaskRequest(job, planItem, rootId),
      taskRelation: buildChildTaskRelation({ job, planItem, rootId }),
      progress: {
        currentStep: '等待后台 worker 领取相关文章子任务',
        currentStage: 'pending',
        totalSteps: 0,
        completedSteps: 0,
        percent: 0,
        recentLogs: [
          buildExecutionLog(
            `由父任务 ${getJobId(job)} 拆解创建`,
            'info',
            'createChildTask'
          )
        ]
      },
      createdBy: job.createdBy || null,
      updatedBy: job.updatedBy || job.createdBy || null
    })
    childJobIds.push(childJob._id)
    childTaskResults.push({
      sourceId: planItem.sourceId,
      title: planItem.title || '',
      depth: planItem.minDepth,
      languageCodes: planItem.languageCodes,
      childJobId: childJob._id
    })
  }

  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        'taskRelation.role': 'parent',
        'taskRelation.rootId': rootId,
        'taskRelation.sourcePostId': job.source.postId,
        'taskRelation.childJobIds': childJobIds,
        'taskRelation.plan': {
          schema: 'wikimoe.ai.translation.source-post-import.child-plan',
          version: 1,
          childTaskCount: childJobIds.length,
          sourceCount: childPlan.length,
          maxDepth,
          generatedAt: new Date()
        }
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildExecutionLog(
              `已拆解 ${childJobIds.length} 个相关文章 AI 子任务`,
              'info',
              'AnalyzeRelatedPosts'
            )
          ],
          $slice: -20
        }
      }
    }
  )

  await context.saveCheckpoint({
    stage: 'AnalyzeRelatedPosts',
    stateSummary: {
      childTaskCount: childJobIds.length,
      sourceCount: childPlan.length,
      maxDepth
    }
  })

  return childTaskResults
}

function buildProperNounOrganizeChildTaskRequest(job, planItem) {
  const request = job.request || {}
  return {
    selectedEntryKeys: [],
    prompt: '',
    baseMode: '',
    targetLanguageCodes: planItem.languageCodes || [],
    recursion: {
      maxDepth: 1
    },
    entries: [],
    options: {
      ...(request.options || {}),
      syncRelatedPosts: false,
      organizeRelatedPosts: false
    }
  }
}

function buildProperNounOrganizeChildTaskRelation({ job, planItem, rootId }) {
  return {
    role: 'child',
    rootId,
    parentId: job._id,
    depth: planItem.minDepth,
    sourcePostId: toObjectId(planItem.sourceId),
    childJobIds: [],
    plannedRelatedSourceIdsByLanguage:
      planItem.plannedRelatedSourceIdsByLanguage || {},
    plan: {
      parentSourceIds: planItem.parentSourceIds || [],
      languageCodes: planItem.languageCodes || []
    }
  }
}

async function createSourcePostProperNounOrganizeChildJobs({
  job,
  languageCodes,
  maxDepth,
  context
}) {
  await context.updateProgress({
    currentStage: 'AnalyzeRelatedPosts',
    currentStep: '正在分析相关文章并拆解名词整理子任务',
    percent: 1
  })
  const childPlan = await buildSourcePostImportChildPlan({
    job,
    languageCodes,
    maxDepth,
    context
  })
  if (childPlan.length === 0) {
    await context.saveCheckpoint({
      stage: 'AnalyzeRelatedPosts',
      stateSummary: {
        childTaskCount: 0,
        message: '没有需要同步整理名词的相关文章'
      }
    })
    return []
  }

  const JobModel = getTranslationJobModel()
  const rootId = getJobTaskRelation(job).rootId || job._id
  const childJobIds = []
  const childTaskResults = []
  for (const planItem of childPlan) {
    const sourcePostId = toObjectId(planItem.sourceId)
    if (!sourcePostId) {
      continue
    }
    const existingChild = await JobModel.findOne({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE,
      'taskRelation.parentId': job._id,
      'source.postId': sourcePostId
    }).lean()
    if (existingChild) {
      childJobIds.push(existingChild._id)
      childTaskResults.push({
        sourceId: planItem.sourceId,
        title: planItem.title || '',
        depth: planItem.minDepth,
        languageCodes: planItem.languageCodes,
        childJobId: existingChild._id
      })
      continue
    }

    const title = planItem.title || `源文章 ${planItem.sourceId}`
    const childJob = await JobModel.create({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE,
      status: TRANSLATION_JOB_STATUS.PENDING,
      queueControl: {
        active: true,
        deferred: false,
        priority: job.queueControl?.priority || 0
      },
      source: {
        postId: sourcePostId,
        languageCode: job.source.languageCode,
        title,
        meta: {
          parentJobId: getJobId(job),
          rootJobId: String(rootId)
        }
      },
      target: {
        languageCodes: planItem.languageCodes,
        title
      },
      request: buildProperNounOrganizeChildTaskRequest(job, planItem),
      taskRelation: buildProperNounOrganizeChildTaskRelation({
        job,
        planItem,
        rootId
      }),
      progress: {
        currentStep: '等待后台 worker 领取相关文章名词整理子任务',
        currentStage: 'pending',
        totalSteps: 0,
        completedSteps: 0,
        percent: 0,
        recentLogs: [
          buildExecutionLog(
            `由父任务 ${getJobId(job)} 拆解创建`,
            'info',
            'createChildTask'
          )
        ]
      },
      createdBy: job.createdBy || null,
      updatedBy: job.updatedBy || job.createdBy || null
    })
    childJobIds.push(childJob._id)
    childTaskResults.push({
      sourceId: planItem.sourceId,
      title: planItem.title || '',
      depth: planItem.minDepth,
      languageCodes: planItem.languageCodes,
      childJobId: childJob._id
    })
  }

  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        // 名词整理协调任务是这个家族的顶层节点（自身整理根文章 + 拆解相关文章子任务），
        // 必须用 root 角色，才能在任务列表中保持可见并支持下钻；用 parent 会被顶层列表
        // 过滤掉（列表只展示 standalone/root/无 role），导致任务“消失”。相关文章子任务
        // 直接作为 root 的 child（二级家族，无 parent 层），由 recomputeFamilyAggregateStatus
        // 的无 parent 分支按 child 聚合 root 状态。
        'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.ROOT,
        'taskRelation.rootId': rootId,
        'taskRelation.sourcePostId': job.source.postId,
        'taskRelation.childJobIds': childJobIds,
        'taskRelation.plan': {
          schema: 'wikimoe.ai.proper_noun.organize.child-plan',
          version: 1,
          childTaskCount: childJobIds.length,
          sourceCount: childPlan.length,
          maxDepth,
          generatedAt: new Date()
        }
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildExecutionLog(
              `已拆解 ${childJobIds.length} 个相关文章名词整理子任务`,
              'info',
              'AnalyzeRelatedPosts'
            )
          ],
          $slice: -20
        }
      }
    }
  )

  await context.saveCheckpoint({
    stage: 'AnalyzeRelatedPosts',
    stateSummary: {
      childTaskCount: childJobIds.length,
      sourceCount: childPlan.length,
      maxDepth
    }
  })

  return childTaskResults
}

async function overwriteSourceSnapshotForAiImportJob(job, context) {
  if (job.source?.overwriteSnapshot !== true) {
    return
  }
  await context.updateProgress({
    currentStage: 'OverwriteSourceSnapshot',
    currentStep: '正在覆盖源文章快照',
    percent: 1
  })
  const importResult =
    await importPostSourceService.importOrOverwriteSourcePost(
      {
        sourceId: String(job.source.postId),
        sourceLanguageCode: job.source.languageCode,
        overwrite: true
      },
      false
    )
  const snapshotId = toObjectId(importResult.sourceSnapshotId)
  if (!snapshotId) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '覆盖源快照后缺少 sourceSnapshotId',
      'source.snapshotId',
      500,
      { retryable: false }
    )
  }
  const snapshotVersion = Number(importResult.snapshotVersion || 1)
  job.source.snapshotId = snapshotId
  job.source.snapshotVersion = snapshotVersion

  const JobModel = getTranslationJobModel()
  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        'source.snapshotId': snapshotId,
        'source.snapshotVersion': snapshotVersion
      }
    }
  )
  await context.saveCheckpoint({
    stage: 'OverwriteSourceSnapshot',
    stateSummary: {
      sourceSnapshotId: String(snapshotId),
      snapshotVersion
    }
  })
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

  await overwriteSourceSnapshotForAiImportJob(job, context)

  const maxDepth = Number(job.request?.recursion?.maxDepth || 3) || 3
  let childTaskResults = []
  if (shouldCreateRelatedChildJobs(job)) {
    childTaskResults = await createSourcePostImportChildJobs({
      job,
      languageCodes,
      maxDepth,
      context
    })
  }
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
        maxDepth: 1,
        coverImageTasks,
        enqueueRelatedPosts: false
      }))
    )
  }

  const coverImageRegistry =
    coverImageTranslationService.createCoverImageRegistry()
  if (coverImageTasks.length > 0) {
    const coverImageHandlers = createHandlers(context, 'TranslateCoverImage', {
      start: 88,
      end: 96
    })
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
        onStatus: coverImageHandlers.onStatus,
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
  const validationNodes = languageResults.filter(item =>
    Boolean(item.result.validation)
  )
  let aggregateValidation = null
  if (validationNodes.length > 0) {
    aggregateValidation = {
      enabled: true,
      status: 'completed',
      stats: {
        totalEntries: validationNodes.reduce(
          (sum, item) =>
            sum + (item.result.validation.stats?.totalEntries || 0),
          0
        ),
        changedEntries: validationNodes.reduce(
          (sum, item) =>
            sum + (item.result.validation.stats?.changedEntries || 0),
          0
        ),
        nodeCount: validationNodes.length
      },
      languageValidations: validationNodes.map(item => ({
        languageCode: item.languageCode,
        sourceId: item.sourceId,
        validation: item.result.validation
      })),
      completedAt: new Date().toISOString()
    }
  }
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
    childTaskResults,
    languageResults,
    translationPostMap: {},
    aiJsonLogs,
    validation: aggregateValidation,
    coverImageArtifacts: coverImageSnapshot.coverImageArtifacts,
    coverImageGenerationMap: coverImageSnapshot.coverImageGenerationMap,
    coverImageRecognitionMap: coverImageSnapshot.coverImageRecognitionMap,
    sourceSnapshotId: normalizeString(job.source?.snapshotId) || null,
    aiUsage: {
      languageResults: languageResults.map(item => ({
        languageCode: item.languageCode,
        usage: item.result.aiUsage || {}
      }))
    }
  }
}

function getProperNounOrganizeMaxDepth(job) {
  const maxDepth = Number(job.request?.recursion?.maxDepth || 3)
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    return 1
  }
  return maxDepth
}

function buildProperNounOrganizeEntries(sourcePost) {
  const sourceEntries =
    translationEntryBuildService.buildPostTranslationEntries({
      post: sourcePost
    })
  return sourceEntries.filter(shouldSubmitProperNounOrganizeEntry)
}

function mergeProperNounOrganizeStats(sourceResults) {
  const mergedStats = {
    sourceCount: sourceResults.length,
    relatedSourceCount: Math.max(sourceResults.length - 1, 0),
    relationCount: 0
  }
  sourceResults.forEach(sourceResult => {
    const stats = sourceResult.stats || {}
    Object.entries(stats).forEach(([key, value]) => {
      if (key === 'relationCount') {
        return
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        mergedStats[key] = Number(mergedStats[key] || 0) + value
        return
      }
      if (Array.isArray(value)) {
        let currentList = []
        if (Array.isArray(mergedStats[key])) {
          currentList = mergedStats[key]
        }
        value.forEach(item => {
          if (!currentList.includes(item)) {
            currentList.push(item)
          }
        })
        mergedStats[key] = currentList
        return
      }
      if (typeof mergedStats[key] === 'undefined') {
        mergedStats[key] = value
      }
    })
    mergedStats.relationCount += Number(sourceResult.relationCount || 0)
  })
  mergedStats.sourceCount = sourceResults.length
  mergedStats.relatedSourceCount = Math.max(sourceResults.length - 1, 0)
  return mergedStats
}

function buildProperNounOrganizePayload({
  sourceResults,
  sourceId,
  sourceLanguageCode,
  targetLanguageCodes,
  searchOfficialTermTranslations,
  organizeRelatedPosts,
  stats
}) {
  const matchedTermIds = []
  const extractedTerms = []
  const matchedTermLinks = []
  sourceResults.forEach(sourceResult => {
    ;(sourceResult.matchedTermIds || []).forEach(termId => {
      const termIdText = normalizeString(termId)
      if (termIdText && !matchedTermIds.includes(termIdText)) {
        matchedTermIds.push(termIdText)
      }
    })
    ;(sourceResult.extractedTerms || []).forEach(term => {
      extractedTerms.push({
        ...term,
        sourceId: sourceResult.sourceId
      })
    })
    ;(sourceResult.matchedTermLinks || []).forEach(link => {
      matchedTermLinks.push({
        ...link,
        sourceId: sourceResult.sourceId
      })
    })
  })

  return {
    schema: 'wikimoe.ai.proper_noun.organize',
    version: 1,
    sourceId,
    sourceLanguageCode,
    targetLanguageCodes,
    searchOfficialTermTranslations,
    organizeRelatedPosts,
    extractedTerms,
    matchedTermIds,
    matchedTermLinks,
    sourceResults: sourceResults.map(sourceResult => {
      return {
        sourceId: sourceResult.sourceId,
        title: sourceResult.title,
        isRoot: sourceResult.isRoot,
        depth: sourceResult.depth,
        relatedSourceIds: sourceResult.relatedSourceIds,
        entryCount: sourceResult.entryCount,
        extractedTermCount: sourceResult.extractedTerms.length,
        matchedTermCount: sourceResult.matchedTermIds.length,
        relationCount: sourceResult.relationCount,
        stats: sourceResult.stats
      }
    }),
    stats
  }
}

async function organizeOneSourcePostProperNouns({
  job,
  context,
  sourceId,
  languageCodes,
  isRoot,
  depth,
  allowEmptyEntries,
  officialTermGlossaryTaskCache
}) {
  await context.updateProgress({
    currentStage: 'BuildEntries',
    currentStep: '正在准备源文章名词整理内容',
    percent: 10
  })
  const previewContext =
    await translationPostService.getSourcePostAiImportPreviewContext({
      sourceId,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: languageCodes[0]
    })
  const sourcePost = previewContext.sourcePost
  const sourcePostStableId = getSourcePostId(sourcePost) || sourceId
  const title = getSourcePostDisplayTitle(sourcePost)
  const entries = buildProperNounOrganizeEntries(sourcePost)
  const relatedSourceIds = collectRelatedSourceIds(
    previewContext.sourcePost,
    previewContext.targetPost
  )
  if (entries.length === 0) {
    if (isRoot === true && allowEmptyEntries !== true) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '源文章没有可用于名词整理的正文条目',
        'request.entries',
        400,
        { retryable: false }
      )
    }
    return {
      sourceId: sourcePostStableId,
      title,
      isRoot: isRoot === true,
      depth,
      relatedSourceIds,
      entryCount: 0,
      extractedTerms: [],
      matchedTermIds: [],
      matchedTermLinks: [],
      relationCount: 0,
      stats: {}
    }
  }

  await context.saveCheckpoint({
    stage: 'BuildEntries',
    stateSummary: {
      sourceId: sourcePostStableId,
      title,
      entryCount: entries.length,
      targetLanguageCodes: languageCodes
    }
  })
  await context.updateProgress({
    currentStage: 'OrganizeProperNouns',
    currentStep: `正在调用 AI 整理文章专有名词：${title}`,
    percent: 20
  })

  const organizeResult =
    await translationWorkflowAiService.organizeProperNounTerms(
      {
        sourceId: sourcePostStableId,
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCodes: languageCodes,
        searchOfficialTermTranslations:
          shouldSearchOfficialTermTranslations(job),
        translationJobId: getJobId(job),
        cacheKey: getJobId(job),
        cacheScopeKey: `sourcePostProperNoun:${sourcePostStableId}`,
        officialTermGlossaryTaskCache,
        entries
      },
      createHandlers(context, 'OrganizeProperNouns', { start: 20, end: 85 })
    )

  let matchedTermIds = []
  if (Array.isArray(organizeResult.matchedTermIds)) {
    matchedTermIds = organizeResult.matchedTermIds
  }
  await context.updateProgress({
    currentStage: 'BindProperNouns',
    currentStep: `正在关联文章专有名词：${title}`,
    percent: 90
  })
  const bindResult =
    await sourcePostProperNounRelationService.bindOrganizedTermsToSourcePost({
      sourceId: sourcePostStableId,
      sourceLanguageCode: job.source.languageCode,
      sourcePost,
      extractedTerms: organizeResult.extractedTerms || [],
      matchedTermIds,
      matchedTermLinks: organizeResult.matchedTermLinks || [],
      relationSource: 'aiOrganize',
      lastOrganizedAt: new Date()
    })
  matchedTermIds = bindResult.matchedTermIds

  await context.saveCheckpoint({
    stage: 'BindProperNouns',
    stateSummary: {
      sourceId: sourcePostStableId,
      title,
      matchedTermCount: matchedTermIds.length,
      relationCount: bindResult.relationCount
    }
  })

  const stats = {
    ...(organizeResult.officialTermStats || {}),
    relationCount: bindResult.relationCount
  }
  return {
    sourceId: sourcePostStableId,
    title,
    isRoot: isRoot === true,
    depth,
    relatedSourceIds,
    entryCount: entries.length,
    extractedTerms: organizeResult.extractedTerms || [],
    matchedTermIds,
    matchedTermLinks: organizeResult.matchedTermLinks || [],
    relationCount: bindResult.relationCount,
    stats,
    aiJsonLogs: organizeResult.aiJsonLogs || []
  }
}

async function executeSourcePostProperNounOrganize(job, context) {
  let languageCodes = []
  if (Array.isArray(job.target.languageCodes)) {
    languageCodes = job.target.languageCodes
  }
  if (languageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '文章名词整理任务缺少 target.languageCodes',
      'target.languageCodes',
      400,
      { retryable: false }
    )
  }

  const sourcePostId = String(job.source.postId || '')
  if (!isValidObjectId(sourcePostId)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '文章名词整理任务缺少 source.postId',
      'source.postId',
      400,
      { retryable: false }
    )
  }

  const organizeRelatedPosts = shouldOrganizeRelatedPosts(job)
  const maxDepth = getProperNounOrganizeMaxDepth(job)
  const officialTermGlossaryTaskCache = new Map()
  const rootSourceResult = await organizeOneSourcePostProperNouns({
    job,
    context,
    sourceId: sourcePostId,
    languageCodes,
    isRoot: true,
    depth: 1,
    allowEmptyEntries: isTaskRelationChildJob(job),
    officialTermGlossaryTaskCache
  })
  const sourceResults = [rootSourceResult]
  let childTaskResults = []
  if (shouldCreateProperNounOrganizeChildJobs(job)) {
    childTaskResults = await createSourcePostProperNounOrganizeChildJobs({
      job,
      languageCodes,
      maxDepth,
      context
    })
  }

  const rootResult = sourceResults.find(item => item.isRoot === true)
  const rootSourceId = rootResult?.sourceId || sourcePostId
  const stats = mergeProperNounOrganizeStats(sourceResults)
  const payload = buildProperNounOrganizePayload({
    sourceResults,
    sourceId: rootSourceId,
    sourceLanguageCode: job.source.languageCode,
    targetLanguageCodes: languageCodes,
    searchOfficialTermTranslations: shouldSearchOfficialTermTranslations(job),
    organizeRelatedPosts,
    stats
  })

  return {
    payload,
    previewEntries: [],
    warningList: [],
    aiSkipList: [],
    relatedResults: sourceResults.map(sourceResult => {
      return {
        sourceId: sourceResult.sourceId,
        title: sourceResult.title,
        languageCode: job.source.languageCode,
        isRoot: sourceResult.isRoot,
        depth: sourceResult.depth,
        termCount: sourceResult.relationCount,
        extractedTermCount: sourceResult.extractedTerms.length,
        matchedTermCount: sourceResult.matchedTermIds.length
      }
    }),
    childTaskResults,
    languageResults: [],
    translationPostMap: {},
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(
      ...sourceResults.map(sourceResult => sourceResult.aiJsonLogs || [])
    ),
    coverImageArtifacts: [],
    coverImageGenerationMap: {},
    coverImageRecognitionMap: {},
    sourceSnapshotId: null,
    aiUsage: {
      officialTermStats: stats
    },
    model: ''
  }
}

// ===========================================================================
// 家族（root/parent/child）编排执行
// ---------------------------------------------------------------------------
// 把"一次性翻译全部语言"的大任务拆成按顺序执行的子任务，规避 MongoDB 单文档 16MB
// 限制。家族结构（方案A，三层）：
//   root（编排器，本函数规划阶段执行）
//     └─ parent（每篇文章一个：根文章 + 每个相关文章）
//          ├─ child[0]  名词整理（该文章全部语言一次性，执行即生效）
//          ├─ child[1..N] 单语言翻译校验（每种目标语言一个）
//          └─ child[N+1] 封面图整理（最后一步，跨该文章各语言按标题去重）
// 子执行器均复用现有的逐语言 / 单源 / 封面批处理函数，且都设计成"既可独立运行、
// 也可被父任务编排调用"。
// ===========================================================================

const FAMILY_ORCHESTRATOR_PLANNING_MARKER = '__orchestratorPlanning'

function getFamilyArticleSourceId(job) {
  const relation = getJobTaskRelation(job)
  return (
    normalizeString(relation.articleSourceId) ||
    normalizeString(job.source.postId)
  )
}

function getFamilyLanguageCodes(job) {
  if (
    Array.isArray(job.target?.languageCodes) &&
    job.target.languageCodes.length
  ) {
    return job.target.languageCodes
  }
  if (Array.isArray(job.request?.targetLanguageCodes)) {
    return job.request.targetLanguageCodes
  }
  return []
}

// 读取创建任务时勾选的"保存后发布"语言集合（request.options.publishLanguageCodes）。
function getFamilyPublishLanguageCodeSet(job) {
  const publishLanguageCodes = job?.request?.options?.publishLanguageCodes
  if (!Array.isArray(publishLanguageCodes)) {
    return new Set()
  }
  return new Set(
    publishLanguageCodes
      .map(languageCode => normalizeString(languageCode))
      .filter(languageCode => languageCode.length > 0)
  )
}

// 是否需要为该家族创建名词整理子任务（默认创建；可由 options.organizeProperNouns=false 关闭）。
function shouldCreateProperNounChild(job) {
  const options = job?.request?.options || {}
  if (options.organizeProperNouns === false) {
    return false
  }
  return true
}

// 该文章是否启用名词整理（综合全局 autoOrganizeOfficialTermGlossary 与逐文章特性范围）。
// 根文章始终只看全局开关；相关文章额外受 relatedSourceFeatureScopes 过滤（与旧逻辑一致）。
function isProperNounOrganizeEnabledForArticle(
  job,
  articleSourceId,
  isRootArticle
) {
  if (!shouldCreateProperNounChild(job)) {
    return false
  }
  const options = job?.request?.options || {}
  const globalAutoOrganize = options.autoOrganizeOfficialTermGlossary !== false
  if (!globalAutoOrganize) {
    return false
  }
  if (isRootArticle === true) {
    return true
  }
  const scopes = getRelatedSourceFeatureScopes(job)
  return isRelatedSourceFeatureSelected(
    scopes,
    'autoOrganizeOfficialTermGlossary',
    normalizeString(articleSourceId)
  )
}

// 该文章是否启用官方译名联网搜索（综合全局开关、名词整理开关与逐文章特性范围）。
function isSearchOfficialTermEnabledForArticle(
  job,
  articleSourceId,
  isRootArticle
) {
  if (
    !isProperNounOrganizeEnabledForArticle(job, articleSourceId, isRootArticle)
  ) {
    return false
  }
  const options = job?.request?.options || {}
  if (options.searchOfficialTermTranslations !== true) {
    return false
  }
  if (isRootArticle === true) {
    return true
  }
  const scopes = getRelatedSourceFeatureScopes(job)
  return isRelatedSourceFeatureSelected(
    scopes,
    'searchOfficialTermTranslations',
    normalizeString(articleSourceId)
  )
}

// 该文章是否启用封面图翻译（综合全局封面图模式与逐文章特性范围）。
function isCoverImageEnabledForArticle(job, articleSourceId, isRootArticle) {
  if (!shouldTranslateCoverImage(job, true)) {
    return false
  }
  if (isRootArticle === true) {
    return true
  }
  const scopes = getRelatedSourceFeatureScopes(job)
  return isRelatedSourceFeatureSelected(
    scopes,
    'coverImageTranslation',
    normalizeString(articleSourceId)
  )
}

// 构建某篇文章的子任务请求体（关闭翻译流内联名词整理，名词整理改由独立子任务负责）。
function buildFamilyChildRequest(
  job,
  { languageCodes, disableInlineProperNoun }
) {
  const request = job.request || {}
  const options = {
    ...(request.options || {})
  }
  if (disableInlineProperNoun === true) {
    // 名词整理已由独立子任务完成并入库，逐语言翻译不再内联整理，仅复用已绑定术语。
    options.autoOrganizeOfficialTermGlossary = false
    options.searchOfficialTermTranslations = false
  }
  return {
    selectedEntryKeys: Array.isArray(request.selectedEntryKeys)
      ? request.selectedEntryKeys
      : [],
    prompt: request.prompt || '',
    baseMode: request.baseMode || '',
    targetLanguageCodes: languageCodes,
    recursion: { maxDepth: 1 },
    entries: [],
    options
  }
}

// 创建一篇文章对应的 parent 及其有序 child 子任务序列。
async function createFamilyParentWithChildren({
  job,
  rootId,
  articleSourceId,
  articleTitle,
  isRootArticle,
  parentOrderIndex,
  languageCodes,
  snapshotId
}) {
  const JobModel = getTranslationJobModel()
  const sourcePostObjectId = toObjectId(articleSourceId)
  const snapshotObjectId = snapshotId ? toObjectId(snapshotId) : null
  const priority = job.queueControl?.priority || 0
  const title = articleTitle || `源文章 ${articleSourceId}`

  // 1) 创建 parent（编排型，不执行 AI，永不进入 RUNNING）。
  const parentJob = await JobModel.create({
    jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT,
    status: TRANSLATION_JOB_STATUS.PENDING,
    queueControl: { active: false, deferred: false, priority },
    source: {
      postId: sourcePostObjectId,
      languageCode: job.source.languageCode,
      snapshotId: isRootArticle ? snapshotObjectId : null,
      overwriteSnapshot: false,
      title
    },
    target: { languageCodes, title },
    request: buildFamilyChildRequest(job, {
      languageCodes,
      disableInlineProperNoun: false
    }),
    taskRelation: {
      role: TRANSLATION_JOB_TASK_ROLES.PARENT,
      childKind: '',
      orderIndex: parentOrderIndex,
      rootId: toObjectId(rootId),
      parentId: toObjectId(rootId),
      depth: 2,
      sourcePostId: sourcePostObjectId,
      articleSourceId: sourcePostObjectId,
      childJobIds: [],
      childStats: {}
    },
    progress: {
      currentStep: '等待子任务按顺序执行',
      currentStage: 'Orchestrating',
      totalSteps: 0,
      completedSteps: 0,
      percent: 0,
      recentLogs: [
        buildExecutionLog(
          `文章「${title}」的翻译父任务已创建`,
          'info',
          'family'
        )
      ]
    },
    createdBy: job.createdBy || null,
    updatedBy: job.updatedBy || job.createdBy || null
  })

  const childJobIds = []
  let childOrderIndex = 0
  // 逐文章特性开关：根据 relatedSourceFeatureScopes 决定该文章是否做名词整理 / 封面图。
  const properNounEnabled = isProperNounOrganizeEnabledForArticle(
    job,
    articleSourceId,
    isRootArticle
  )
  const searchOfficialTermEnabled = isSearchOfficialTermEnabledForArticle(
    job,
    articleSourceId,
    isRootArticle
  )
  const coverImageEnabled = isCoverImageEnabledForArticle(
    job,
    articleSourceId,
    isRootArticle
  )

  function buildChildSourceBlock() {
    return {
      postId: sourcePostObjectId,
      languageCode: job.source.languageCode,
      snapshotId: isRootArticle ? snapshotObjectId : null,
      overwriteSnapshot: false,
      title
    }
  }

  function buildChildBaseTaskRelation(
    childKind,
    orderIndex,
    childLanguageCode
  ) {
    return {
      role: TRANSLATION_JOB_TASK_ROLES.CHILD,
      childKind,
      orderIndex,
      rootId: toObjectId(rootId),
      parentId: parentJob._id,
      depth: 3,
      sourcePostId: sourcePostObjectId,
      articleSourceId: sourcePostObjectId,
      childLanguageCode: childLanguageCode || '',
      childJobIds: [],
      childStats: {}
    }
  }

  async function createChild({
    jobType,
    childKind,
    childLanguageCode,
    request,
    label
  }) {
    const childJob = await JobModel.create({
      jobType,
      status: TRANSLATION_JOB_STATUS.PENDING,
      queueControl: { active: false, deferred: false, priority },
      source: buildChildSourceBlock(),
      target: {
        languageCode: childLanguageCode || '',
        // 单语言翻译子任务只负责一种语言，target.languageCodes 仅含该语言，避免工作流视图
        // 误把整个家族的语言都渲染成该子任务的步骤；名词整理 / 封面图整理子任务需要覆盖全部
        // 语言，保留完整家族语言列表。
        languageCodes: childLanguageCode ? [childLanguageCode] : languageCodes,
        title
      },
      request,
      taskRelation: buildChildBaseTaskRelation(
        childKind,
        childOrderIndex,
        childLanguageCode
      ),
      progress: {
        currentStep: '排队中，等待前序子任务完成',
        currentStage: 'pending',
        totalSteps: 0,
        completedSteps: 0,
        percent: 0,
        recentLogs: [buildExecutionLog(label, 'info', 'family')]
      },
      createdBy: job.createdBy || null,
      updatedBy: job.updatedBy || job.createdBy || null
    })
    childOrderIndex += 1
    childJobIds.push(childJob._id)
    return childJob
  }

  // 2) 名词整理子任务（全语言一次性，执行即生效）。仅当该文章启用名词整理时创建。
  if (properNounEnabled) {
    await createChild({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE,
      childKind: TRANSLATION_JOB_CHILD_KINDS.PROPER_NOUN_ORGANIZE,
      childLanguageCode: '',
      request: {
        selectedEntryKeys: [],
        prompt: '',
        baseMode: '',
        targetLanguageCodes: languageCodes,
        recursion: { maxDepth: 1 },
        entries: [],
        options: {
          ...(job.request?.options || {}),
          autoOrganizeOfficialTermGlossary: true,
          searchOfficialTermTranslations: searchOfficialTermEnabled,
          syncRelatedPosts: false,
          organizeRelatedPosts: false
        }
      },
      label: `名词整理子任务（${languageCodes.length} 种语言）已创建`
    })
  }

  // 3) 逐语言翻译校验子任务（关闭内联名词整理、关闭封面图）。
  const publishLanguageCodeSet = getFamilyPublishLanguageCodeSet(job)
  for (let i = 0; i < languageCodes.length; i += 1) {
    const languageCode = languageCodes[i]
    const request = buildFamilyChildRequest(job, {
      languageCodes,
      disableInlineProperNoun: properNounEnabled
    })
    // 单语言子任务只负责一种语言：request 的目标语言也只含该语言。
    request.targetLanguageCodes = [languageCode]
    // 逐语言子任务不处理封面图，封面图统一放最后的封面图整理子任务。
    request.options = {
      ...request.options,
      coverImageTranslationMode: 'never',
      translateCoverImage: false,
      // 创建任务时勾选了"保存后发布"的语言，采纳时该语言译文自动发布。
      publishOnApply: publishLanguageCodeSet.has(languageCode)
    }
    await createChild({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT,
      childKind: TRANSLATION_JOB_CHILD_KINDS.SINGLE_LANGUAGE_TRANSLATION,
      childLanguageCode: languageCode,
      request,
      label: `${getLanguageText(languageCode)} 翻译子任务已创建`
    })
  }

  // 4) 封面图整理子任务（最后一步，跨该文章各语言按标题去重）。仅当该文章启用封面图时创建。
  if (coverImageEnabled) {
    await createChild({
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT,
      childKind: TRANSLATION_JOB_CHILD_KINDS.COVER_IMAGE_ORGANIZE,
      childLanguageCode: '',
      request: buildFamilyChildRequest(job, {
        languageCodes,
        disableInlineProperNoun: false
      }),
      label: '封面图整理子任务已创建'
    })
  }

  await JobModel.updateOne(
    { _id: parentJob._id },
    { $set: { 'taskRelation.childJobIds': childJobIds } }
  )

  return {
    parentId: parentJob._id,
    childJobIds,
    childCount: childJobIds.length,
    articleSourceId,
    title,
    languageCodes
  }
}

// root 规划阶段：发现文章 → 创建 parent/child 家族 → 返回编排标记（由 worker 转编排态）。
async function executeFamilyRootPlanning(job, context) {
  const languageCodes = getFamilyLanguageCodes(job)
  if (languageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '家族翻译任务缺少 target.languageCodes',
      'target.languageCodes',
      400,
      { retryable: false }
    )
  }
  const rootSourceId = normalizeString(job.source.postId)
  if (!isValidObjectId(rootSourceId)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '家族翻译任务缺少 source.postId',
      'source.postId',
      400,
      { retryable: false }
    )
  }

  await context.updateProgress({
    currentStage: 'PlanFamily',
    currentStep: '正在覆盖源文章快照并规划子任务',
    percent: 0
  })
  // 覆盖根文章源快照（与原一次性导入一致）。
  await overwriteSourceSnapshotForAiImportJob(job, context)
  const rootSnapshotId = normalizeString(job.source.snapshotId)

  // 发现根文章 + 相关文章（复用现有 DAG 规划）。
  const maxDepth = Number(job.request?.recursion?.maxDepth || 3) || 3
  const rootPreviewContext =
    await translationPostService.getSourcePostAiImportPreviewContext({
      sourceId: rootSourceId,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: languageCodes[0],
      sourceSnapshotId: rootSnapshotId
    })
  const articles = [
    {
      sourceId: getSourcePostId(rootPreviewContext.sourcePost) || rootSourceId,
      title: getSourcePostDisplayTitle(rootPreviewContext.sourcePost),
      isRootArticle: true,
      languageCodes
    }
  ]
  if (shouldSyncRelatedPosts(job) && maxDepth > 1) {
    await context.updateProgress({
      currentStage: 'PlanFamily',
      currentStep: '正在分析相关文章',
      percent: 0
    })
    const relatedPlan = await buildSourcePostImportChildPlan({
      job,
      languageCodes,
      maxDepth,
      context
    })
    relatedPlan.forEach(planItem => {
      articles.push({
        sourceId: planItem.sourceId,
        title: planItem.title || '',
        isRootArticle: false,
        languageCodes:
          Array.isArray(planItem.languageCodes) && planItem.languageCodes.length
            ? planItem.languageCodes
            : languageCodes
      })
    })
  }

  await context.updateProgress({
    currentStage: 'PlanFamily',
    currentStep: `正在创建 ${articles.length} 篇文章的子任务家族`,
    percent: 0
  })

  const JobModel = getTranslationJobModel()
  const parentResults = []
  let totalChildCount = 0
  for (let i = 0; i < articles.length; i += 1) {
    const article = articles[i]
    const parentResult = await createFamilyParentWithChildren({
      job,
      rootId: job._id,
      articleSourceId: article.sourceId,
      articleTitle: article.title,
      isRootArticle: article.isRootArticle,
      parentOrderIndex: i,
      languageCodes: article.languageCodes,
      snapshotId: article.isRootArticle ? rootSnapshotId : ''
    })
    parentResults.push(parentResult)
    totalChildCount += parentResult.childCount
  }

  const parentJobIds = parentResults.map(item => item.parentId)
  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.ROOT,
        'taskRelation.rootId': job._id,
        'taskRelation.articleSourceId': toObjectId(rootSourceId),
        'taskRelation.sourcePostId': toObjectId(rootSourceId),
        'taskRelation.childJobIds': parentJobIds,
        'taskRelation.plan': {
          schema: 'wikimoe.ai.translation.family.plan',
          version: 1,
          articleCount: articles.length,
          parentCount: parentJobIds.length,
          childCount: totalChildCount,
          languageCount: languageCodes.length,
          maxDepth,
          generatedAt: new Date()
        }
      }
    }
  )

  await context.saveCheckpoint({
    stage: 'PlanFamily',
    stateSummary: {
      articleCount: articles.length,
      parentCount: parentJobIds.length,
      childCount: totalChildCount,
      languageCount: languageCodes.length
    }
  })

  return {
    [FAMILY_ORCHESTRATOR_PLANNING_MARKER]: true,
    childStats: {
      articleCount: articles.length,
      parentCount: parentJobIds.length,
      childCount: totalChildCount,
      languageCount: languageCodes.length
    }
  }
}

// 名词整理子任务执行器：针对该文章全部目标语言一次性整理并绑定术语（执行即生效）。
async function executeProperNounOrganizeChild(job, context) {
  const languageCodes = getFamilyLanguageCodes(job)
  if (languageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '名词整理子任务缺少 target.languageCodes',
      'target.languageCodes',
      400,
      { retryable: false }
    )
  }
  const articleSourceId = getFamilyArticleSourceId(job)
  const officialTermGlossaryTaskCache = new Map()
  const rootSourceResult = await organizeOneSourcePostProperNouns({
    job,
    context,
    sourceId: articleSourceId,
    languageCodes,
    isRoot: true,
    depth: 1,
    allowEmptyEntries: true,
    officialTermGlossaryTaskCache
  })
  const sourceResults = [rootSourceResult]
  const stats = mergeProperNounOrganizeStats(sourceResults)
  const payload = buildProperNounOrganizePayload({
    sourceResults,
    sourceId: rootSourceResult.sourceId,
    sourceLanguageCode: job.source.languageCode,
    targetLanguageCodes: languageCodes,
    searchOfficialTermTranslations: shouldSearchOfficialTermTranslations(job),
    organizeRelatedPosts: false,
    stats
  })
  return {
    payload,
    previewEntries: [],
    warningList: [],
    aiSkipList: [],
    relatedResults: [
      {
        sourceId: rootSourceResult.sourceId,
        title: rootSourceResult.title,
        languageCode: job.source.languageCode,
        isRoot: true,
        depth: 1,
        termCount: rootSourceResult.relationCount,
        extractedTermCount: rootSourceResult.extractedTerms.length,
        matchedTermCount: rootSourceResult.matchedTermIds.length
      }
    ],
    childTaskResults: [],
    languageResults: [],
    translationPostMap: {},
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(
      rootSourceResult.aiJsonLogs || []
    ),
    coverImageArtifacts: [],
    coverImageGenerationMap: {},
    coverImageRecognitionMap: {},
    sourceSnapshotId: normalizeString(job.source?.snapshotId) || null,
    aiUsage: { officialTermStats: stats },
    model: ''
  }
}

// 单语言翻译校验子任务执行器：翻译该文章的一种目标语言（不处理封面图）。
async function executeSingleLanguageTranslationChild(job, context) {
  const languageCode = normalizeString(
    getJobTaskRelation(job).childLanguageCode || job.target.languageCode
  )
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '单语言翻译子任务缺少目标语言',
      'taskRelation.childLanguageCode',
      400,
      { retryable: false }
    )
  }
  const familyLanguageCodes = getFamilyLanguageCodes(job)
  const targetLanguageCodes = familyLanguageCodes.length
    ? familyLanguageCodes
    : [languageCode]
  const officialTermGlossaryTaskCache = new Map()
  const languageResults = await executeSourcePostLanguageDag({
    job,
    context,
    languageCode,
    targetLanguageCodes,
    officialTermGlossaryTaskCache,
    progressRange: { start: 10, end: 96 },
    maxDepth: 1,
    coverImageTasks: [],
    enqueueRelatedPosts: false
  })
  const primary =
    languageResults.find(item => item.isRoot) || languageResults[0]
  if (!primary) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      '单语言翻译子任务没有产出结果',
      'result',
      502
    )
  }
  const innerResult = primary.result || {}
  const previewEntries = languageResults.flatMap(item => {
    return item.result?.previewEntries || []
  })
  const warningList = languageResults.flatMap(item => {
    return item.result?.warningList || []
  })
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    ...languageResults.map(item => item.result?.aiJsonLogs || [])
  )
  let validation = null
  if (innerResult.validation) {
    validation = {
      enabled: true,
      status: 'completed',
      stats: {
        totalEntries: innerResult.validation.stats?.totalEntries || 0,
        changedEntries: innerResult.validation.stats?.changedEntries || 0,
        nodeCount: 1
      },
      languageValidations: [
        {
          languageCode,
          sourceId: primary.sourceId,
          validation: innerResult.validation
        }
      ],
      completedAt: new Date().toISOString()
    }
  }
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
      languageCode,
      isRoot: item.isRoot,
      sourceId: item.sourceId,
      depth: item.depth,
      entryCount: (item.result?.previewEntries || []).length,
      requestId: item.result?.requestId,
      model: item.result?.model
    })),
    childTaskResults: [],
    // 单语言子任务的采纳依赖 result.languageResults[].result.payload，必须保留（单语言数据量小，无 16MB 风险）。
    languageResults,
    translationPostMap: {},
    aiJsonLogs,
    validation,
    coverImageArtifacts: [],
    coverImageGenerationMap: {},
    coverImageRecognitionMap: {},
    sourceSnapshotId: normalizeString(job.source?.snapshotId) || null,
    aiUsage: {
      languageResults: languageResults.map(item => ({
        languageCode,
        usage: item.result?.aiUsage || {}
      }))
    },
    model: innerResult.model || ''
  }
}

// 封面图整理子任务执行器：读取同父任务下各单语言翻译子任务译文，跨语言按标题去重统一处理封面图。
async function executeCoverImageOrganizeChild(job, context) {
  const parentId = getJobTaskRelation(job).parentId
  if (!parentId) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '封面图整理子任务缺少 parentId',
      'taskRelation.parentId',
      400,
      { retryable: false }
    )
  }
  const articleSourceId = getFamilyArticleSourceId(job)
  const sourceSnapshotId = normalizeString(job.source?.snapshotId)
  const JobModel = getTranslationJobModel()
  const siblingChildren = await JobModel.find({
    'taskRelation.parentId': toObjectId(parentId),
    'taskRelation.childKind':
      TRANSLATION_JOB_CHILD_KINDS.SINGLE_LANGUAGE_TRANSLATION
  })
    .sort({ 'taskRelation.orderIndex': 1 })
    .lean()

  const coverImageTasks = []
  for (const sibling of siblingChildren) {
    const languageCode = normalizeString(
      sibling.taskRelation?.childLanguageCode
    )
    if (!languageCode) {
      continue
    }
    const previewEntries = Array.isArray(sibling.result?.previewEntries)
      ? sibling.result.previewEntries
      : []
    await context.updateProgress({
      currentStage: 'TranslateCoverImage',
      currentStep: `正在准备 ${getLanguageText(languageCode)} 封面图上下文`,
      percent: 10
    })
    const previewContext =
      await translationPostService.getSourcePostAiImportPreviewContext({
        sourceId: articleSourceId,
        sourceLanguageCode: job.source.languageCode,
        targetLanguageCode: languageCode,
        sourceSnapshotId
      })
    coverImageTasks.push({
      job,
      sourcePost: previewContext.sourcePost,
      targetPost: previewContext.targetPost,
      previewEntries,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: languageCode,
      skipRecognition: shouldSkipCoverImageRecognition(job),
      result: {
        previewEntries: [],
        warningList: [],
        coverImageArtifacts: [],
        coverImageGenerationMap: {},
        coverImageRecognitionMap: {},
        aiJsonLogs: [],
        requestId: null
      }
    })
  }

  const registry = coverImageTranslationService.createCoverImageRegistry()
  const aggregatedPreviewEntries = []
  const aggregatedWarnings = []
  if (coverImageTasks.length > 0) {
    const coverImageHandlers = createHandlers(context, 'TranslateCoverImage', {
      start: 20,
      end: 95
    })
    await context.updateProgress({
      currentStage: 'TranslateCoverImage',
      currentStep: '正在按标题去重处理各语言封面图 AI 翻译',
      percent: 20
    })
    const coverBatchResult =
      await coverImageTranslationService.processCoverImageTranslationBatch({
        registry,
        tasks: coverImageTasks,
        cancellation: context.cancellation,
        onStatus: coverImageHandlers.onStatus,
        onTaskStart: async ({ task, taskIndex, taskCount }) => {
          await context.updateProgress({
            currentStage: 'TranslateCoverImage',
            currentStep: `正在处理 ${getLanguageText(
              task.targetLanguageCode
            )} 封面图 AI 翻译（${taskIndex + 1}/${taskCount}）`,
            percent: getRangePercent(
              { start: 20, end: 95 },
              0,
              1,
              taskIndex / Math.max(taskCount, 1)
            )
          })
        }
      })
    coverBatchResult.results.forEach(item => {
      appendCoverImageResult(item.task.result, item.coverResult, registry, {
        appendAiJsonLogs: false
      })
      ;(item.task.result.previewEntries || []).forEach(entry => {
        aggregatedPreviewEntries.push(entry)
      })
      ;(item.task.result.warningList || []).forEach(warning => {
        aggregatedWarnings.push(warning)
      })
    })
    await context.saveCheckpoint({
      stage: 'TranslateCoverImage',
      stateSummary: {
        taskCount: coverBatchResult.taskCount,
        dedupeGroupCount: coverBatchResult.groupCount,
        duplicateTitleCount: coverBatchResult.duplicateTitleCount,
        artifactCount: registry.artifacts.size
      }
    })
  }

  const snapshot = coverImageTranslationService.buildRegistrySnapshot(registry)
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    translationAiJsonLogService.buildCoverImageAiJsonLogs({
      snapshot,
      sourceLanguageCode: job.source.languageCode,
      targetLanguageCode: '',
      meta: { jobId: getJobId(job), recursive: false }
    })
  )
  return {
    payload: {
      schema: 'wikimoe.ai.translation.cover-image',
      version: 1,
      entries: aggregatedPreviewEntries
    },
    previewEntries: aggregatedPreviewEntries,
    warningList: aggregatedWarnings,
    aiSkipList: [],
    relatedResults: [],
    childTaskResults: [],
    languageResults: [],
    translationPostMap: {},
    aiJsonLogs,
    coverImageArtifacts: snapshot.coverImageArtifacts,
    coverImageGenerationMap: snapshot.coverImageGenerationMap,
    coverImageRecognitionMap: snapshot.coverImageRecognitionMap,
    sourceSnapshotId: sourceSnapshotId || null,
    aiUsage: {},
    model: ''
  }
}

// 子任务分发：按 childKind 调用对应执行器。
async function executeFamilyChild(job, context) {
  const childKind = getJobTaskRelation(job).childKind
  if (childKind === TRANSLATION_JOB_CHILD_KINDS.PROPER_NOUN_ORGANIZE) {
    return await executeProperNounOrganizeChild(job, context)
  }
  if (childKind === TRANSLATION_JOB_CHILD_KINDS.SINGLE_LANGUAGE_TRANSLATION) {
    return await executeSingleLanguageTranslationChild(job, context)
  }
  if (childKind === TRANSLATION_JOB_CHILD_KINDS.COVER_IMAGE_ORGANIZE) {
    return await executeCoverImageOrganizeChild(job, context)
  }
  // 批量"翻译已存在文章"的单语言子任务：复用已有文章翻译执行器（针对已存在的目标语言文章）。
  if (childKind === TRANSLATION_JOB_CHILD_KINDS.POST_LANGUAGE_TRANSLATION) {
    return await executePostAiTranslation(job, context)
  }
  throw new ApiError(
    ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
    `子任务种类不支持：${childKind}`,
    'taskRelation.childKind',
    400,
    { retryable: false }
  )
}

function isFamilyOrchestratorPlanningResult(result) {
  return Boolean(result && result[FAMILY_ORCHESTRATOR_PLANNING_MARKER] === true)
}

// 服务端一次性遍历源文章的关联文章图，返回"相关文章特性范围"选项树。供创建"生成并 AI 翻译"
// 任务的弹窗使用，替代浏览器逐文章逐语言调用预览上下文接口的 N+1 加载方式。
async function buildSourcePostRelatedScopeOptions({
  sourceId,
  sourceLanguageCode,
  targetLanguageCodes,
  maxDepth
}) {
  const rootSourceId = normalizeString(sourceId)
  if (!isValidObjectId(rootSourceId)) {
    return []
  }
  const languageCodes = Array.isArray(targetLanguageCodes)
    ? targetLanguageCodes.map(item => normalizeString(item)).filter(Boolean)
    : []
  if (languageCodes.length === 0) {
    return []
  }
  let depthLimit = Number(maxDepth || 3)
  if (!Number.isInteger(depthLimit) || depthLimit < 1) {
    depthLimit = 3
  }

  const optionMap = new Map()
  for (const languageCode of languageCodes) {
    const queue = [{ sourceId: rootSourceId, parentSourceId: '', depth: 1 }]
    const visited = new Set()
    while (queue.length > 0) {
      const task = queue.shift()
      const currentId = normalizeString(task.sourceId)
      if (!currentId || visited.has(currentId)) {
        continue
      }
      visited.add(currentId)
      let previewContext
      try {
        previewContext =
          await translationPostService.getSourcePostAiImportPreviewContext({
            sourceId: currentId,
            sourceLanguageCode,
            targetLanguageCode: languageCode
          })
      } catch (error) {
        continue
      }
      const sourcePost = previewContext.sourcePost
      const normalizedId = getSourcePostId(sourcePost) || currentId
      if (normalizedId !== rootSourceId) {
        const relatedDepth = Math.max(Number(task.depth || 1) - 1, 1)
        const existing = optionMap.get(normalizedId)
        if (existing) {
          if (relatedDepth < existing.relatedDepth) {
            existing.relatedDepth = relatedDepth
            existing.depth = task.depth
          }
          if (
            task.parentSourceId &&
            !existing.parentSourceIds.includes(task.parentSourceId)
          ) {
            existing.parentSourceIds.push(task.parentSourceId)
          }
        } else {
          optionMap.set(normalizedId, {
            sourceId: normalizedId,
            title: getSourcePostDisplayTitle(sourcePost) || normalizedId,
            type: Number(sourcePost?.type || 0),
            depth: task.depth,
            relatedDepth,
            parentSourceIds: task.parentSourceId ? [task.parentSourceId] : []
          })
        }
      }
      if (task.depth >= depthLimit) {
        continue
      }
      const relatedIds = collectRelatedSourceIds(
        previewContext.sourcePost,
        previewContext.targetPost
      )
      relatedIds.forEach(relatedSourceId => {
        const relatedId = normalizeString(relatedSourceId)
        if (!relatedId || relatedId === rootSourceId) {
          return
        }
        if (!visited.has(relatedId)) {
          queue.push({
            sourceId: relatedId,
            parentSourceId: normalizedId,
            depth: task.depth + 1
          })
        }
      })
    }
  }

  return Array.from(optionMap.values()).sort((leftItem, rightItem) => {
    if (leftItem.relatedDepth !== rightItem.relatedDepth) {
      return leftItem.relatedDepth - rightItem.relatedDepth
    }
    return String(leftItem.title).localeCompare(String(rightItem.title))
  })
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

  // 家族编排：root 走规划阶段；带 childKind 的家族 child 按 childKind 分发；
  // 其余（独立任务、以及旧的相关文章 child——无 childKind）走原有 jobType 分发。
  const relation = getJobTaskRelation(job)
  if (relation.role === TRANSLATION_JOB_TASK_ROLES.ROOT) {
    return await executeFamilyRootPlanning(job, context)
  }
  if (
    relation.role === TRANSLATION_JOB_TASK_ROLES.CHILD &&
    normalizeString(relation.childKind)
  ) {
    return await executeFamilyChild(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    return await executePostAiTranslation(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
    return await executeContentAiTranslation(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    return await executeSourcePostAiImport(job, context)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE) {
    return await executeSourcePostProperNounOrganize(job, context)
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
  executeTranslationJob,
  isFamilyOrchestratorPlanningResult,
  buildSourcePostRelatedScopeOptions
}
