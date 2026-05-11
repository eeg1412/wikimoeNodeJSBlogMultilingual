const mongoose = require('mongoose')
const coverImageTempFileService = require('./coverImageTempFileService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
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
  TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES
} = require('../../../utils/translationJobConstants')

const MAX_LIST_LIMIT = 100
const DEFAULT_LIST_LIMIT = 20
const MAX_RECENT_LOGS = 20
const MAX_BATCH_DELETE_COUNT = 100

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
  if (
    (!Array.isArray(request.entries) || request.entries.length === 0) &&
    !shouldTranslateCoverImage
  ) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '文章翻译后台任务必须提供 request.entries，或启用 request.options.translateCoverImage',
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
  validateExecutableRequest(jobType, request)
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
  let targetLanguageCodes = []
  if (Array.isArray(target.languageCodes)) {
    targetLanguageCodes = target.languageCodes
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
    queueControl: {
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
      retryable: failure.retryable === true
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

  return {
    list: list.map(item => buildListItemSummary(item, queuePositionMap)),
    total,
    page,
    limit
  }
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
  const updatedAt = new Date()
  const databaseSizeBytes = table.totalSizeBytes
  const cacheSizeBytes = coverImageTempStorage.totalSizeBytes

  return {
    updatedAt,
    tables: [table],
    fileCaches: [coverImageTempStorage],
    totals: {
      tableCount: 1,
      documentCount: table.documentCount,
      fileCacheCount: 1,
      sizeBytes: table.sizeBytes,
      storageSizeBytes: table.storageSizeBytes,
      indexSizeBytes: table.indexSizeBytes,
      databaseSizeBytes,
      cacheSizeBytes,
      totalSizeBytes: databaseSizeBytes + cacheSizeBytes
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

  return attachRuntimeDisplay(job, {})
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
  const reason =
    toTrimmedString(body.reason) || '用户停止了 AI 翻译任务，正在断开 AI 连接'
  job.queueControl.active = false
  job.runtime.interruptReason = reason
  job.updatedBy = adminSnapshot
  job.progress = job.progress || {}
  job.progress.currentStep = '正在停止任务，已请求断开 AI 连接'
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
  const cleanupResult = await cleanupJobCoverImageCacheBeforeDelete(job)

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
    cleanupStatus: cleanupResult.cleanupStatus
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
  const items = []
  for (const job of jobs) {
    const cleanupResult = await cleanupJobCoverImageCacheBeforeDelete(job)
    items.push({
      id: job._id,
      deleted: true,
      cleanupStatus: cleanupResult.cleanupStatus
    })
  }

  const JobModel = getTranslationJobModel()
  const deleteResult = await JobModel.deleteMany({
    _id: { $in: jobs.map(job => job._id) }
  })
  if (!deleteResult || deleteResult.deletedCount !== jobs.length) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  return {
    requestedCount: ids.length,
    deletedCount: items.length,
    items
  }
}

async function rejectTranslationJob(body = {}, options = {}) {
  const job = await getMutableJob(body.id)
  assertStatus(job, [TRANSLATION_JOB_STATUS.WAITING_REVIEW], '不采纳任务')

  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  job.status = TRANSLATION_JOB_STATUS.REJECTED
  job.adoption.rejectedBy = adminSnapshot
  job.adoption.rejectedAt = new Date()
  job.adoption.rejectReason = toTrimmedString(body.reason)
  job.updatedBy = adminSnapshot
  job.runtime.finishedAt = job.runtime.finishedAt || new Date()
  job.progress.percent = 100
  appendLog(job, '用户已标记任务结果为不采纳', 'info', 'reject')
  await job.save()
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

  if (job.failure.retryable === false) {
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
  job.runtime.recovering = true
  job.updatedBy = adminSnapshot
  appendLog(job, '用户已请求重试，任务重新进入队列', 'info', 'retry')
  await job.save()
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
  manualRetryRequired
}) {
  if (manualRetryRequired) {
    return `当前 AI 步骤连续重试失败，等待用户决定是否重试：${errorMessage}`
  }
  if (autoRetry) {
    return `任务执行失败，等待后台自动重试：${errorMessage}`
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
  const currentStage = candidate.progress?.currentStage || 'claimed'
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
  const setData = {}
  const maxData = {}
  if (progress.currentStep !== undefined) {
    setData['progress.currentStep'] = toTrimmedString(progress.currentStep)
  }
  if (progress.currentStage !== undefined) {
    setData['progress.currentStage'] = toTrimmedString(progress.currentStage)
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
    update.$push = {
      'progress.recentLogs': {
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
        'progress.stageState': normalizeObject(
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
        status: TRANSLATION_JOB_STATUS.WAITING_REVIEW,
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
        'result.aiJsonLogs': translationAiJsonLogService.sanitizeAiJsonValue(
          resultData.aiJsonLogs || []
        ),
        'result.relatedResults': resultData.relatedResults || [],
        'result.languageResults': resultData.languageResults || [],
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
        'result.completedAt': now,
        'progress.currentStep': '翻译结果已完成，等待人工审核',
        'progress.currentStage': 'FinalizeReview',
        'progress.percent': 100,
        'attempts.$[attempt].status': 'success',
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].stage': 'FinalizeReview'
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '翻译结果已完整保存，进入等待审核',
              'info',
              'FinalizeReview'
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
      '任务完成写入失败，当前 worker 已失去任务所有权',
      'translationJob',
      499
    )
  }
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
  } else if (currentAttemptNo >= maxAttempts) {
    retryable = false
    autoRetry = false
  }
  const failedStep = getFailedStep(options)
  const progressStep = buildFailureProgressStep({
    errorMessage: errorSummary.message,
    autoRetry,
    manualRetryRequired
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
        'runtime.interruptReason': '停止请求在服务重启后确认完成',
        'failure.failedStep': 'stop',
        'failure.errorCode': ERROR_CODES.AI_TRANSLATION_CANCELLED,
        'failure.errorMessage': '任务已停止，后台不会继续执行',
        'failure.stackSummary': '',
        'failure.retryable': false,
        'failure.lastFailedAt': now,
        'progress.currentStage': 'Failure',
        'progress.currentStep': '任务已停止，后台不会继续执行',
        'attempts.$[attempt].status': 'interrupted',
        'attempts.$[attempt].finishedAt': now,
        'attempts.$[attempt].error': {
          code: ERROR_CODES.AI_TRANSLATION_CANCELLED,
          message: '任务已停止，后台不会继续执行',
          stackSummary: ''
        }
      },
      $push: {
        'progress.recentLogs': {
          $each: [
            buildRecentLog(
              '停止请求在服务重启后确认完成，任务不会继续执行',
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

module.exports = {
  createTranslationJob,
  listTranslationJobs,
  getTranslationJobStorageSummary,
  getTranslationJobDetail,
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
  completeRunningTranslationJobForReview,
  failRunningTranslationJob,
  markExpiredRunningTranslationJobsRecovering
}
