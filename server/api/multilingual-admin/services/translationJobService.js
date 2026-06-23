const mongoose = require('mongoose')
const aiLogFileService = require('./aiLogFileService')
const coverImageTempFileService = require('./coverImageTempFileService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
const translationAiWorkflowViewService = require('./translationAiWorkflowViewService')
const {
  normalizeLanguageCode,
  SUPPORTED_LANGUAGE_CODES
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_TYPES,
  TRANSLATION_JOB_TYPE_VALUES,
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_STATUS_VALUES,
  TRANSLATION_JOB_FINAL_STATUS_VALUES,
  TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES,
  TRANSLATION_JOB_TASK_ROLES,
  TRANSLATION_JOB_TASK_ROLE_VALUES,
  TRANSLATION_JOB_ORCHESTRATOR_ROLE_VALUES,
  TRANSLATION_JOB_CHILD_KINDS,
  TRANSLATION_JOB_CHILD_KIND_VALUES,
  TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS
} = require('../../../utils/translationJobConstants')

const MAX_LIST_LIMIT = 100
const DEFAULT_LIST_LIMIT = 20
const MAX_RECENT_LOGS = 20
const MAX_BATCH_DELETE_COUNT = 100
const AI_CHUNK_CACHE_SCHEMA = 'wikimoe.translation.ai.chunk.cache'
const AI_CHUNK_CACHE_VERSION = 1

function buildRecentLog(message, level = 'info', stage = '') {
  return {
    message,
    level,
    stage,
    createdAt: new Date()
  }
}

function getTranslationJobModel() {
  const repository =
    global.$mongodDB &&
    global.$mongodDB.multilingual &&
    global.$mongodDB.multilingual.repositories &&
    global.$mongodDB.multilingual.repositories.translationJobs

  if (!repository || !repository.model) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'translationJobs model is not ready',
      'translationJobs',
      503
    )
  }

  return repository.model
}

function getNativeDb(model) {
  const nativeDb = model && model.db && model.db.db
  if (!nativeDb || typeof nativeDb.command !== 'function') {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'MongoDB native db is not ready',
      'translationJobs',
      503
    )
  }

  return nativeDb
}

function getFiniteNumber(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return numberValue
}

function getCollectionName(model) {
  return model.collection && model.collection.collectionName
}

async function getCollectionStats(model) {
  const collectionName = getCollectionName(model)
  if (!collectionName) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'translationJobs collection is not ready',
      'translationJobs',
      503
    )
  }

  const nativeDb = getNativeDb(model)
  return await nativeDb.command({ collStats: collectionName })
}

function toTrimmedString(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function toObjectId(value, field, required = false) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }

  if (value && typeof value.toHexString === 'function') {
    return new mongoose.Types.ObjectId(value.toHexString())
  }

  const idText = toTrimmedString(value)
  if (!idText) {
    if (required) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        `${field} 不能为空`,
        field,
        400
      )
    }

    return null
  }

  if (!mongoose.Types.ObjectId.isValid(idText)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ID_INVALID,
      `${field} 格式错误`,
      field,
      400
    )
  }

  return new mongoose.Types.ObjectId(idText)
}

function normalizeRequiredLanguage(value, field) {
  const languageCode = normalizeLanguageCode(value)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      `${field} 必须是支持的语言：${SUPPORTED_LANGUAGE_CODES.join(', ')}`,
      field,
      400
    )
  }

  return languageCode
}

function normalizeOptionalLanguage(value, field) {
  if (!toTrimmedString(value)) {
    return ''
  }

  return normalizeRequiredLanguage(value, field)
}

function normalizeLanguageList(value, field) {
  if (!Array.isArray(value)) {
    return []
  }

  const list = []
  value.forEach((item, index) => {
    const languageCode = normalizeRequiredLanguage(item, `${field}.${index}`)
    if (!list.includes(languageCode)) {
      list.push(languageCode)
    }
  })

  return list
}

function getFirstNonEmptyArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return value
    }
  }

  return []
}

function normalizeOptionalNumber(value, field) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      `${field} 必须是数字`,
      field,
      400
    )
  }

  return numberValue
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) {
    return []
  }

  const list = []
  value.forEach((item, index) => {
    const text = toTrimmedString(item)
    if (!text) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        `${field}.${index} 不能为空`,
        `${field}.${index}`,
        400
      )
    }
    if (!list.includes(text)) {
      list.push(text)
    }
  })

  return list
}

function normalizeEntries(value, field) {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      `${field} 必须是数组`,
      field,
      400
    )
  }

  return value
}

function normalizeObject(value, field) {
  if (value === undefined || value === null) {
    return {}
  }

  if (Array.isArray(value) || typeof value !== 'object') {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      `${field} 必须是对象`,
      field,
      400
    )
  }

  return value
}

function normalizeAiChunkCacheOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const cacheKey = toTrimmedString(value.cacheKey)
  const scopeKey = toTrimmedString(value.scopeKey)
  const chunkIndex = Number(value.chunkIndex)
  const chunkInputHash = toTrimmedString(value.chunkInputHash)
  if (
    !cacheKey ||
    !scopeKey ||
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0
  ) {
    return null
  }
  if (!chunkInputHash) {
    return null
  }

  return {
    cacheKey,
    scopeKey,
    chunkIndex,
    chunkInputHash
  }
}

function normalizeAiChunkCacheState(value) {
  const now = new Date()
  let records = []
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(value.records)) {
      records = value.records.filter(record => {
        return record && typeof record === 'object' && !Array.isArray(record)
      })
    }
  }

  return {
    schema: AI_CHUNK_CACHE_SCHEMA,
    version: AI_CHUNK_CACHE_VERSION,
    createdAt: value?.createdAt || now,
    updatedAt: now,
    records
  }
}

function isSameAiChunkCacheRecord(record, cacheOptions) {
  if (!record || !cacheOptions) {
    return false
  }
  return (
    toTrimmedString(record.cacheKey) === cacheOptions.cacheKey &&
    toTrimmedString(record.scopeKey) === cacheOptions.scopeKey &&
    Number(record.chunkIndex) === cacheOptions.chunkIndex
  )
}

function isMatchedAiChunkCacheRecord(record, cacheOptions) {
  if (!isSameAiChunkCacheRecord(record, cacheOptions)) {
    return false
  }
  if (record.schema !== AI_CHUNK_CACHE_SCHEMA) {
    return false
  }
  if (Number(record.version) !== AI_CHUNK_CACHE_VERSION) {
    return false
  }
  return toTrimmedString(record.chunkInputHash) === cacheOptions.chunkInputHash
}

function buildAiChunkCacheRecord(cacheRecord, cacheOptions) {
  return {
    schema: AI_CHUNK_CACHE_SCHEMA,
    version: AI_CHUNK_CACHE_VERSION,
    cacheKey: cacheOptions.cacheKey,
    scopeKey: cacheOptions.scopeKey,
    chunkIndex: cacheOptions.chunkIndex,
    chunkInputHash: cacheOptions.chunkInputHash,
    createdAt: new Date(),
    response: translationAiJsonLogService.sanitizeAiJsonValue(
      cacheRecord.response || null
    ),
    resultData: cloneSerializableValue(cacheRecord.resultData || null),
    aiJsonLog: translationAiJsonLogService.sanitizeAiJsonValue(
      cacheRecord.aiJsonLog || null
    )
  }
}

function cloneSerializableValue(value) {
  if (typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeJobType(value) {
  const jobType = toTrimmedString(value)
  if (!TRANSLATION_JOB_TYPE_VALUES.includes(jobType)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'jobType 不支持',
      'jobType',
      400
    )
  }

  return jobType
}

function normalizeStatus(value, field = 'status') {
  const status = toTrimmedString(value)
  if (!TRANSLATION_JOB_STATUS_VALUES.includes(status)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_STATUS_INVALID,
      '任务状态不支持',
      field,
      400
    )
  }

  return status
}

function normalizeAdminSnapshot(admin) {
  if (!admin || !admin._id) {
    return null
  }

  const id = toObjectId(String(admin._id), 'admin.id')
  const username = toTrimmedString(admin.username || admin.name || admin.email)
  const displayName = toTrimmedString(
    admin.displayName || admin.nickName || admin.nickname || admin.name
  )

  return {
    id,
    username,
    displayName
  }
}

function normalizeSource(sourceInput, jobType) {
  const source = normalizeObject(sourceInput, 'source')
  const normalizedSource = {
    postId: toObjectId(source.postId || source.sourcePostId, 'source.postId'),
    contentId: toObjectId(
      source.contentId || source.sourceContentId,
      'source.contentId'
    ),
    collectionName: toTrimmedString(source.collectionName),
    languageCode: normalizeOptionalLanguage(
      source.languageCode || source.sourceLanguageCode,
      'source.languageCode'
    ),
    snapshotId: toObjectId(
      source.snapshotId || source.sourceSnapshotId,
      'source.snapshotId'
    ),
    snapshotVersion: normalizeOptionalNumber(
      source.snapshotVersion,
      'source.snapshotVersion'
    ),
    overwriteSnapshot: source.overwriteSnapshot === true,
    sourceUpdatedAt: source.sourceUpdatedAt || source.updatedAt || null,
    title: toTrimmedString(source.title),
    meta: normalizeObject(source.meta, 'source.meta')
  }

  if (jobType === TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    if (!normalizedSource.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '文章翻译任务必须提供 source.postId',
        'source.postId',
        400
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    if (!normalizedSource.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '生成并 AI 翻译任务必须提供 source.postId',
        'source.postId',
        400
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE) {
    if (!normalizedSource.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '文章名词整理任务必须提供 source.postId',
        'source.postId',
        400
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
    if (!normalizedSource.contentId && !normalizedSource.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '通用内容翻译任务必须提供 source.contentId',
        'source.contentId',
        400
      )
    }
  }

  if (!normalizedSource.languageCode) {
    normalizedSource.languageCode = normalizeRequiredLanguage(
      source.languageCode || source.sourceLanguageCode,
      'source.languageCode'
    )
  }

  return normalizedSource
}

function normalizeTarget(targetInput, requestInput, jobType) {
  const target = normalizeObject(targetInput, 'target')
  const request = normalizeObject(requestInput, 'request')
  const targetLanguageCodes = normalizeLanguageList(
    getFirstNonEmptyArray(target.languageCodes, request.targetLanguageCodes),
    'target.languageCodes'
  )
  const languageCode = normalizeOptionalLanguage(
    target.languageCode || target.targetLanguageCode,
    'target.languageCode'
  )

  const normalizedTarget = {
    postId: toObjectId(target.postId || target.targetPostId, 'target.postId'),
    contentId: toObjectId(
      target.contentId || target.targetContentId,
      'target.contentId'
    ),
    collectionName: toTrimmedString(target.collectionName),
    languageCode,
    languageCodes: targetLanguageCodes,
    title: toTrimmedString(target.title),
    meta: normalizeObject(target.meta, 'target.meta')
  }

  if (jobType === TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    if (!normalizedTarget.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '文章翻译任务必须提供 target.postId',
        'target.postId',
        400
      )
    }
    if (!normalizedTarget.languageCode) {
      normalizedTarget.languageCode = normalizeRequiredLanguage(
        target.languageCode || target.targetLanguageCode,
        'target.languageCode'
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    if (!normalizedTarget.languageCodes.length) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '生成并 AI 翻译任务必须提供 target.languageCodes',
        'target.languageCodes',
        400
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE) {
    if (!normalizedTarget.languageCodes.length) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '文章名词整理任务必须提供 target.languageCodes',
        'target.languageCodes',
        400
      )
    }
  }

  if (jobType === TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
    if (!normalizedTarget.contentId && !normalizedTarget.postId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '通用内容翻译任务必须提供 target.contentId',
        'target.contentId',
        400
      )
    }
    if (!normalizedTarget.languageCode) {
      normalizedTarget.languageCode = normalizeRequiredLanguage(
        target.languageCode || target.targetLanguageCode,
        'target.languageCode'
      )
    }
  }

  return normalizedTarget
}

function normalizeRequest(requestInput, target) {
  const request = normalizeObject(requestInput, 'request')
  let maxDepth = 3
  if (request.recursion && request.recursion.maxDepth !== undefined) {
    maxDepth = Number(request.recursion.maxDepth)
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'request.recursion.maxDepth 必须是 1 到 10 的整数',
      'request.recursion.maxDepth',
      400
    )
  }

  return {
    selectedEntryKeys: normalizeStringList(
      request.selectedEntryKeys,
      'request.selectedEntryKeys'
    ),
    prompt: toTrimmedString(request.prompt),
    baseMode: toTrimmedString(request.baseMode),
    targetLanguageCodes: normalizeLanguageList(
      getFirstNonEmptyArray(request.targetLanguageCodes, target.languageCodes),
      'request.targetLanguageCodes'
    ),
    recursion: {
      maxDepth
    },
    entries: normalizeEntries(request.entries, 'request.entries'),
    options: normalizeObject(request.options, 'request.options')
  }
}

function normalizeTaskRelation(taskRelationInput, source) {
  const taskRelation = normalizeObject(taskRelationInput, 'taskRelation')
  let role =
    toTrimmedString(taskRelation.role) || TRANSLATION_JOB_TASK_ROLES.STANDALONE
  if (!TRANSLATION_JOB_TASK_ROLE_VALUES.includes(role)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'taskRelation.role 不支持',
      'taskRelation.role',
      400
    )
  }

  let childKind = toTrimmedString(taskRelation.childKind)
  if (childKind && !TRANSLATION_JOB_CHILD_KIND_VALUES.includes(childKind)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'taskRelation.childKind 不支持',
      'taskRelation.childKind',
      400
    )
  }
  if (role !== TRANSLATION_JOB_TASK_ROLES.CHILD) {
    childKind = ''
  }

  let orderIndex = Number(taskRelation.orderIndex || 0)
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    orderIndex = 0
  }

  let depth = Number(taskRelation.depth || 1)
  if (!Number.isInteger(depth) || depth < 1) {
    depth = 1
  }

  const childJobIds = []
  if (Array.isArray(taskRelation.childJobIds)) {
    taskRelation.childJobIds.forEach((item, index) => {
      const id = toObjectId(item, `taskRelation.childJobIds.${index}`)
      if (id) {
        childJobIds.push(id)
      }
    })
  }

  const sourcePostId =
    toObjectId(taskRelation.sourcePostId, 'taskRelation.sourcePostId') ||
    source.postId ||
    null

  return {
    role,
    childKind,
    orderIndex,
    rootId: toObjectId(taskRelation.rootId, 'taskRelation.rootId'),
    parentId: toObjectId(taskRelation.parentId, 'taskRelation.parentId'),
    depth,
    sourcePostId,
    articleSourceId: toObjectId(
      taskRelation.articleSourceId,
      'taskRelation.articleSourceId'
    ),
    childLanguageCode: normalizeOptionalLanguage(
      taskRelation.childLanguageCode,
      'taskRelation.childLanguageCode'
    ),
    childJobIds,
    blockedByJobId: toObjectId(
      taskRelation.blockedByJobId,
      'taskRelation.blockedByJobId'
    ),
    blockedReason: toTrimmedString(taskRelation.blockedReason),
    blockedAt: null,
    childStats: normalizeObject(
      taskRelation.childStats,
      'taskRelation.childStats'
    ),
    plannedRelatedSourceIdsByLanguage: normalizeObject(
      taskRelation.plannedRelatedSourceIdsByLanguage,
      'taskRelation.plannedRelatedSourceIdsByLanguage'
    ),
    plan: normalizeObject(taskRelation.plan, 'taskRelation.plan')
  }
}

function validateExecutableRequest(jobType, request) {
  if (jobType !== TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    if (jobType !== TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
      return
    }

    if (!Array.isArray(request.entries) || request.entries.length === 0) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '通用内容翻译后台任务必须提供 request.entries',
        'request.entries',
        400
      )
    }
    return
  }

  const shouldTranslateCoverImage =
    request.options && request.options.translateCoverImage === true
  const hasEntries =
    Array.isArray(request.entries) && request.entries.length > 0
  // 批量翻译入口只下发 selectedEntryKeys（跨语言稳定匹配键），具体翻译条目在执行时由服务端
  // 依据源/目标内容重建，因此允许"只有 selectedEntryKeys、没有 entries"的可执行任务。
  const hasSelectedEntryKeys =
    Array.isArray(request.selectedEntryKeys) &&
    request.selectedEntryKeys.length > 0
  if (!hasEntries && !hasSelectedEntryKeys && !shouldTranslateCoverImage) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '文章翻译后台任务必须提供 request.entries 或 request.selectedEntryKeys，或启用 request.options.translateCoverImage',
      'request.entries',
      400
    )
  }
}

function buildCreateLog(jobType) {
  return {
    message: `后台翻译任务已创建：${jobType}`,
    level: 'info',
    stage: 'create',
    createdAt: new Date()
  }
}

async function createTranslationJob(body = {}, options = {}) {
  const jobType = normalizeJobType(body.jobType)
  const target = normalizeTarget(body.target, body.request, jobType)
  const source = normalizeSource(body.source, jobType)
  const request = normalizeRequest(body.request, target)
  const taskRelation = normalizeTaskRelation(body.taskRelation, source)
  validateExecutableRequest(jobType, request)

  // "生成并 AI 翻译"任务统一作为家族 root：规划阶段把全部语言 / 相关文章拆成按顺序执行的
  // 子任务，规避单文档 16MB 限制。子任务由规划器内部创建（role=child）。
  // 无论单语言还是多语言、是否带相关文章，都走家族系统，避免与旧的 parent/child 机制冲突
  // 导致任务在列表中消失。
  const isTopLevelJob =
    taskRelation.role === TRANSLATION_JOB_TASK_ROLES.STANDALONE &&
    !taskRelation.parentId
  const shouldUseFamilyOrchestration =
    isTopLevelJob &&
    jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT &&
    Array.isArray(target.languageCodes) &&
    target.languageCodes.length >= 1
  if (shouldUseFamilyOrchestration) {
    taskRelation.role = TRANSLATION_JOB_TASK_ROLES.ROOT
    taskRelation.articleSourceId = source.postId || null
    taskRelation.sourcePostId = source.postId || null
  }

  const priority = Number(body.priority || 0)
  if (!Number.isInteger(priority) || priority < -100 || priority > 100) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'priority 必须是 -100 到 100 的整数',
      'priority',
      400
    )
  }

  const JobModel = getTranslationJobModel()
  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const job = await JobModel.create({
    jobType,
    status: TRANSLATION_JOB_STATUS.PENDING,
    queueControl: {
      active: true,
      deferred: false,
      priority
    },
    source,
    target,
    request,
    taskRelation,
    progress: {
      currentStep: '等待后台 worker 领取',
      currentStage: 'pending',
      totalSteps: 0,
      completedSteps: 0,
      percent: 0,
      recentLogs: [buildCreateLog(jobType)]
    },
    createdBy: adminSnapshot,
    updatedBy: adminSnapshot
  })

  return job.toObject()
}

// 批量启动文章 AI 翻译：把"一篇文章翻译成多种目标语言"组织成一个家族——
// 1 个根编排任务（root） + 1 个文章父编排任务（parent） + 每种目标语言 1 个翻译子任务（child）。
// 根/父任务不执行 AI，仅聚合状态；子任务按家族顺序逐个执行，复用既有家族编排（放行下一个/阻塞/聚合）
// 与按语言分 Tab 的审核采纳 UI。各子任务只携带共享的 selectedEntryKeys（跨语言稳定匹配键）与翻译选项，
// 具体翻译条目在执行时由服务端按源/目标内容重建。
async function createTranslationJobBatch(body = {}, options = {}) {
  const source = body.source || {}
  const request = body.request || {}
  const targets = Array.isArray(body.targets) ? body.targets : []
  if (targets.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '批量文章翻译任务必须提供至少一个目标语言版本',
      'targets',
      400
    )
  }

  // 归一化目标语言版本（每个目标对应一篇已存在的目标语言文章），同一语言只保留一个。
  const normalizedTargets = []
  const seenLanguageCodes = new Set()
  targets.forEach((target, index) => {
    const targetPostId = toObjectId(
      target && (target.postId || target.targetPostId),
      `targets.${index}.postId`,
      true
    )
    const languageCode = normalizeRequiredLanguage(
      target && target.languageCode,
      `targets.${index}.languageCode`
    )
    if (seenLanguageCodes.has(languageCode)) {
      return
    }
    seenLanguageCodes.add(languageCode)
    normalizedTargets.push({
      postId: targetPostId,
      languageCode,
      title: toTrimmedString(target && target.title)
    })
  })
  if (normalizedTargets.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '批量文章翻译任务没有有效的目标语言版本',
      'targets',
      400
    )
  }

  const priority = Number(body.priority || 0)
  if (!Number.isInteger(priority) || priority < -100 || priority > 100) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'priority 必须是 -100 到 100 的整数',
      'priority',
      400
    )
  }

  const languageCodes = normalizedTargets.map(item => item.languageCode)
  const sourcePostObjectId = toObjectId(source.postId, 'source.postId')
  const sourceLanguageCode = normalizeOptionalLanguage(
    source.languageCode,
    'source.languageCode'
  )
  const sourceTitle = toTrimmedString(source.title)
  const familyTitle = sourceTitle || `文章 ${source.postId || ''}`

  const sharedRequest = {
    selectedEntryKeys: normalizeStringList(
      request.selectedEntryKeys,
      'request.selectedEntryKeys'
    ),
    prompt: toTrimmedString(request.prompt),
    baseMode: toTrimmedString(request.baseMode),
    options: normalizeObject(request.options, 'request.options')
  }

  const JobModel = getTranslationJobModel()
  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const queueControl = { active: false, deferred: false, priority }
  const orchestratorRequest = {
    ...sharedRequest,
    targetLanguageCodes: languageCodes,
    recursion: { maxDepth: 1 },
    entries: []
  }

  // 1) 根编排任务：代表"把该文章翻译成全部目标语言"这一次请求，不执行 AI。
  const rootJob = await JobModel.create({
    jobType: TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION,
    status: TRANSLATION_JOB_STATUS.PENDING,
    queueControl,
    source: {
      postId: sourcePostObjectId,
      languageCode: sourceLanguageCode,
      title: familyTitle
    },
    target: { languageCodes, title: familyTitle },
    request: orchestratorRequest,
    taskRelation: {
      role: TRANSLATION_JOB_TASK_ROLES.ROOT,
      childKind: '',
      orderIndex: 0,
      depth: 1,
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
        buildRecentLog(
          `批量文章翻译家族已创建（${languageCodes.length} 种语言）`,
          'info',
          'family'
        )
      ]
    },
    createdBy: adminSnapshot,
    updatedBy: adminSnapshot
  })
  await JobModel.updateOne(
    { _id: rootJob._id },
    { $set: { 'taskRelation.rootId': rootJob._id } }
  )

  // 2) 文章父编排任务：聚合该文章下各语言子任务，供前端按语言分 Tab 审核采纳。
  const parentJob = await JobModel.create({
    jobType: TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION,
    status: TRANSLATION_JOB_STATUS.PENDING,
    queueControl,
    source: {
      postId: sourcePostObjectId,
      languageCode: sourceLanguageCode,
      title: familyTitle
    },
    target: { languageCodes, title: familyTitle },
    request: orchestratorRequest,
    taskRelation: {
      role: TRANSLATION_JOB_TASK_ROLES.PARENT,
      childKind: '',
      orderIndex: 0,
      rootId: rootJob._id,
      parentId: rootJob._id,
      depth: 2,
      sourcePostId: sourcePostObjectId,
      articleSourceId: sourcePostObjectId,
      childJobIds: [],
      childStats: {}
    },
    progress: {
      currentStep: '等待各语言子任务按顺序执行',
      currentStage: 'Orchestrating',
      totalSteps: 0,
      completedSteps: 0,
      percent: 0,
      recentLogs: [
        buildRecentLog(
          `文章「${familyTitle}」的翻译父任务已创建`,
          'info',
          'family'
        )
      ]
    },
    createdBy: adminSnapshot,
    updatedBy: adminSnapshot
  })

  // 3) 逐语言翻译子任务（针对各语言已存在的目标文章），按 orderIndex 顺序执行。
  const childJobIds = []
  const results = []
  for (let i = 0; i < normalizedTargets.length; i += 1) {
    const target = normalizedTargets[i]
    const childJob = await JobModel.create({
      jobType: TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION,
      status: TRANSLATION_JOB_STATUS.PENDING,
      queueControl,
      source: {
        postId: sourcePostObjectId,
        languageCode: sourceLanguageCode,
        title: familyTitle
      },
      target: {
        postId: target.postId,
        languageCode: target.languageCode,
        languageCodes: [target.languageCode],
        title: target.title || familyTitle
      },
      request: {
        ...sharedRequest,
        targetLanguageCodes: [target.languageCode],
        recursion: { maxDepth: 1 },
        entries: []
      },
      taskRelation: {
        role: TRANSLATION_JOB_TASK_ROLES.CHILD,
        childKind: TRANSLATION_JOB_CHILD_KINDS.POST_LANGUAGE_TRANSLATION,
        orderIndex: i,
        rootId: rootJob._id,
        parentId: parentJob._id,
        depth: 3,
        sourcePostId: sourcePostObjectId,
        articleSourceId: sourcePostObjectId,
        childLanguageCode: target.languageCode,
        childJobIds: [],
        childStats: {}
      },
      progress: {
        currentStep: '排队中，等待前序子任务完成',
        currentStage: 'pending',
        totalSteps: 0,
        completedSteps: 0,
        percent: 0,
        recentLogs: [
          buildRecentLog(
            `${target.languageCode} 翻译子任务已创建`,
            'info',
            'family'
          )
        ]
      },
      createdBy: adminSnapshot,
      updatedBy: adminSnapshot
    })
    childJobIds.push(childJob._id)
    results.push({
      targetPostId: String(target.postId),
      languageCode: target.languageCode,
      jobId: String(childJob._id),
      status: 'created'
    })
  }

  await JobModel.updateOne(
    { _id: parentJob._id },
    { $set: { 'taskRelation.childJobIds': childJobIds } }
  )
  await JobModel.updateOne(
    { _id: rootJob._id },
    {
      $set: {
        'taskRelation.childJobIds': [parentJob._id],
        'taskRelation.plan': {
          schema: 'wikimoe.ai.translation.post.batch.plan',
          version: 1,
          articleCount: 1,
          parentCount: 1,
          childCount: childJobIds.length,
          languageCount: languageCodes.length,
          generatedAt: new Date()
        }
      }
    }
  )

  // 放行第一个子任务进入队列，并由子任务派生根/父聚合状态。
  await activateNextFamilyChild(String(rootJob._id))
  await recomputeFamilyAggregateStatus(String(rootJob._id))

  return {
    createdCount: normalizedTargets.length,
    failedCount: 0,
    totalCount: targets.length,
    rootJobId: String(rootJob._id),
    parentJobId: String(parentJob._id),
    results
  }
}

function parsePage(value) {
  const page = Number(value || 1)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }

  return page
}

function parseLimit(value) {
  const limit = Number(value || DEFAULT_LIST_LIMIT)
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_LIST_LIMIT
  }

  return Math.min(limit, MAX_LIST_LIMIT)
}

function parseBooleanFilter(value) {
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }

  return null
}

function appendAndCondition(params, condition) {
  if (!condition || typeof condition !== 'object') {
    return
  }
  if (!Array.isArray(params.$and)) {
    params.$and = []
  }
  params.$and.push(condition)
}

function buildListParams(query = {}) {
  const params = {}

  if (query.jobType) {
    params.jobType = normalizeJobType(query.jobType)
  }

  if (query.status) {
    params.status = normalizeStatus(query.status)
  }

  const deferred = parseBooleanFilter(query.deferred)
  if (deferred !== null) {
    params['queueControl.deferred'] = deferred
  }

  const active = parseBooleanFilter(query.active)
  if (active !== null) {
    params['queueControl.active'] = active
  }

  if (query.sourcePostId) {
    params['source.postId'] = toObjectId(query.sourcePostId, 'sourcePostId')
  }

  if (query.targetPostId) {
    params['target.postId'] = toObjectId(query.targetPostId, 'targetPostId')
  }

  if (query.rootId) {
    params['taskRelation.rootId'] = toObjectId(query.rootId, 'rootId')
  }

  if (query.role) {
    params['taskRelation.role'] = toTrimmedString(query.role)
  }

  // 列表默认只展示顶层任务（独立任务 + 家族 root），子任务（parent/child）通过家族详情展开，
  // 避免父子任务混在一级列表里。前端可显式传 topLevel=false 查看全部。
  if (
    parseBooleanFilter(query.topLevel) !== false &&
    !query.rootId &&
    !query.role
  ) {
    appendAndCondition(params, {
      $or: [
        { 'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.STANDALONE },
        { 'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.ROOT },
        { 'taskRelation.role': { $exists: false } },
        { taskRelation: { $exists: false } }
      ]
    })
  }

  if (query.targetLanguageCode) {
    const languageCode = normalizeRequiredLanguage(
      query.targetLanguageCode,
      'targetLanguageCode'
    )
    appendAndCondition(params, {
      $or: [
        { 'target.languageCode': languageCode },
        { 'target.languageCodes': languageCode }
      ]
    })
  }

  if (query.keyword) {
    const keyword = toTrimmedString(query.keyword)
    if (keyword) {
      const keywordRegExp = new RegExp(
        keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      )
      const keywordOr = [
        { 'source.title': keywordRegExp },
        { 'target.title': keywordRegExp },
        { 'progress.currentStep': keywordRegExp },
        { 'failure.errorMessage': keywordRegExp }
      ]
      appendAndCondition(params, { $or: keywordOr })
    }
  }

  return params
}

function getListProjection() {
  return {
    jobType: 1,
    status: 1,
    createdAt: 1,
    'source.title': 1,
    'target.title': 1,
    'target.languageCode': 1,
    'target.languageCodes': 1,
    'taskRelation.role': 1,
    'taskRelation.rootId': 1,
    'taskRelation.parentId': 1,
    'taskRelation.depth': 1,
    'taskRelation.childKind': 1,
    'taskRelation.orderIndex': 1,
    'taskRelation.childLanguageCode': 1,
    'taskRelation.childJobIds': 1,
    'taskRelation.childStats': 1,
    'queueControl.active': 1,
    'queueControl.deferred': 1,
    'queueControl.priority': 1,
    'progress.currentStep': 1,
    'progress.currentStage': 1,
    'progress.percent': 1,
    'runtime.leaseExpiresAt': 1,
    'runtime.recovering': 1,
    'failure.errorCode': 1,
    'failure.errorMessage': 1,
    'failure.retryable': 1
  }
}

async function getQueuePositionMap(list) {
  const pendingList = list.filter(item => {
    return (
      item.status === TRANSLATION_JOB_STATUS.PENDING &&
      item.queueControl &&
      item.queueControl.active &&
      !item.queueControl.deferred
    )
  })
  if (!pendingList.length) {
    return {}
  }

  const JobModel = getTranslationJobModel()
  const queuePositionMap = {}
  const queueFacetMap = {}
  pendingList.forEach(item => {
    const priority = item.queueControl.priority || 0
    queueFacetMap[String(item._id)] = [
      {
        $match: {
          $or: [
            { 'queueControl.priority': { $gt: priority } },
            {
              'queueControl.priority': priority,
              createdAt: { $lt: item.createdAt }
            },
            {
              'queueControl.priority': priority,
              createdAt: item.createdAt,
              _id: { $lt: item._id }
            }
          ]
        }
      },
      {
        $count: 'beforeCount'
      }
    ]
  })
  const [queuePositionResult] = await JobModel.aggregate([
    {
      $match: {
        status: TRANSLATION_JOB_STATUS.PENDING,
        'queueControl.active': true,
        'queueControl.deferred': false
      }
    },
    {
      $facet: queueFacetMap
    }
  ])
  pendingList.forEach(item => {
    const itemResult = queuePositionResult[String(item._id)]
    let beforeCount = 0
    if (Array.isArray(itemResult) && itemResult[0]) {
      beforeCount = itemResult[0].beforeCount || 0
    }
    queuePositionMap[String(item._id)] = beforeCount + 1
  })

  return queuePositionMap
}

function getRuntimeState(item) {
  const now = new Date()
  const runtime = item.runtime || {}
  let runtimeState = ''
  if (item.status === TRANSLATION_JOB_STATUS.RUNNING) {
    if (runtime.leaseExpiresAt && new Date(runtime.leaseExpiresAt) > now) {
      runtimeState = '心跳正常'
    } else if (runtime.recovering) {
      runtimeState = '恢复重试中'
    } else {
      runtimeState = '等待恢复'
    }
  }

  return runtimeState
}

function attachRuntimeDisplay(item, queuePositionMap) {
  return {
    ...item,
    queuePosition: queuePositionMap[String(item._id)] || null,
    runtimeState: getRuntimeState(item)
  }
}

function buildListItemSummary(item, queuePositionMap) {
  const source = item.source || {}
  const target = item.target || {}
  const queueControl = item.queueControl || {}
  const progress = item.progress || {}
  const failure = item.failure || {}
  const taskRelation = item.taskRelation || {}
  let targetLanguageCodes = []
  if (Array.isArray(target.languageCodes)) {
    targetLanguageCodes = target.languageCodes
  }
  let childJobCount = 0
  if (Array.isArray(taskRelation.childJobIds)) {
    childJobCount = taskRelation.childJobIds.length
  }

  return {
    _id: item._id,
    jobType: item.jobType,
    status: item.status,
    source: {
      title: source.title || ''
    },
    target: {
      title: target.title || '',
      languageCode: target.languageCode || '',
      languageCodes: targetLanguageCodes
    },
    taskRelation: {
      role: taskRelation.role || 'standalone',
      childKind: taskRelation.childKind || '',
      orderIndex: Number(taskRelation.orderIndex || 0),
      childLanguageCode: taskRelation.childLanguageCode || '',
      rootId: taskRelation.rootId || null,
      parentId: taskRelation.parentId || null,
      depth: Number(taskRelation.depth || 1),
      childJobCount,
      childStats: taskRelation.childStats || {}
    },
    queueControl: {
      active: queueControl.active === true,
      deferred: queueControl.deferred === true
    },
    progress: {
      currentStep: progress.currentStep || '',
      currentStage: progress.currentStage || '',
      percent: progress.percent || 0
    },
    failure: {
      errorCode: failure.errorCode || '',
      errorMessage: failure.errorMessage || '',
      retryable: isFailureRetryableForUser(failure)
    },
    queuePosition: queuePositionMap[String(item._id)] || null,
    runtimeState: getRuntimeState(item),
    createdAt: item.createdAt
  }
}

async function listTranslationJobs(query = {}) {
  const JobModel = getTranslationJobModel()
  const page = parsePage(query.page)
  const limit = parseLimit(query.limit)
  const params = buildListParams(query)
  const total = await JobModel.countDocuments(params)
  const list = await JobModel.find(params, getListProjection())
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
  const queuePositionMap = await getQueuePositionMap(list)
  const topLevelSummaries = list.map(item =>
    buildListItemSummary(item, queuePositionMap)
  )

  // 在接口层一次性把家族子任务（parent/child）平铺附加到对应 root 之后，避免前端为每个
  // root 单独请求 family 接口造成几十次接口调用。只用一次批量查询拿全部家族成员（轻量摘要，
  // 不含 previewEntries），在内存里按顺序平铺。
  const flatList = await attachFamilyMembersToList(topLevelSummaries)

  return {
    list: flatList,
    total,
    page,
    limit
  }
}

// 按家族关系把 parent/child 子任务平铺插入到列表中对应 root 之后（一次批量查询完成）。
async function attachFamilyMembersToList(topLevelSummaries) {
  const rootIds = topLevelSummaries
    .filter(
      item =>
        item.taskRelation &&
        item.taskRelation.role === TRANSLATION_JOB_TASK_ROLES.ROOT
    )
    .map(item => item._id)
  if (rootIds.length === 0) {
    return topLevelSummaries
  }
  const JobModel = getTranslationJobModel()
  const familyMembers = await JobModel.find(
    {
      'taskRelation.rootId': { $in: rootIds },
      'taskRelation.role': {
        $in: [
          TRANSLATION_JOB_TASK_ROLES.PARENT,
          TRANSLATION_JOB_TASK_ROLES.CHILD
        ]
      }
    },
    getListProjection()
  ).lean()

  // 按 rootId 分组：parents 列表 + parentId→children 列表。
  const parentsByRoot = new Map()
  const childrenByParent = new Map()
  familyMembers.forEach(member => {
    const relation = member.taskRelation || {}
    const rootIdText = relation.rootId ? String(relation.rootId) : ''
    const summary = buildListItemSummary(member, {})
    if (relation.role === TRANSLATION_JOB_TASK_ROLES.PARENT) {
      if (!parentsByRoot.has(rootIdText)) {
        parentsByRoot.set(rootIdText, [])
      }
      parentsByRoot.get(rootIdText).push(summary)
      return
    }
    const parentIdText = relation.parentId ? String(relation.parentId) : ''
    if (!childrenByParent.has(parentIdText)) {
      childrenByParent.set(parentIdText, [])
    }
    childrenByParent.get(parentIdText).push(summary)
  })

  const flatList = []
  topLevelSummaries.forEach(item => {
    flatList.push(item)
    if (
      !item.taskRelation ||
      item.taskRelation.role !== TRANSLATION_JOB_TASK_ROLES.ROOT
    ) {
      return
    }
    const parents = (parentsByRoot.get(String(item._id)) || [])
      .slice()
      .sort((a, b) => a.taskRelation.orderIndex - b.taskRelation.orderIndex)
    parents.forEach(parent => {
      flatList.push(parent)
      const children = (childrenByParent.get(String(parent._id)) || [])
        .slice()
        .sort((a, b) => a.taskRelation.orderIndex - b.taskRelation.orderIndex)
      children.forEach(child => {
        flatList.push(child)
      })
    })
  })
  return flatList
}

async function buildTranslationJobCollectionStorageSummary() {
  const JobModel = getTranslationJobModel()
  const stats = await getCollectionStats(JobModel)
  const collectionName = getCollectionName(JobModel)
  const documentCount = await JobModel.countDocuments({})
  const storageSizeBytes = getFiniteNumber(stats.storageSize)
  const indexSizeBytes = getFiniteNumber(stats.totalIndexSize)
  let totalSizeBytes = getFiniteNumber(stats.totalSize)
  if (totalSizeBytes === 0) {
    totalSizeBytes = storageSizeBytes + indexSizeBytes
  }

  return {
    key: 'translationJobs',
    label: 'AI 翻译任务',
    collectionName,
    documentCount,
    sizeBytes: getFiniteNumber(stats.size),
    storageSizeBytes,
    indexSizeBytes,
    totalSizeBytes,
    avgObjSizeBytes: getFiniteNumber(stats.avgObjSize),
    indexCount: getFiniteNumber(stats.nindexes)
  }
}

async function getTranslationJobStorageSummary() {
  const table = await buildTranslationJobCollectionStorageSummary()
  const coverImageTempStorage =
    await coverImageTempFileService.getCoverImageTempStorageSummary()
  const aiLogStorage = await aiLogFileService.getAiLogStorageSummary()
  const updatedAt = new Date()
  const databaseSizeBytes = table.totalSizeBytes
  const cacheSizeBytes = coverImageTempStorage.totalSizeBytes
  const aiLogSizeBytes = aiLogStorage.totalSizeBytes
  const fileStorageSizeBytes = cacheSizeBytes + aiLogSizeBytes

  return {
    updatedAt,
    tables: [table],
    fileCaches: [coverImageTempStorage, aiLogStorage],
    totals: {
      tableCount: 1,
      documentCount: table.documentCount,
      fileCacheCount: 2,
      sizeBytes: table.sizeBytes,
      storageSizeBytes: table.storageSizeBytes,
      indexSizeBytes: table.indexSizeBytes,
      databaseSizeBytes,
      cacheSizeBytes,
      aiLogSizeBytes,
      fileStorageSizeBytes,
      totalSizeBytes: databaseSizeBytes + fileStorageSizeBytes
    }
  }
}

async function getTranslationJobDetail(query = {}) {
  const id = toObjectId(query.id, 'id', true)
  const params = { _id: id }

  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne(params).lean()
  if (!job) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  const role = job.taskRelation && job.taskRelation.role
  // 家族编排节点详情：父任务聚合其下各语言子任务的译文供统一审核采纳；根任务返回各文章
  // 父任务卡片供下钻。
  if (role === TRANSLATION_JOB_TASK_ROLES.PARENT) {
    return await buildParentReviewResponse(job)
  }
  if (role === TRANSLATION_JOB_TASK_ROLES.ROOT) {
    return await buildRootOverviewResponse(job)
  }

  return attachRuntimeDisplay(await buildTranslationJobDetailResponse(job), {})
}

// 单语言翻译子任务会把 result.validation 存成带 languageValidations 的包装对象（供子任务详情按语言匹配），
// 父任务聚合时必须解包出对应语言的内层完整 validation，否则前端只会拿到包装层（只有统计、缺少修正明细与
// 校验报告正文），导致父抽屉的 AI 校验报告内容缺失。
function unwrapChildValidationForLanguage(validation, languageCode) {
  if (!validation || typeof validation !== 'object') {
    return null
  }
  if (!Array.isArray(validation.languageValidations)) {
    return validation
  }
  const matched = validation.languageValidations.find(item => {
    return item && item.languageCode === languageCode
  })
  if (matched && matched.validation) {
    return matched.validation
  }
  const firstWithValidation = validation.languageValidations.find(item => {
    return item && item.validation
  })
  if (firstWithValidation) {
    return firstWithValidation.validation
  }
  return null
}

// 父任务详情：聚合其下"可采纳"子任务（单语言翻译 + 封面图整理）的 previewEntries 与采纳记录，
// 复用前端按语言分 Tab 的审核 UI；每个条目带上 childJobId 以便采纳时回到对应子任务执行。
async function buildParentReviewResponse(parent) {
  const JobModel = getTranslationJobModel()
  const children = await JobModel.find({
    'taskRelation.parentId': parent._id,
    'taskRelation.childKind': { $in: TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS }
  })
    .sort({ 'taskRelation.orderIndex': 1 })
    .lean()

  const previewEntries = []
  const adoptionEntries = []
  const warningList = []
  const aiSkipList = []
  const languageValidations = []
  const childReviewMeta = []
  children.forEach(child => {
    const childId = String(child._id)
    const childKind = child.taskRelation && child.taskRelation.childKind
    const childPreview = Array.isArray(child.result?.previewEntries)
      ? child.result.previewEntries
      : []
    childPreview.forEach(entry => {
      previewEntries.push({ ...entry, childJobId: childId, childKind })
    })
    const childAdoption = Array.isArray(child.adoption?.entries)
      ? child.adoption.entries
      : []
    childAdoption.forEach(entry => {
      adoptionEntries.push({ ...entry, childJobId: childId })
    })
    if (Array.isArray(child.result?.warningList)) {
      warningList.push(...child.result.warningList)
    }
    if (Array.isArray(child.result?.aiSkipList)) {
      aiSkipList.push(...child.result.aiSkipList)
    }
    const childLanguageCode =
      (child.taskRelation && child.taskRelation.childLanguageCode) || ''
    if (child.result?.validation && childLanguageCode) {
      const childValidation = unwrapChildValidationForLanguage(
        child.result.validation,
        childLanguageCode
      )
      if (childValidation) {
        languageValidations.push({
          languageCode: childLanguageCode,
          sourceId: child.taskRelation?.articleSourceId || null,
          validation: childValidation
        })
      }
    }
    childReviewMeta.push({
      childJobId: childId,
      childKind,
      languageCode: childLanguageCode,
      status: child.status,
      entryCount: childPreview.length
    })
  })

  let validation = null
  if (languageValidations.length > 0) {
    validation = {
      enabled: true,
      status: 'completed',
      languageValidations
    }
  }

  return attachRuntimeDisplay(
    {
      ...parent,
      failure: normalizeFailureForResponse(parent.failure),
      result: {
        ...(parent.result || {}),
        payload: null,
        payloadSummary: { entryCount: previewEntries.length, fieldCount: 0 },
        previewEntries,
        warningList,
        aiSkipList,
        aiJsonLogs: [],
        aiJsonLogCount: 0,
        languageResults: [],
        relatedResults: [],
        translationPostMap: {},
        coverImageGenerationMap: {},
        coverImageRecognitionMap: {},
        validation
      },
      adoption: {
        ...(parent.adoption || {}),
        entries: adoptionEntries
      },
      familyChildReview: childReviewMeta
    },
    {}
  )
}

// 根任务详情：返回其下各文章父任务的摘要卡片，供前端下钻打开父任务抽屉。
async function buildRootOverviewResponse(root) {
  const JobModel = getTranslationJobModel()
  const parents = await JobModel.find(
    {
      'taskRelation.rootId': root._id,
      'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.PARENT
    },
    getListProjection()
  )
    .sort({ 'taskRelation.orderIndex': 1 })
    .lean()
  const familyParents = parents.map(parent => buildListItemSummary(parent, {}))

  return attachRuntimeDisplay(
    {
      ...root,
      failure: normalizeFailureForResponse(root.failure),
      result: {
        ...(root.result || {}),
        payload: null,
        payloadSummary: { entryCount: 0, fieldCount: 0 },
        previewEntries: [],
        aiJsonLogs: [],
        aiJsonLogCount: 0,
        languageResults: [],
        relatedResults: [],
        translationPostMap: {},
        coverImageGenerationMap: {},
        coverImageRecognitionMap: {}
      },
      familyParents
    },
    {}
  )
}

// 获取整个家族树（root + parents + children 摘要）。仅返回轻量摘要，不含 previewEntries/
// payload/aiJsonLogs 等重字段，避免把单文档 16MB 风险转移到聚合响应体上；审核时各子任务
// 的 previewEntries 由前端按需调用 detail 接口懒加载。
async function getTranslationJobFamily(query = {}) {
  const anchorId = toObjectId(query.rootId || query.id, 'id', true)
  const JobModel = getTranslationJobModel()
  const anchorJob = await JobModel.findOne(
    { _id: anchorId },
    { 'taskRelation.role': 1, 'taskRelation.rootId': 1 }
  ).lean()
  if (!anchorJob) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }
  let rootId = anchorId
  if (
    anchorJob.taskRelation &&
    anchorJob.taskRelation.rootId &&
    String(anchorJob.taskRelation.rootId) !== String(anchorId)
  ) {
    rootId = anchorJob.taskRelation.rootId
  }

  const familyJobs = await JobModel.find(
    {
      $or: [
        { _id: toObjectId(rootId) },
        { 'taskRelation.rootId': toObjectId(rootId) }
      ]
    },
    getListProjection()
  ).lean()

  let root = null
  const parents = []
  const childrenByParent = new Map()
  familyJobs.forEach(job => {
    const role = job.taskRelation && job.taskRelation.role
    const summary = buildListItemSummary(job, {})
    if (String(job._id) === String(rootId)) {
      root = summary
      return
    }
    if (role === TRANSLATION_JOB_TASK_ROLES.PARENT) {
      parents.push(summary)
      return
    }
    if (role === TRANSLATION_JOB_TASK_ROLES.CHILD) {
      const parentIdText = summary.taskRelation.parentId
        ? String(summary.taskRelation.parentId)
        : ''
      if (!childrenByParent.has(parentIdText)) {
        childrenByParent.set(parentIdText, [])
      }
      childrenByParent.get(parentIdText).push(summary)
    }
  })

  parents.sort((a, b) => a.taskRelation.orderIndex - b.taskRelation.orderIndex)
  const parentTree = parents.map(parent => {
    const children = (childrenByParent.get(String(parent._id)) || []).slice()
    children.sort(
      (a, b) => a.taskRelation.orderIndex - b.taskRelation.orderIndex
    )
    return {
      ...parent,
      children
    }
  })

  return {
    rootId: String(rootId),
    root,
    parents: parentTree
  }
}

function buildPayloadSummary(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      entryCount: 0,
      fieldCount: 0
    }
  }
  let entryCount = 0
  if (Array.isArray(payload.entries)) {
    entryCount = payload.entries.length
  }
  return {
    entryCount,
    fieldCount: Object.keys(payload).length
  }
}

async function getTranslationJobAiJsonLogs(result) {
  if (result?.aiJsonLogStorage?.storage === 'file') {
    try {
      const logs = await aiLogFileService.readTranslationJobAiJsonLogs(
        result.aiJsonLogStorage
      )
      return {
        logs,
        missing: false,
        errorMessage: ''
      }
    } catch (error) {
      // AI JSON 日志文件缺失属于可恢复情况：日志文件可能被清理或迁移，
      // 详情接口仍要返回任务数据，仅把缺失状态透传给前端提示，不当作严重错误抛出。
      if (error && error.code === 'ENOENT') {
        return {
          logs: [],
          missing: true,
          errorMessage: 'AI 任务 JSON 日志文件已缺失，无法展示详细调用日志'
        }
      }
      throw error
    }
  }

  if (Array.isArray(result?.aiJsonLogs)) {
    return {
      logs: result.aiJsonLogs,
      missing: false,
      errorMessage: ''
    }
  }

  return {
    logs: [],
    missing: false,
    errorMessage: ''
  }
}

async function buildTranslationJobDetailResponse(job) {
  const result = job.result || {}
  const aiJsonLogsResult = await getTranslationJobAiJsonLogs(result)
  const aiJsonLogs = aiJsonLogsResult.logs
  const workflowJob = {
    ...job,
    result: {
      ...result,
      aiJsonLogs,
      aiJsonLogCount: aiJsonLogs.length
    }
  }
  const aiWorkflow =
    translationAiWorkflowViewService.buildTranslationJobWorkflow(workflowJob)
  return {
    ...job,
    failure: normalizeFailureForResponse(job.failure),
    result: {
      ...result,
      payload: null,
      payloadSummary: buildPayloadSummary(result.payload),
      aiJsonLogs: [],
      aiJsonLogCount: aiJsonLogs.length,
      aiJsonLogStorage: result.aiJsonLogStorage || null,
      aiJsonLogStorageMissing: aiJsonLogsResult.missing,
      aiJsonLogStorageError: aiJsonLogsResult.errorMessage,
      aiWorkflow,
      relatedResults: [],
      languageResults: [],
      translationPostMap: {},
      coverImageGenerationMap: {},
      coverImageRecognitionMap: {}
    }
  }
}

function appendLog(job, message, level = 'info', stage = '') {
  const progress = job.progress || {}
  const recentLogs = Array.isArray(progress.recentLogs)
    ? progress.recentLogs
    : []
  recentLogs.push({
    message,
    level,
    stage,
    createdAt: new Date()
  })
  progress.recentLogs = recentLogs.slice(-MAX_RECENT_LOGS)
  job.progress = progress
}

async function getMutableJob(id) {
  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne({
    _id: toObjectId(id, 'id', true)
  })

  if (!job) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  return job
}

function assertStatus(job, allowedStatuses, actionName) {
  if (!allowedStatuses.includes(job.status)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      `${actionName} 不允许作用于当前状态：${job.status}`,
      'status',
      400
    )
  }
}

function assertQueueActive(job, actionName) {
  if (!job.queueControl || !job.queueControl.active) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      `${actionName} 不允许作用于非活跃任务`,
      'queueControl.active',
      400
    )
  }
}

function isStoppedFailedJob(job) {
  if (job.status === TRANSLATION_JOB_STATUS.FAILED) {
    return true
  }
  if (job.status !== TRANSLATION_JOB_STATUS.RUNNING) {
    return false
  }
  if (!job.failure || !job.failure.errorCode) {
    return false
  }
  if (job.failure.retryable !== false) {
    return false
  }

  const leaseExpiresAt = job.runtime && job.runtime.leaseExpiresAt
  if (!leaseExpiresAt) {
    return true
  }

  return new Date(leaseExpiresAt) <= new Date()
}

function canDeleteTranslationJob(job) {
  if (isStoppedFailedJob(job)) {
    return true
  }

  return TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES.includes(job.status)
}

function assertCanDeleteTranslationJob(job) {
  if (canDeleteTranslationJob(job)) {
    return
  }

  assertStatus(job, TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES, '删除任务')
}

async function cleanupJobCoverImageCacheBeforeDelete(job) {
  const cleanupResult =
    await coverImageTempFileService.cleanupJobCoverImageTempFiles(job, {
      ignoreMissing: true
    })
  const failedItems = Array.isArray(cleanupResult.failedItems)
    ? cleanupResult.failedItems
    : []
  const jobTempDirFailed = failedItems.some(item => {
    return item && item.type === 'job-temp-dir'
  })
  if (jobTempDirFailed) {
    throw new ApiError(
      ERROR_CODES.LOCAL_FILE_DELETE_FAILED,
      '封面图缓存图片清理失败，任务未删除',
      'coverImageTempFiles',
      500,
      { cleanupResult }
    )
  }

  return cleanupResult
}

async function cleanupJobAiChunkCache(job) {
  return await tryClearTranslationJobAiChunkCacheById(String(job?._id || ''))
}

async function cleanupJobAiLogDirectoryBeforeDelete(job) {
  return await aiLogFileService.deleteTranslationJobAiLogDirectory(
    String(job?._id || '')
  )
}

async function deferTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertStatus(job, [TRANSLATION_JOB_STATUS.PENDING], '暂时跳过')
  assertQueueActive(job, '暂时跳过')

  job.queueControl.deferred = true
  job.updatedBy = normalizeAdminSnapshot(options.admin)
  appendLog(job, '任务已暂时跳过，将不会被后台 worker 领取', 'info', 'defer')
  await job.save()
  return job.toObject()
}

async function requestStopRunningTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertStatus(job, [TRANSLATION_JOB_STATUS.RUNNING], '停止任务')

  const workerId = toTrimmedString(job.runtime?.workerId)
  const attemptNo = Number(job.runtime?.attempts || 0)
  if (!workerId || attemptNo < 1) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '当前任务没有可停止的后台 worker',
      'runtime.workerId',
      400
    )
  }

  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const reason = toTrimmedString(body.reason) || '任务已被用户停止'
  job.queueControl.active = false
  job.runtime.interruptReason = reason
  job.updatedBy = adminSnapshot
  job.progress = job.progress || {}
  job.progress.currentStep = '正在停止任务，已请求断开 AI 连接'
  const aiWorkflowState = job.progress.stageState?.aiWorkflow
  const currentAiWorkflow = aiWorkflowState?.current
  if (currentAiWorkflow?.stepKey) {
    const stopEvent = {
      stepKey: toTrimmedString(currentAiWorkflow.stepKey),
      stepLabel: toTrimmedString(currentAiWorkflow.stepLabel),
      status: 'stopping',
      message: job.progress.currentStep,
      stage: toTrimmedString(job.progress.currentStage),
      attemptNo: currentAiWorkflow.attemptNo || null,
      nextAttemptNo: null,
      maxAttempts: currentAiWorkflow.maxAttempts || null,
      errorCode: '',
      errorMessage: '',
      createdAt: new Date()
    }
    job.progress.stageState.aiWorkflow.current = stopEvent
    let events = []
    if (Array.isArray(job.progress.stageState.aiWorkflow.events)) {
      events = job.progress.stageState.aiWorkflow.events
    }
    events.push(stopEvent)
    job.progress.stageState.aiWorkflow.events = events.slice(-120)
    if (typeof job.markModified === 'function') {
      job.markModified('progress.stageState')
    }
  }
  appendLog(job, reason, 'warning', 'stop')
  await job.save()

  return {
    id: String(job._id),
    workerId,
    attemptNo,
    reason
  }
}

async function resumeTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertStatus(job, [TRANSLATION_JOB_STATUS.PENDING], '恢复执行')
  assertQueueActive(job, '恢复执行')

  job.queueControl.deferred = false
  job.updatedBy = normalizeAdminSnapshot(options.admin)
  appendLog(job, '任务已恢复排队', 'info', 'resume')
  await job.save()
  return job.toObject()
}

async function deleteTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertCanDeleteTranslationJob(job)

  // 删除家族编排节点（root/parent）时级联删除其全部子孙任务，避免留下孤儿子任务。
  const role = job.taskRelation && job.taskRelation.role
  if (
    role === TRANSLATION_JOB_TASK_ROLES.ROOT ||
    role === TRANSLATION_JOB_TASK_ROLES.PARENT
  ) {
    return await deleteTranslationFamilyNode(job)
  }

  const cleanupResult = await cleanupJobCoverImageCacheBeforeDelete(job)
  const aiChunkCacheCleanupResult = await cleanupJobAiChunkCache(job)
  const aiLogCleanupResult = await cleanupJobAiLogDirectoryBeforeDelete(job)

  const JobModel = getTranslationJobModel()
  const deleteResult = await JobModel.deleteOne({
    _id: job._id
  })
  if (!deleteResult || deleteResult.deletedCount !== 1) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  return {
    id: job._id,
    deleted: true,
    cleanupStatus: cleanupResult.cleanupStatus,
    aiChunkCacheCleanup: aiChunkCacheCleanupResult,
    aiLogCleanup: aiLogCleanupResult
  }
}

// 级联删除家族节点：删除 root 时清除整个家族；删除 parent 时清除该父任务及其子任务。
async function deleteTranslationFamilyNode(orchestratorJob) {
  const JobModel = getTranslationJobModel()
  const role = orchestratorJob.taskRelation.role
  let nodesToDelete = []
  if (role === TRANSLATION_JOB_TASK_ROLES.ROOT) {
    const rootId = orchestratorJob._id
    nodesToDelete = await JobModel.find({
      $or: [{ _id: rootId }, { 'taskRelation.rootId': rootId }]
    })
  } else {
    const parentId = orchestratorJob._id
    const children = await JobModel.find({
      'taskRelation.parentId': parentId
    })
    nodesToDelete = [orchestratorJob, ...children]
  }

  // 任意运行中的子任务都不允许删除，避免破坏正在执行的任务。
  const runningNode = nodesToDelete.find(
    node => node.status === TRANSLATION_JOB_STATUS.RUNNING
  )
  if (runningNode) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '家族中存在执行中的子任务，不能删除',
      'status',
      400
    )
  }

  const deletedIds = []
  for (const node of nodesToDelete) {
    await cleanupJobCoverImageCacheBeforeDelete(node)
    await cleanupJobAiChunkCache(node)
    await cleanupJobAiLogDirectoryBeforeDelete(node)
    await JobModel.deleteOne({ _id: node._id })
    deletedIds.push(String(node._id))
  }

  return {
    id: orchestratorJob._id,
    deleted: true,
    cascade: true,
    deletedCount: deletedIds.length,
    deletedIds
  }
}

function normalizeBatchDeleteIds(body = {}) {
  const rawIds = normalizeStringList(body.ids, 'ids')
  const ids = []
  rawIds.forEach(rawId => {
    const normalizedId = String(toObjectId(rawId, 'ids', true))
    if (!ids.includes(normalizedId)) {
      ids.push(normalizedId)
    }
  })
  if (ids.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'ids 不能为空',
      'ids',
      400
    )
  }
  if (ids.length > MAX_BATCH_DELETE_COUNT) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      `单次最多删除 ${MAX_BATCH_DELETE_COUNT} 个 AI 翻译任务`,
      'ids',
      400
    )
  }

  return ids
}

async function getBatchDeleteJobs(ids) {
  const objectIds = ids.map(id => toObjectId(id, 'ids', true))
  const normalizedIds = objectIds.map(id => String(id))
  const JobModel = getTranslationJobModel()
  const jobs = await JobModel.find({
    _id: { $in: objectIds }
  }).lean()
  const jobMap = new Map()
  jobs.forEach(job => {
    jobMap.set(String(job._id), job)
  })
  const missingIds = ids.filter((id, index) => {
    return !jobMap.has(normalizedIds[index])
  })
  if (missingIds.length > 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_NOT_FOUND,
      `以下任务不存在或已删除：${missingIds.join('、')}`,
      'ids',
      400,
      { missingIds }
    )
  }

  const forbiddenJobs = ids
    .map((id, index) => jobMap.get(normalizedIds[index]))
    .filter(job => !canDeleteTranslationJob(job))
  if (forbiddenJobs.length > 0) {
    const forbiddenItems = forbiddenJobs.map(job => {
      return {
        id: String(job._id),
        status: job.status
      }
    })
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '所选 AI 翻译任务中包含当前状态不可删除的任务',
      'ids',
      400,
      { forbiddenItems }
    )
  }

  return normalizedIds.map(id => jobMap.get(id))
}

async function batchDeleteTranslationJobs(body = {}, options = {}) {
  const ids = normalizeBatchDeleteIds(body)
  const jobs = await getBatchDeleteJobs(ids)
  const JobModel = getTranslationJobModel()

  // 展开家族：批量删除中包含家族 root/parent 时，连同其下全部子任务一起删除，避免孤儿。
  const deletionMap = new Map()
  for (const job of jobs) {
    deletionMap.set(String(job._id), job)
    const role = job.taskRelation && job.taskRelation.role
    if (role === TRANSLATION_JOB_TASK_ROLES.ROOT) {
      const familyMembers = await JobModel.find({
        'taskRelation.rootId': job._id
      }).lean()
      familyMembers.forEach(member => {
        deletionMap.set(String(member._id), member)
      })
    } else if (role === TRANSLATION_JOB_TASK_ROLES.PARENT) {
      const childMembers = await JobModel.find({
        'taskRelation.parentId': job._id
      }).lean()
      childMembers.forEach(member => {
        deletionMap.set(String(member._id), member)
      })
    }
  }
  const deletionTargets = Array.from(deletionMap.values())

  // 家族中存在执行中的子任务时，整批拒绝删除，避免破坏正在执行的任务。
  const runningTarget = deletionTargets.find(
    target => target.status === TRANSLATION_JOB_STATUS.RUNNING
  )
  if (runningTarget) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '所选任务的家族中存在执行中的子任务，不能删除',
      'ids',
      400
    )
  }

  const items = []
  for (const job of deletionTargets) {
    const cleanupResult = await cleanupJobCoverImageCacheBeforeDelete(job)
    const aiChunkCacheCleanupResult = await cleanupJobAiChunkCache(job)
    const aiLogCleanupResult = await cleanupJobAiLogDirectoryBeforeDelete(job)
    items.push({
      id: job._id,
      deleted: true,
      cleanupStatus: cleanupResult.cleanupStatus,
      aiChunkCacheCleanup: aiChunkCacheCleanupResult,
      aiLogCleanup: aiLogCleanupResult
    })
  }

  const deleteResult = await JobModel.deleteMany({
    _id: { $in: deletionTargets.map(job => job._id) }
  })
  if (!deleteResult || deleteResult.deletedCount !== deletionTargets.length) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  return {
    requestedCount: ids.length,
    deletedCount: items.length,
    items
  }
}

// 家族级不采纳：把编排父级（root/parent）名下所有“可人工采纳且仍在等待审核”的子任务一并标记为
// 不采纳。root 作用于其下全部子任务；parent 仅作用于自己名下的子任务。名词整理等不可采纳子任务
// 执行即生效，不参与采纳/不采纳。
async function rejectFamilyAdoptableChildren(
  orchestratorJob,
  adminSnapshot,
  reason
) {
  const JobModel = getTranslationJobModel()
  const rootObjectId = toObjectId(getJobFamilyRootId(orchestratorJob), 'rootId')
  if (!rootObjectId) {
    return
  }
  const now = new Date()
  const query = {
    'taskRelation.rootId': rootObjectId,
    'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.CHILD,
    'taskRelation.childKind': { $in: TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS },
    status: TRANSLATION_JOB_STATUS.WAITING_REVIEW
  }
  if (
    orchestratorJob.taskRelation &&
    orchestratorJob.taskRelation.role === TRANSLATION_JOB_TASK_ROLES.PARENT
  ) {
    query['taskRelation.parentId'] = toObjectId(orchestratorJob._id)
  }
  await JobModel.updateMany(query, {
    $set: {
      status: TRANSLATION_JOB_STATUS.REJECTED,
      'adoption.rejectedBy': adminSnapshot,
      'adoption.rejectedAt': now,
      'adoption.rejectReason': reason,
      updatedBy: adminSnapshot
    },
    $push: {
      'progress.recentLogs': {
        $each: [
          buildRecentLog(
            '父级任务被标记不采纳，子任务随之标记为不采纳',
            'info',
            'reject'
          )
        ],
        $slice: -MAX_RECENT_LOGS
      }
    }
  })
}

async function rejectTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertStatus(job, [TRANSLATION_JOB_STATUS.WAITING_REVIEW], '不采纳任务')

  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const reason = toTrimmedString(body.reason)
  const now = new Date()
  const role = job.taskRelation && job.taskRelation.role

  // 家族编排父级（root/parent）不采纳：必须级联把其下子任务一并标记为不采纳，再重算家族聚合状态。
  // 否则子任务仍停留在等待审核，家族会被重新派生回等待审核，父级的不采纳形同虚设。
  if (isOrchestratorRole(role)) {
    await rejectFamilyAdoptableChildren(job, adminSnapshot, reason)
    job.adoption.rejectedBy = adminSnapshot
    job.adoption.rejectedAt = now
    job.adoption.rejectReason = reason
    job.updatedBy = adminSnapshot
    appendLog(
      job,
      '用户已标记家族任务结果为不采纳，已级联标记其下子任务',
      'info',
      'reject'
    )
    await job.save()
    // 父级/根状态由子任务派生，级联后重算让父级正确派生为“不采纳”。
    await recomputeFamilyAggregateStatus(getJobFamilyRootId(job))
    const refreshedJob = await getMutableJob(body.id)
    return refreshedJob.toObject()
  }

  job.status = TRANSLATION_JOB_STATUS.REJECTED
  job.adoption.rejectedBy = adminSnapshot
  job.adoption.rejectedAt = now
  job.adoption.rejectReason = reason
  job.updatedBy = adminSnapshot
  job.runtime.finishedAt = job.runtime.finishedAt || now
  job.progress.percent = 100
  appendLog(job, '用户已标记任务结果为不采纳', 'info', 'reject')
  await job.save()
  // 不采纳的若是家族子任务，重算 parent/root 聚合状态，让父级/根状态随之更新。
  if (isFamilyChildJob(job)) {
    await recomputeFamilyAggregateStatus(getJobFamilyRootId(job))
  }
  return job.toObject()
}

function assertRetryAllowed(job) {
  if (!job.failure || !job.failure.errorCode) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '任务没有可重试的失败记录',
      'failure.errorCode',
      400
    )
  }

  if (!isFailureRetryableForUser(job.failure)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '任务失败已标记为不可重试',
      'failure.retryable',
      400
    )
  }

  if (TRANSLATION_JOB_FINAL_STATUS_VALUES.includes(job.status)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      `已进入业务结果状态的任务不能重试：${job.status}`,
      'status',
      400
    )
  }

  if (job.status === TRANSLATION_JOB_STATUS.WAITING_REVIEW) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '等待审核的任务不能重试',
      'status',
      400
    )
  }

  if (job.status === TRANSLATION_JOB_STATUS.RUNNING) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      '执行中的任务由后台 worker 自动恢复，不能手动重试',
      'status',
      400
    )
  }
}

async function retryTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertRetryAllowed(job)

  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  job.status = TRANSLATION_JOB_STATUS.PENDING
  job.queueControl.active = true
  job.queueControl.deferred = false
  job.runtime.lockedBy = ''
  job.runtime.workerId = ''
  job.runtime.lockedAt = null
  job.runtime.heartbeatAt = null
  job.runtime.leaseExpiresAt = null
  job.runtime.recovering = false
  job.runtime.attempts = 0
  job.runtime.finishedAt = null
  job.failure.failedStep = ''
  job.failure.errorCode = ''
  job.failure.errorMessage = ''
  job.failure.retryable = true
  job.failure.attempts = 0
  job.failure.stackSummary = ''
  job.failure.lastFailedAt = null
  job.progress.currentStep = '等待后台 worker 领取'
  job.progress.currentStage = 'pending'
  job.progress.percent = 0
  job.updatedBy = adminSnapshot
  appendLog(job, '用户已请求重试，任务重新进入队列', 'info', 'retry')
  await job.save()
  // 若重试的是家族中的子任务，重算 parent/root 聚合状态（被阻塞子任务会在该子任务
  // 成功完成后由 activateNextFamilyChild 自动放行）。
  if (isFamilyChildJob(job)) {
    const rootId = getJobFamilyRootId(job)
    if (rootId) {
      await recomputeFamilyAggregateStatus(rootId)
    }
  }
  return job.toObject()
}

function getErrorSummary(error) {
  const code = error && error.code ? error.code : ERROR_CODES.INTERNAL_ERROR
  const message = error && error.message ? error.message : String(error)
  let stackSummary = ''
  if (error && error.stack) {
    stackSummary = error.stack.split('\n').slice(0, 8).join('\n')
  }

  return {
    code,
    message,
    stackSummary
  }
}

function isRetryableError(error) {
  if (error && error.extra && error.extra.retryable === false) {
    return false
  }

  return true
}

function isFailureRetryableForUser(failure) {
  if (!failure || typeof failure !== 'object') {
    return false
  }
  if (failure.retryable === true) {
    return true
  }

  const errorCode = toTrimmedString(failure.errorCode)
  if (errorCode === ERROR_CODES.INTERNAL_ERROR) {
    return true
  }
  if (errorCode === ERROR_CODES.AI_TRANSLATION_FAILED) {
    return true
  }
  if (errorCode === ERROR_CODES.SERVICE_UNAVAILABLE) {
    return true
  }
  return false
}

function normalizeFailureForResponse(failure) {
  if (!failure || typeof failure !== 'object') {
    return failure || {}
  }
  return {
    ...failure,
    retryable: isFailureRetryableForUser(failure)
  }
}

function isManualRetryRequiredError(error) {
  return Boolean(
    error && error.extra && error.extra.manualRetryRequired === true
  )
}

function getFailedStep(options = {}) {
  const explicitStep = toTrimmedString(options.failedStep)
  if (explicitStep) {
    return explicitStep
  }
  const error = options.error
  const aiStepLabel = toTrimmedString(error?.extra?.aiStepLabel)
  if (aiStepLabel) {
    return aiStepLabel
  }
  return toTrimmedString(error?.extra?.aiStepKey)
}

function buildFailureProgressStep({
  errorMessage,
  autoRetry,
  manualRetryRequired,
  manualRetryAvailable,
  userStopped
}) {
  if (userStopped) {
    return '任务已被用户停止，可重新发起'
  }
  if (manualRetryRequired) {
    return `当前 AI 步骤连续重试失败，等待用户决定是否重试：${errorMessage}`
  }
  if (autoRetry) {
    return `任务执行失败，等待后台自动重试：${errorMessage}`
  }
  if (manualRetryAvailable) {
    return `任务自动重试已达上限，等待用户决定是否重试：${errorMessage}`
  }
  return `任务执行失败：${errorMessage}`
}

function getAttemptStatus(error) {
  if (error && error.code === ERROR_CODES.AI_TRANSLATION_CANCELLED) {
    return 'interrupted'
  }

  return 'failed'
}

function getLeaseExpiresAt(leaseMs) {
  return new Date(Date.now() + Number(leaseMs || 60000))
}

function buildClaimBaseParams(now, maxAttempts) {
  return {
    'queueControl.active': true,
    'queueControl.deferred': false,
    'runtime.attempts': { $lt: maxAttempts },
    'failure.retryable': { $ne: false },
    $or: [
      { status: TRANSLATION_JOB_STATUS.PENDING },
      {
        status: TRANSLATION_JOB_STATUS.RUNNING,
        $or: [
          { 'runtime.leaseExpiresAt': { $lt: now } },
          { 'runtime.leaseExpiresAt': null }
        ]
      }
    ]
  }
}

function buildClaimGuard(candidate, now, maxAttempts) {
  const guard = {
    _id: candidate._id,
    'queueControl.active': true,
    'queueControl.deferred': false,
    'runtime.attempts': { $lt: maxAttempts },
    'failure.retryable': { $ne: false }
  }

  if (candidate.status === TRANSLATION_JOB_STATUS.PENDING) {
    guard.status = TRANSLATION_JOB_STATUS.PENDING
    return guard
  }

  guard.status = TRANSLATION_JOB_STATUS.RUNNING
  guard.$or = [
    { 'runtime.leaseExpiresAt': { $lt: now } },
    { 'runtime.leaseExpiresAt': null }
  ]
  return guard
}

async function claimNextRunnableTranslationJob(options = {}) {
  const now = new Date()
  const maxAttempts = Number(options.maxAttempts || 3)
  const JobModel = getTranslationJobModel()
  const candidate = await JobModel.findOne(
    buildClaimBaseParams(now, maxAttempts)
  )
    .sort({ 'queueControl.priority': -1, createdAt: 1, _id: 1 })
    .lean()

  if (!candidate) {
    return null
  }

  const isRecovering = candidate.status === TRANSLATION_JOB_STATUS.RUNNING
  const attemptNo = Number(candidate.runtime?.attempts || 0) + 1
  const leaseExpiresAt = getLeaseExpiresAt(options.leaseMs)
  let currentStage = candidate.progress?.currentStage || 'claimed'
  if (!isRecovering) {
    currentStage = 'claimed'
  }
  const update = {
    $set: {
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.lockedBy': options.workerId,
      'runtime.workerId': options.workerId,
      'runtime.lockedAt': now,
      'runtime.startedAt': candidate.runtime?.startedAt || now,
      'runtime.heartbeatAt': now,
      'runtime.leaseExpiresAt': leaseExpiresAt,
      'runtime.recovering': isRecovering,
      'progress.currentStep': isRecovering
        ? '后台 worker 已恢复任务执行'
        : '后台 worker 已领取任务',
      'progress.currentStage': currentStage
    },
    $inc: {
      'runtime.attempts': 1
    },
    $push: {
      attempts: {
        attemptNo,
        workerId: options.workerId,
        startedAt: now,
        heartbeatAt: now,
        status: 'running',
        stage: currentStage
      },
      'progress.recentLogs': {
        $each: [
          buildRecentLog(
            isRecovering
              ? '任务租约已恢复并重新领取'
              : '任务已被后台 worker 领取',
            'info',
            'claim'
          )
        ],
        $slice: -MAX_RECENT_LOGS
      }
    }
  }

  if (isRecovering) {
    update.$set['runtime.lastInterruptedAt'] = now
    update.$set['runtime.interruptReason'] = '任务租约过期后被新 worker 恢复'
  }

  return await JobModel.findOneAndUpdate(
    buildClaimGuard(candidate, now, maxAttempts),
    update,
    { new: true }
  ).lean()
}

async function renewTranslationJobLease(options = {}) {
  const JobModel = getTranslationJobModel()
  const now = new Date()
  const leaseExpiresAt = getLeaseExpiresAt(options.leaseMs)
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    {
      $set: {
        'runtime.heartbeatAt': now,
        'runtime.leaseExpiresAt': leaseExpiresAt,
        'attempts.$[attempt].heartbeatAt': now
      }
    },
    {
      arrayFilters: [
        {
          'attempt.attemptNo': Number(options.attemptNo),
          'attempt.workerId': options.workerId,
          'attempt.status': 'running'
        }
      ]
    }
  )

  return result.modifiedCount === 1 || result.matchedCount === 1
}

async function updateRunningTranslationJobProgress(options = {}) {
  const progress = normalizeObject(options.progress, 'progress')
  const now = new Date()
  const setData = {}
  const maxData = {}
  const pushData = {}
  if (progress.currentStep !== undefined) {
    setData['progress.currentStep'] = toTrimmedString(progress.currentStep)
  }
  if (progress.currentStage !== undefined) {
    setData['progress.currentStage'] = toTrimmedString(progress.currentStage)

    function normalizeWorkflowEventCreatedAt(value, fallbackDate) {
      const text = toTrimmedString(value)
      if (!text) {
        return fallbackDate
      }
      const parsedDate = new Date(text)
      if (Number.isNaN(parsedDate.getTime())) {
        return fallbackDate
      }
      return parsedDate
    }
  }
  if (progress.totalSteps !== undefined) {
    setData['progress.totalSteps'] = normalizeOptionalNumber(
      progress.totalSteps,
      'progress.totalSteps'
    )
  }
  if (progress.completedSteps !== undefined) {
    setData['progress.completedSteps'] = normalizeOptionalNumber(
      progress.completedSteps,
      'progress.completedSteps'
    )
  }
  if (progress.percent !== undefined) {
    const percent = normalizeOptionalNumber(
      progress.percent,
      'progress.percent'
    )
    if (percent < 0 || percent > 100) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        'progress.percent 必须在 0 到 100 之间',
        'progress.percent',
        400
      )
    }
    maxData['progress.percent'] = percent
  }

  const logMessage = toTrimmedString(
    progress.logMessage || progress.currentStep
  )
  const update = {}
  if (Object.keys(setData).length > 0) {
    update.$set = setData
  }
  if (Object.keys(maxData).length > 0) {
    update.$max = maxData
  }
  if (logMessage) {
    pushData['progress.recentLogs'] = {
      $each: [
        buildRecentLog(
          logMessage,
          toTrimmedString(progress.logLevel) || 'info',
          toTrimmedString(progress.currentStage)
        )
      ],
      $slice: -MAX_RECENT_LOGS
    }
  }
  const aiWorkflow = normalizeObject(progress.aiWorkflow, 'progress.aiWorkflow')
  const aiWorkflowStepKey = toTrimmedString(aiWorkflow.stepKey)
  if (aiWorkflowStepKey) {
    const aiWorkflowCreatedAt = normalizeWorkflowEventCreatedAt(
      aiWorkflow.occurredAt,
      now
    )
    const aiWorkflowEvent = {
      stepKey: aiWorkflowStepKey,
      stepLabel: toTrimmedString(aiWorkflow.stepLabel),
      status: toTrimmedString(aiWorkflow.status) || 'running',
      message: logMessage,
      stage: toTrimmedString(progress.currentStage),
      attemptNo: normalizeOptionalNumber(aiWorkflow.attemptNo, 'attemptNo'),
      nextAttemptNo: normalizeOptionalNumber(
        aiWorkflow.nextAttemptNo,
        'nextAttemptNo'
      ),
      maxAttempts: normalizeOptionalNumber(
        aiWorkflow.maxAttempts,
        'maxAttempts'
      ),
      errorCode: toTrimmedString(aiWorkflow.errorCode),
      errorMessage: toTrimmedString(aiWorkflow.errorMessage),
      sourceLanguageCode: toTrimmedString(aiWorkflow.sourceLanguageCode),
      targetLanguageCode: toTrimmedString(aiWorkflow.targetLanguageCode),
      createdAt: aiWorkflowCreatedAt
    }
    setData['progress.stageState.aiWorkflow.current'] = aiWorkflowEvent
    pushData['progress.stageState.aiWorkflow.events'] = {
      $each: [aiWorkflowEvent],
      $slice: -120
    }
  }
  if (Object.keys(pushData).length > 0) {
    update.$push = pushData
  }

  const JobModel = getTranslationJobModel()
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    update
  )

  if (result.matchedCount !== 1) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '任务进度更新失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }
}

async function saveRunningTranslationJobCheckpoint(options = {}) {
  const checkpoint = normalizeObject(options.checkpoint, 'checkpoint')
  const stage = toTrimmedString(checkpoint.stage)
  if (!stage) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'checkpoint.stage 不能为空',
      'checkpoint.stage',
      400
    )
  }

  const JobModel = getTranslationJobModel()
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    {
      $set: {
        'progress.currentStage': stage,
        'progress.stageState.currentCheckpoint': normalizeObject(
          checkpoint.stageState,
          'checkpoint.stageState'
        )
      },
      $addToSet: {
        'progress.completedStages': stage
      },
      $push: {
        'progress.checkpoints': {
          stage,
          completedAt: new Date(),
          stateHash: toTrimmedString(checkpoint.stateHash),
          stateSummary: normalizeObject(
            checkpoint.stateSummary,
            'checkpoint.stateSummary'
          )
        },
        'progress.recentLogs': {
          $each: [buildRecentLog(`阶段检查点已保存：${stage}`, 'info', stage)],
          $slice: -MAX_RECENT_LOGS
        }
      }
    }
  )

  if (result.matchedCount !== 1) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '任务检查点保存失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }
}

async function readRunningTranslationJobAiChunkCache(options = {}) {
  const cacheOptions = normalizeAiChunkCacheOptions(options.cacheOptions)
  if (!cacheOptions) {
    return null
  }

  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    {
      _id: 1
    }
  ).lean()

  if (!job) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '任务正文分片缓存读取失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }

  return await aiLogFileService.readTranslationJobAiChunkCacheRecordByOptions({
    jobId: cacheOptions.cacheKey,
    cacheOptions
  })
}

async function saveRunningTranslationJobAiChunkCache(options = {}) {
  const cacheRecord = normalizeObject(options.cacheRecord, 'cacheRecord')
  const cacheOptions = normalizeAiChunkCacheOptions(cacheRecord)
  if (!cacheOptions) {
    return null
  }

  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne({
    _id: toObjectId(options.id, 'id', true),
    status: TRANSLATION_JOB_STATUS.RUNNING,
    'runtime.workerId': options.workerId,
    'runtime.attempts': Number(options.attemptNo)
  })

  if (!job) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '任务正文分片缓存写入失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }

  job.progress = normalizeObject(job.progress, 'progress')
  const stageState = normalizeObject(
    job.progress.stageState,
    'progress.stageState'
  )
  const cacheState = normalizeAiChunkCacheState(stageState.aiChunkCache)
  const nextRecords = cacheState.records.filter(record => {
    return !isSameAiChunkCacheRecord(record, cacheOptions)
  })
  const cacheFileRecord =
    await aiLogFileService.writeTranslationJobAiChunkCacheRecord({
      jobId: cacheOptions.cacheKey,
      cacheOptions,
      cacheRecord: buildAiChunkCacheRecord(cacheRecord, cacheOptions),
      schema: AI_CHUNK_CACHE_SCHEMA,
      version: AI_CHUNK_CACHE_VERSION
    })
  nextRecords.push(cacheFileRecord)
  cacheState.records = nextRecords
  cacheState.updatedAt = new Date()
  stageState.aiChunkCache = cacheState
  job.progress.stageState = stageState
  if (typeof job.markModified === 'function') {
    job.markModified('progress.stageState')
  }
  await job.save()

  return {
    saved: true,
    cacheKey: cacheOptions.cacheKey,
    scopeKey: cacheOptions.scopeKey,
    chunkIndex: cacheOptions.chunkIndex
  }
}

async function clearTranslationJobAiChunkCacheById(id) {
  const JobModel = getTranslationJobModel()
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(id, 'id', true)
    },
    {
      $unset: {
        'progress.stageState.aiChunkCache': ''
      }
    }
  )
  const fileCleanup = await aiLogFileService.deleteTranslationJobAiChunkCache(
    String(id || '')
  )

  return {
    deleted: result.matchedCount === 1,
    modifiedCount: result.modifiedCount || 0,
    fileCleanup
  }
}

async function tryClearTranslationJobAiChunkCacheById(id) {
  try {
    return await clearTranslationJobAiChunkCacheById(id)
  } catch (error) {
    return {
      deleted: false,
      errorMessage: error && error.message ? error.message : String(error)
    }
  }
}

function stripLanguageResultAiJsonLogs(languageResults) {
  if (!Array.isArray(languageResults)) {
    return []
  }

  return languageResults.map(item => {
    const nextItem = cloneSerializableValue(item)
    const nestedLogs = nextItem?.result?.aiJsonLogs
    if (nextItem?.result && Array.isArray(nestedLogs)) {
      nextItem.result.aiJsonLogCount = nestedLogs.length
      nextItem.result.aiJsonLogs = []
    }
    return nextItem
  })
}

async function completeRunningTranslationJobForReview(options = {}) {
  const resultData = normalizeObject(options.result, 'result')
  if (!resultData.payload || !Array.isArray(resultData.previewEntries)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      '后台翻译结果不完整，不能进入等待审核',
      'result',
      502
    )
  }

  const now = new Date()
  const aiJsonLogs = translationAiJsonLogService.sanitizeAiJsonValue(
    resultData.aiJsonLogs || []
  )
  const aiJsonLogStorage = await aiLogFileService.writeTranslationJobAiJsonLogs(
    {
      jobId: String(options.id || ''),
      logs: aiJsonLogs
    }
  )
  const isProperNounOrganizeJob =
    options.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE
  let nextStatus = TRANSLATION_JOB_STATUS.WAITING_REVIEW
  let finalProgressStep = '翻译结果已完成，等待人工审核'
  let finalProgressStage = 'FinalizeReview'
  let finalLogMessage = '翻译结果已完整保存，进入等待审核'
  if (isProperNounOrganizeJob) {
    nextStatus = TRANSLATION_JOB_STATUS.FULLY_ADOPTED
    finalProgressStep = '文章名词整理已完成，已自动按采纳处理'
    finalProgressStage = 'FinalizeProperNounOrganize'
    finalLogMessage = '文章名词整理结果已保存，已自动按采纳处理'
  }
  const updateSet = {
    status: nextStatus,
    'queueControl.active': false,
    'runtime.lockedBy': '',
    'runtime.workerId': '',
    'runtime.finishedAt': now,
    'runtime.heartbeatAt': now,
    'runtime.leaseExpiresAt': null,
    'runtime.recovering': false,
    'result.payload': resultData.payload,
    'result.previewEntries': resultData.previewEntries,
    'result.warningList': resultData.warningList || [],
    'result.aiSkipList': resultData.aiSkipList || [],
    'result.aiJsonLogs': [],
    'result.aiJsonLogStorage': aiJsonLogStorage,
    'result.aiJsonLogCount': aiJsonLogs.length,
    'result.relatedResults': resultData.relatedResults || [],
    'result.childTaskResults': resultData.childTaskResults || [],
    'result.languageResults': stripLanguageResultAiJsonLogs(
      resultData.languageResults || []
    ),
    'result.translationPostMap': resultData.translationPostMap || {},
    'result.coverImageArtifacts':
      translationAiJsonLogService.sanitizeAiJsonValue(
        resultData.coverImageArtifacts || []
      ),
    'result.coverImageGenerationMap':
      translationAiJsonLogService.sanitizeAiJsonValue(
        resultData.coverImageGenerationMap || {}
      ),
    'result.coverImageRecognitionMap':
      translationAiJsonLogService.sanitizeAiJsonValue(
        resultData.coverImageRecognitionMap || {}
      ),
    'result.sourceSnapshotId': toObjectId(
      resultData.sourceSnapshotId,
      'result.sourceSnapshotId'
    ),
    'result.aiUsage': resultData.aiUsage || {},
    'result.model': resultData.model || '',
    'result.validation': resultData.validation || null,
    'result.completedAt': now,
    'progress.currentStep': finalProgressStep,
    'progress.currentStage': finalProgressStage,
    'progress.percent': 100,
    'attempts.$[attempt].status': 'success',
    'attempts.$[attempt].finishedAt': now,
    'attempts.$[attempt].stage': finalProgressStage
  }
  if (isProperNounOrganizeJob) {
    updateSet['adoption.adoptedAt'] = now
    updateSet['adoption.lastApplyBatchId'] = `auto:${String(options.id || '')}`
  }
  const JobModel = getTranslationJobModel()
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    {
      $set: updateSet,
      $push: {
        'progress.recentLogs': {
          $each: [buildRecentLog(finalLogMessage, 'info', finalProgressStage)],
          $slice: -MAX_RECENT_LOGS
        }
      }
    },
    {
      arrayFilters: [
        {
          'attempt.attemptNo': Number(options.attemptNo),
          'attempt.workerId': options.workerId,
          'attempt.status': 'running'
        }
      ]
    }
  )

  if (result.matchedCount !== 1) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '任务完成写入失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }
  const hasChildTaskResults =
    Array.isArray(resultData.childTaskResults) &&
    resultData.childTaskResults.length > 0
  const shouldKeepAiChunkCache =
    options.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT &&
    hasChildTaskResults
  if (!shouldKeepAiChunkCache) {
    await tryClearTranslationJobAiChunkCacheById(String(options.id || ''))
  }

  // 家族编排：若本任务是子任务，成功完成后放行下一个子任务，并重算家族聚合状态。
  await advanceFamilyAfterChildSettled(String(options.id || ''), {
    activateNext: true
  })
}

// 子任务进入终态（成功/失败/阻塞）后推进家族：放行下一个、并重算 parent/root 聚合状态。
async function advanceFamilyAfterChildSettled(jobId, options = {}) {
  const JobModel = getTranslationJobModel()
  const job = await JobModel.findById(toObjectId(jobId, 'id', true))
    .select('taskRelation')
    .lean()
  if (!isFamilyChildJob(job)) {
    return
  }
  const rootId = getJobFamilyRootId(job)
  if (!rootId) {
    return
  }
  if (options.activateNext === true) {
    await activateNextFamilyChild(rootId)
  }
  await recomputeFamilyAggregateStatus(rootId)
}

async function failRunningTranslationJob(options = {}) {
  const errorSummary = getErrorSummary(options.error)
  const now = new Date()
  const maxAttempts = Number(options.maxAttempts || 3)
  const currentAttemptNo = Number(options.attemptNo || 0)
  const manualRetryRequired = isManualRetryRequiredError(options.error)
  let retryable = isRetryableError(options.error)
  let autoRetry = retryable
  if (manualRetryRequired) {
    retryable = true
    autoRetry = false
  } else if (!retryable) {
    autoRetry = false
  } else if (currentAttemptNo >= maxAttempts) {
    retryable = true
    autoRetry = false
  }
  const manualRetryAvailable = retryable && !autoRetry
  // 用户主动停止：以"已停止、可重新发起"的清晰文案呈现，而不是看似仍在断开连接。
  const userStopped =
    errorSummary.code === ERROR_CODES.AI_TRANSLATION_CANCELLED &&
    manualRetryRequired
  const failedStep = getFailedStep(options)
  const progressStep = buildFailureProgressStep({
    errorMessage: errorSummary.message,
    autoRetry,
    manualRetryRequired,
    manualRetryAvailable,
    userStopped
  })

  const JobModel = getTranslationJobModel()
  await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': currentAttemptNo
    },
    {
      $set: {
        status: autoRetry
          ? TRANSLATION_JOB_STATUS.RUNNING
          : TRANSLATION_JOB_STATUS.FAILED,
        'queueControl.active': autoRetry,
        'runtime.lockedBy': '',
        'runtime.workerId': '',
        'runtime.finishedAt': autoRetry ? null : now,
        'runtime.heartbeatAt': now,
        'runtime.leaseExpiresAt': new Date(now.getTime() - 1000),
        'runtime.recovering': autoRetry,
        'runtime.lastInterruptedAt': now,
        'runtime.interruptReason': errorSummary.message,
        'failure.failedStep': failedStep,
        'failure.errorCode': errorSummary.code,
        'failure.errorMessage': errorSummary.message,
        'failure.stackSummary': errorSummary.stackSummary,
        'failure.retryable': retryable,
        'failure.attempts': currentAttemptNo,
        'failure.lastFailedAt': now,
        'progress.currentStage': 'Failure',
        'progress.currentStep': progressStep,
        'attempts.$[attempt].status': getAttemptStatus(options.error),
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].error': errorSummary
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              `任务执行失败：${errorSummary.message}`,
              'error',
              'failure'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    },
    {
      arrayFilters: [
        {
          'attempt.attemptNo': currentAttemptNo,
          'attempt.workerId': options.workerId,
          'attempt.status': 'running'
        }
      ]
    }
  )

  // 家族编排：若本任务是子任务且已进入终态失败（非自动重试），把其后未开始的子任务
  // 标记为 BLOCKED，并重算 parent/root 聚合状态。
  if (!autoRetry) {
    const job = await JobModel.findById(toObjectId(options.id, 'id', true))
      .select('taskRelation')
      .lean()
    if (isFamilyChildJob(job)) {
      const rootId = getJobFamilyRootId(job)
      if (rootId) {
        await blockPendingFamilyChildren(
          rootId,
          options.id,
          errorSummary.message
        )
        await recomputeFamilyAggregateStatus(rootId)
      }
    }
  }
}

async function markExpiredRunningTranslationJobsRecovering(options = {}) {
  const now = new Date()
  const maxAttempts = Number(options.maxAttempts || 3)
  const JobModel = getTranslationJobModel()
  const expiredLeaseCondition = [
    { 'runtime.leaseExpiresAt': { $lt: now } },
    { 'runtime.leaseExpiresAt': null }
  ]
  await JobModel.updateMany(
    {
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'queueControl.active': false,
      $or: expiredLeaseCondition
    },
    {
      $set: {
        status: TRANSLATION_JOB_STATUS.FAILED,
        'runtime.lockedBy': '',
        'runtime.workerId': '',
        'runtime.finishedAt': now,
        'runtime.heartbeatAt': now,
        'runtime.leaseExpiresAt': null,
        'runtime.recovering': false,
        'runtime.lastInterruptedAt': now,
        'runtime.interruptReason': '任务已被用户停止',
        'failure.failedStep': 'stop',
        'failure.errorCode': ERROR_CODES.AI_TRANSLATION_CANCELLED,
        'failure.errorMessage': '任务已被用户停止，可重新发起',
        'failure.stackSummary': '',
        'failure.retryable': true,
        'failure.lastFailedAt': now,
        'progress.currentStage': 'Failure',
        'progress.currentStep': '任务已被用户停止，可重新发起',
        'attempts.$[attempt].status': 'interrupted',
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].error': {
          code: ERROR_CODES.AI_TRANSLATION_CANCELLED,
          message: '任务已被用户停止，可重新发起',
          stackSummary: ''
        }
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '停止请求在服务重启后确认完成，任务已停止，可重新发起',
              'warn',
              'stop'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    },
    {
      arrayFilters: [{ 'attempt.status': 'running' }]
    }
  )

  await JobModel.updateMany(
    {
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'queueControl.active': true,
      $or: expiredLeaseCondition,
      $and: [
        {
          $or: [
            { 'runtime.attempts': { $gte: maxAttempts } },
            { 'failure.retryable': false }
          ]
        }
      ]
    },
    {
      $set: {
        status: TRANSLATION_JOB_STATUS.FAILED,
        'queueControl.active': false,
        'runtime.lockedBy': '',
        'runtime.workerId': '',
        'runtime.finishedAt': now,
        'runtime.heartbeatAt': now,
        'runtime.leaseExpiresAt': null,
        'runtime.recovering': false,
        'runtime.lastInterruptedAt': now,
        'runtime.interruptReason': '任务恢复次数已达到上限',
        'failure.failedStep': 'recover',
        'failure.errorCode': ERROR_CODES.AI_TRANSLATION_FAILED,
        'failure.errorMessage': '任务恢复次数已达到上限，已停止自动重试',
        'failure.stackSummary': '',
        'failure.retryable': false,
        'failure.attempts': maxAttempts,
        'failure.lastFailedAt': now,
        'progress.currentStage': 'Failure',
        'progress.currentStep': '任务恢复次数已达到上限，已停止自动重试',
        'attempts.$[attempt].status': 'failed',
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].error': {
          code: ERROR_CODES.AI_TRANSLATION_FAILED,
          message: '任务恢复次数已达到上限，已停止自动重试',
          stackSummary: ''
        }
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '任务恢复次数已达到上限，已停止自动重试',
              'error',
              'recover'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    },
    {
      arrayFilters: [{ 'attempt.status': 'running' }]
    }
  )

  return await JobModel.updateMany(
    {
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'queueControl.active': true,
      'runtime.attempts': { $lt: maxAttempts },
      'failure.retryable': { $ne: false },
      $or: expiredLeaseCondition
    },
    {
      $set: {
        'runtime.recovering': true,
        'runtime.lastInterruptedAt': now,
        'runtime.interruptReason': '服务启动或定时扫描发现任务租约已过期'
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog('任务租约已过期，等待恢复执行', 'warn', 'recover')
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    }
  )
}

// ===========================================================================
// 家族（root/parent/child）编排原语
// ---------------------------------------------------------------------------
// 设计要点：
// - 编排节点（root/parent）本身不执行 AI，永不进入 RUNNING 状态，因此不会被
//   markExpiredRunningTranslationJobsRecovering 误判失败，也不会被 worker 领取
//   （claim 仅领取 queueControl.active=true 的任务）。
// - root 在“规划阶段”是一个普通可执行任务（PENDING→RUNNING），规划完成后调用
//   finalizeOrchestratorPlanning 转为编排态（active=false，状态由子任务聚合派生）。
// - child 严格按全家族顺序执行：仅最靠前、尚未开始的 child 处于 active=true。
//   某 child 成功后通过 activateNextFamilyChild 放行下一个；某 child 终态失败后
//   通过 blockPendingFamilyChildren 把其后未开始的 child 标记 BLOCKED。
// ===========================================================================

function getJobFamilyRootId(job) {
  const rootId =
    job &&
    job.taskRelation &&
    job.taskRelation.rootId &&
    job.taskRelation.rootId.toString
      ? job.taskRelation.rootId.toString()
      : ''
  if (rootId) {
    return rootId
  }
  return String(job && job._id ? job._id : '')
}

function isOrchestratorRole(role) {
  return TRANSLATION_JOB_ORCHESTRATOR_ROLE_VALUES.includes(role)
}

function isChildRole(role) {
  return role === TRANSLATION_JOB_TASK_ROLES.CHILD
}

// 仅"带 childKind 的家族子任务"才参与新的顺序编排；旧的相关文章 child（无 childKind）
// 仍按各自独立的方式执行与审核，不走家族放行/阻塞/聚合逻辑。
function isFamilyChildJob(job) {
  const relation = job && job.taskRelation
  if (!relation || relation.role !== TRANSLATION_JOB_TASK_ROLES.CHILD) {
    return false
  }
  return Boolean(relation.childKind)
}

// 子任务在“全家族顺序”中的排序键：先按所属 parent 的 orderIndex，再按自身 orderIndex。
function buildFamilyChildOrderKey(child, parentOrderMap) {
  const parentIdText =
    child.taskRelation && child.taskRelation.parentId
      ? String(child.taskRelation.parentId)
      : ''
  const parentOrder = Number(parentOrderMap.get(parentIdText) || 0)
  const childOrder = Number(
    (child.taskRelation && child.taskRelation.orderIndex) || 0
  )
  return parentOrder * 100000 + childOrder
}

async function loadFamilyJobs(rootId) {
  const JobModel = getTranslationJobModel()
  const rootObjectId = toObjectId(rootId, 'rootId')
  if (!rootObjectId) {
    return []
  }
  return await JobModel.find({
    $or: [{ _id: rootObjectId }, { 'taskRelation.rootId': rootObjectId }]
  }).lean()
}

function splitFamilyJobs(familyJobs, rootId) {
  const rootIdText = String(rootId || '')
  let root = null
  const parents = []
  const children = []
  familyJobs.forEach(job => {
    const role = job.taskRelation && job.taskRelation.role
    if (String(job._id) === rootIdText) {
      root = job
      return
    }
    if (role === TRANSLATION_JOB_TASK_ROLES.PARENT) {
      parents.push(job)
      return
    }
    if (role === TRANSLATION_JOB_TASK_ROLES.CHILD) {
      children.push(job)
    }
  })
  return { root, parents, children }
}

function buildParentOrderMap(parents) {
  const map = new Map()
  parents.forEach(parent => {
    map.set(
      String(parent._id),
      Number((parent.taskRelation && parent.taskRelation.orderIndex) || 0)
    )
  })
  return map
}

// 放行下一个待执行子任务：在全家族顺序中找到第一个尚未开始（PENDING 或 BLOCKED 且
// 未激活）的子任务并激活它（active=true、清除阻塞标记）。每次只放行一个，保证严格顺序。
async function activateNextFamilyChild(rootId) {
  const familyJobs = await loadFamilyJobs(rootId)
  const { parents, children } = splitFamilyJobs(familyJobs, rootId)
  const parentOrderMap = buildParentOrderMap(parents)
  const sortedChildren = children.slice().sort((a, b) => {
    return (
      buildFamilyChildOrderKey(a, parentOrderMap) -
      buildFamilyChildOrderKey(b, parentOrderMap)
    )
  })
  const nextChild = sortedChildren.find(child => {
    const active = Boolean(
      child.queueControl && child.queueControl.active === true
    )
    const status = child.status
    const notStarted =
      status === TRANSLATION_JOB_STATUS.PENDING ||
      status === TRANSLATION_JOB_STATUS.BLOCKED
    return notStarted && !active
  })
  if (!nextChild) {
    return { activated: false }
  }
  const now = new Date()
  const JobModel = getTranslationJobModel()
  await JobModel.updateOne(
    { _id: nextChild._id },
    {
      $set: {
        status: TRANSLATION_JOB_STATUS.PENDING,
        'queueControl.active': true,
        'queueControl.deferred': false,
        'taskRelation.blockedByJobId': null,
        'taskRelation.blockedReason': '',
        'taskRelation.blockedAt': null,
        'progress.currentStep': '前序子任务已完成，等待后台 worker 领取',
        'progress.currentStage': 'pending'
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '前序子任务完成，本子任务已放行进入队列',
              'info',
              'family'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    }
  )
  return { activated: true, childId: String(nextChild._id) }
}

// 某子任务终态失败：把同家族中所有尚未开始的子任务标记为 BLOCKED（已阻塞），不删除。
async function blockPendingFamilyChildren(rootId, blockedByJobId, reason) {
  const JobModel = getTranslationJobModel()
  const rootObjectId = toObjectId(rootId, 'rootId')
  if (!rootObjectId) {
    return { blockedCount: 0 }
  }
  const now = new Date()
  const result = await JobModel.updateMany(
    {
      'taskRelation.rootId': rootObjectId,
      'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.CHILD,
      status: TRANSLATION_JOB_STATUS.PENDING
    },
    {
      $set: {
        status: TRANSLATION_JOB_STATUS.BLOCKED,
        'queueControl.active': false,
        'taskRelation.blockedByJobId': toObjectId(
          blockedByJobId,
          'blockedByJobId'
        ),
        'taskRelation.blockedReason': toTrimmedString(reason),
        'taskRelation.blockedAt': now,
        'progress.currentStep': '前序子任务失败，本子任务已被阻塞',
        'progress.currentStage': 'Blocked'
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              `前序子任务失败，本子任务已被阻塞：${toTrimmedString(reason)}`,
              'warn',
              'family'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    }
  )
  return { blockedCount: result.modifiedCount || 0 }
}

// 由一组“子任务状态”派生编排节点（parent/root）的聚合状态。
function deriveOrchestratorStatus(childStates) {
  if (!Array.isArray(childStates) || childStates.length === 0) {
    return TRANSLATION_JOB_STATUS.PENDING
  }
  const statuses = childStates.map(item => item.status)
  if (statuses.includes(TRANSLATION_JOB_STATUS.FAILED)) {
    return TRANSLATION_JOB_STATUS.FAILED
  }
  // 只要还有子任务在进行中（待领取/执行中），家族整体视为进行中，
  // 优先于 BLOCKED（重试失败子任务后，被阻塞子任务会随之被放行）。
  if (
    statuses.includes(TRANSLATION_JOB_STATUS.PENDING) ||
    statuses.includes(TRANSLATION_JOB_STATUS.RUNNING)
  ) {
    return TRANSLATION_JOB_STATUS.PENDING
  }
  if (statuses.includes(TRANSLATION_JOB_STATUS.BLOCKED)) {
    return TRANSLATION_JOB_STATUS.BLOCKED
  }
  // 至此所有子任务都处于审核/采纳/不采纳等终态。
  const adoptableStates = childStates.filter(item => item.adoptable === true)
  if (adoptableStates.length === 0) {
    return TRANSLATION_JOB_STATUS.FULLY_ADOPTED
  }
  const adoptableStatuses = adoptableStates.map(item => item.status)
  if (adoptableStatuses.includes(TRANSLATION_JOB_STATUS.WAITING_REVIEW)) {
    return TRANSLATION_JOB_STATUS.WAITING_REVIEW
  }
  const allFullyAdopted = adoptableStatuses.every(
    status => status === TRANSLATION_JOB_STATUS.FULLY_ADOPTED
  )
  if (allFullyAdopted) {
    return TRANSLATION_JOB_STATUS.FULLY_ADOPTED
  }
  const allRejected = adoptableStatuses.every(
    status => status === TRANSLATION_JOB_STATUS.REJECTED
  )
  if (allRejected) {
    return TRANSLATION_JOB_STATUS.REJECTED
  }
  return TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED
}

function isAdoptableChildJob(job) {
  const childKind = job.taskRelation && job.taskRelation.childKind
  return TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS.includes(childKind)
}

function buildChildStatsSummary(childJobs) {
  const summary = {
    total: childJobs.length,
    pending: 0,
    running: 0,
    waitingReview: 0,
    failed: 0,
    blocked: 0,
    rejected: 0,
    partialAdopted: 0,
    fullyAdopted: 0
  }
  childJobs.forEach(child => {
    switch (child.status) {
      case TRANSLATION_JOB_STATUS.PENDING:
        summary.pending += 1
        break
      case TRANSLATION_JOB_STATUS.RUNNING:
        summary.running += 1
        break
      case TRANSLATION_JOB_STATUS.WAITING_REVIEW:
        summary.waitingReview += 1
        break
      case TRANSLATION_JOB_STATUS.FAILED:
        summary.failed += 1
        break
      case TRANSLATION_JOB_STATUS.BLOCKED:
        summary.blocked += 1
        break
      case TRANSLATION_JOB_STATUS.REJECTED:
        summary.rejected += 1
        break
      case TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED:
        summary.partialAdopted += 1
        break
      case TRANSLATION_JOB_STATUS.FULLY_ADOPTED:
        summary.fullyAdopted += 1
        break
      default:
        break
    }
  })
  return summary
}

// 由聚合状态与子任务统计，构建编排节点（root/parent）的进度展示文案与百分比。
function buildOrchestratorProgress(derivedStatus, childStats) {
  const total = Number(childStats.total || 0)
  const settled =
    Number(childStats.waitingReview || 0) +
    Number(childStats.rejected || 0) +
    Number(childStats.partialAdopted || 0) +
    Number(childStats.fullyAdopted || 0) +
    Number(childStats.failed || 0) +
    Number(childStats.blocked || 0)
  let percent = 0
  if (total > 0) {
    // 单调进度：把"规划完成"算作 1 个已完成单元（settled+1）/（total+1），保证规划完成后是
    // 一个小的正值，并随子任务完成单调上升，避免出现"规划 10% → 子任务开始 0%"的进度倒退；
    // 进行中阶段封顶 99%，全部进入终态时由下方分支显式置 100%。
    percent = Math.min(Math.round(((settled + 1) / (total + 1)) * 100), 99)
  }
  let currentStage = 'Orchestrating'
  let currentStep = '正在按顺序执行子任务'
  switch (derivedStatus) {
    case TRANSLATION_JOB_STATUS.WAITING_REVIEW:
      currentStage = 'FinalizeReview'
      currentStep = `全部子任务已完成，等待人工审核（共 ${total} 个子任务）`
      percent = 100
      break
    case TRANSLATION_JOB_STATUS.FAILED:
      currentStage = 'Failure'
      currentStep = `存在执行失败的子任务（失败 ${Number(
        childStats.failed || 0
      )} 个，阻塞 ${Number(childStats.blocked || 0)} 个），请重试失败子任务`
      break
    case TRANSLATION_JOB_STATUS.BLOCKED:
      currentStage = 'Blocked'
      currentStep = `存在被阻塞的子任务（${Number(
        childStats.blocked || 0
      )} 个），请先处理失败子任务`
      break
    case TRANSLATION_JOB_STATUS.FULLY_ADOPTED:
      currentStage = 'FinalizeReview'
      currentStep = `全部子任务已采纳（共 ${total} 个子任务）`
      percent = 100
      break
    case TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED:
      currentStage = 'FinalizeReview'
      currentStep = `部分子任务已采纳（已采纳 ${Number(
        childStats.fullyAdopted || 0
      )} 个，待审核 ${Number(childStats.waitingReview || 0)} 个）`
      percent = 100
      break
    case TRANSLATION_JOB_STATUS.REJECTED:
      currentStage = 'FinalizeReview'
      currentStep = '全部子任务已标记不采纳'
      percent = 100
      break
    default:
      currentStage = 'Orchestrating'
      currentStep = `正在按顺序执行子任务（已完成 ${settled}/${total}）`
      break
  }
  return { currentStage, currentStep, percent }
}

// 重算整个家族的聚合状态：先由各 child 派生其 parent 状态，再由各 parent 派生 root 状态。
async function recomputeFamilyAggregateStatus(rootId) {
  const familyJobs = await loadFamilyJobs(rootId)
  const { root, parents, children } = splitFamilyJobs(familyJobs, rootId)
  if (!root && parents.length === 0) {
    return { updated: false }
  }
  const JobModel = getTranslationJobModel()
  const now = new Date()
  const childrenByParent = new Map()
  children.forEach(child => {
    const parentIdText =
      child.taskRelation && child.taskRelation.parentId
        ? String(child.taskRelation.parentId)
        : ''
    if (!childrenByParent.has(parentIdText)) {
      childrenByParent.set(parentIdText, [])
    }
    childrenByParent.get(parentIdText).push(child)
  })

  const parentDerivedStates = []
  for (const parent of parents) {
    const parentChildren = childrenByParent.get(String(parent._id)) || []
    const childStates = parentChildren.map(child => ({
      status: child.status,
      adoptable: isAdoptableChildJob(child)
    }))
    const derivedStatus = deriveOrchestratorStatus(childStates)
    const childStats = buildChildStatsSummary(parentChildren)
    const progress = buildOrchestratorProgress(derivedStatus, childStats)
    await JobModel.updateOne(
      { _id: parent._id },
      {
        $set: {
          status: derivedStatus,
          'queueControl.active': false,
          'taskRelation.childStats': childStats,
          'progress.currentStage': progress.currentStage,
          'progress.currentStep': progress.currentStep,
          'progress.percent': progress.percent
        }
      }
    )
    parentDerivedStates.push({ status: derivedStatus, adoptable: true })
  }

  if (root) {
    let rootChildStates = parentDerivedStates
    if (parents.length === 0) {
      // 没有 parent 层时（理论上不会发生），直接用 child 聚合 root。
      rootChildStates = children.map(child => ({
        status: child.status,
        adoptable: isAdoptableChildJob(child)
      }))
    }
    const rootStatus = deriveOrchestratorStatus(rootChildStates)
    const rootStats = buildChildStatsSummary(children)
    const rootProgress = buildOrchestratorProgress(rootStatus, rootStats)
    await JobModel.updateOne(
      { _id: root._id },
      {
        $set: {
          status: rootStatus,
          'queueControl.active': false,
          'runtime.finishedAt':
            rootStatus === TRANSLATION_JOB_STATUS.PENDING ? null : now,
          'taskRelation.childStats': rootStats,
          'progress.currentStage': rootProgress.currentStage,
          'progress.currentStep': rootProgress.currentStep,
          'progress.percent': rootProgress.percent
        }
      }
    )
  }
  return { updated: true }
}

// root 规划阶段完成：把 root 从 RUNNING 转为编排态（active=false），子任务已创建完毕，
// 后续状态由 recomputeFamilyAggregateStatus 派生。
async function finalizeOrchestratorPlanning(options = {}) {
  const JobModel = getTranslationJobModel()
  const now = new Date()
  const result = await JobModel.updateOne(
    {
      _id: toObjectId(options.id, 'id', true),
      status: TRANSLATION_JOB_STATUS.RUNNING,
      'runtime.workerId': options.workerId,
      'runtime.attempts': Number(options.attemptNo)
    },
    {
      $set: {
        status: TRANSLATION_JOB_STATUS.PENDING,
        'queueControl.active': false,
        'runtime.lockedBy': '',
        'runtime.workerId': '',
        'runtime.finishedAt': null,
        'runtime.heartbeatAt': now,
        'runtime.leaseExpiresAt': null,
        'runtime.recovering': false,
        'taskRelation.childStats': normalizeObject(
          options.childStats,
          'childStats'
        ),
        'progress.currentStep': '子任务规划完成，正在按顺序执行子任务',
        'progress.currentStage': 'Orchestrating',
        'progress.percent': 0,
        'attempts.$[attempt].status': 'success',
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].stage': 'Orchestrating'
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '子任务规划完成，开始按顺序执行子任务',
              'info',
              'family'
            )
          ],
          $slice: -MAX_RECENT_LOGS
        }
      }
    },
    {
      arrayFilters: [
        {
          'attempt.attemptNo': Number(options.attemptNo),
          'attempt.workerId': options.workerId,
          'attempt.status': 'running'
        }
      ]
    }
  )
  if (result.matchedCount !== 1) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_CANCELLED,
      '规划完成写入失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }
  // 放行家族中第一个子任务（其余子任务保持排队，按顺序依次放行）。
  await activateNextFamilyChild(String(options.id || ''))
  await recomputeFamilyAggregateStatus(String(options.id || ''))
}

module.exports = {
  createTranslationJob,
  createTranslationJobBatch,
  listTranslationJobs,
  getTranslationJobStorageSummary,
  getTranslationJobDetail,
  getTranslationJobFamily,
  deferTranslationJob,
  requestStopRunningTranslationJob,
  resumeTranslationJob,
  deleteTranslationJob,
  batchDeleteTranslationJobs,
  rejectTranslationJob,
  retryTranslationJob,
  claimNextRunnableTranslationJob,
  renewTranslationJobLease,
  updateRunningTranslationJobProgress,
  saveRunningTranslationJobCheckpoint,
  readRunningTranslationJobAiChunkCache,
  saveRunningTranslationJobAiChunkCache,
  completeRunningTranslationJobForReview,
  failRunningTranslationJob,
  markExpiredRunningTranslationJobsRecovering,
  getJobFamilyRootId,
  isOrchestratorRole,
  isChildRole,
  activateNextFamilyChild,
  blockPendingFamilyChildren,
  recomputeFamilyAggregateStatus,
  finalizeOrchestratorPlanning
}
