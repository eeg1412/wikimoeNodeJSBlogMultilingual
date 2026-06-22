const mongoose = require('mongoose')
const {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES,
  getLanguageText,
  normalizeLanguageCode
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const utils = require('../../../utils/utils')

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const MAX_TERM_COUNT = 10000
const MAX_STARRED_TERM_COUNT = 9000
const MAX_BATCH_DELETE_TERM_COUNT = 100
const MAX_CANDIDATE_EXTRA_COUNT = 100
const MAX_CANDIDATE_QUERY_LIMIT = 100
const MAX_CANDIDATE_KEYWORD_COUNT = 8
const MAX_EXTRACTED_TERM_NOTE_LENGTH = 200
const CLEANUP_DEBOUNCE_MS = 30 * 1000
const CLEANUP_LOCK_KEY = 'properNounTermCleanup'
const STARRED_TERM_LOCK_KEY = 'properNounTermStarred'
const TRANSLATION_SOURCE_VALUES = [
  'manual',
  'internetSearchAi',
  'aiKnowledgeBase',
  'imported'
]
let cleanupTimer = null
let isCleanupRunning = false
let hasPendingCleanup = false

function getTermModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.properNounTerms
  if (!repository || !repository.model) {
    throw new Error('properNounTerms repository not found')
  }
  return repository.model
}

function getTranslationModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.properNounTranslations
  if (!repository || !repository.model) {
    throw new Error('properNounTranslations repository not found')
  }
  return repository.model
}

function getSourcePostProperNounRelationService() {
  return require('./sourcePostProperNounRelationService')
}

function startCleanupTimer() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
  }
  cleanupTimer = setTimeout(() => {
    runScheduledProperNounTermCleanup()
  }, CLEANUP_DEBOUNCE_MS)
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

function scheduleProperNounTermCleanup() {
  hasPendingCleanup = true
  startCleanupTimer()
}

async function runScheduledProperNounTermCleanup() {
  cleanupTimer = null
  if (isCleanupRunning) {
    startCleanupTimer()
    return
  }
  if (!hasPendingCleanup) {
    return
  }

  hasPendingCleanup = false
  isCleanupRunning = true
  try {
    await enforceProperNounTermLimit()
  } catch (error) {
    console.error('专有名词翻译库自动清理失败：', error)
  } finally {
    isCleanupRunning = false
    if (hasPendingCleanup) {
      startCleanupTimer()
    }
  }
}

function getCleanupSort() {
  return {
    lastUsedAt: 1,
    usedCount: 1,
    updatedAt: 1,
    createdAt: 1,
    _id: 1
  }
}

async function enforceProperNounTermLimit() {
  return await utils.executeInLock(CLEANUP_LOCK_KEY, async () => {
    const TermModel = getTermModel()
    const TranslationModel = getTranslationModel()
    const total = await TermModel.countDocuments({})
    if (total <= MAX_TERM_COUNT) {
      return {
        total,
        deletedCount: 0,
        translationDeletedCount: 0
      }
    }

    const deleteCount = total - MAX_TERM_COUNT
    const staleTermList = await TermModel.find(
      { isStarred: { $ne: true } },
      { _id: 1 }
    )
      .sort(getCleanupSort())
      .limit(deleteCount)
      .lean()
    const termIdList = staleTermList.map(term => term._id)
    if (termIdList.length === 0) {
      return {
        total,
        deletedCount: 0,
        translationDeletedCount: 0
      }
    }

    const translationDeleteResult = await TranslationModel.deleteMany({
      termId: { $in: termIdList }
    })
    const relationDeleteResult =
      await getSourcePostProperNounRelationService().deleteRelationsByTermIds(
        termIdList
      )
    const termDeleteResult = await TermModel.deleteMany({
      _id: { $in: termIdList }
    })
    const protectedCount = total - staleTermList.length

    return {
      total,
      deletedCount: termDeleteResult.deletedCount || 0,
      translationDeletedCount: translationDeleteResult.deletedCount || 0,
      relationDeletedCount: relationDeleteResult.deletedCount || 0,
      protectedCount
    }
  })
}

function getUniqueObjectIdList(items, getObjectId) {
  const objectIdMap = new Map()
  items.forEach(item => {
    const objectId = getObjectId(item)
    const key = String(objectId || '')
    if (!key || objectIdMap.has(key)) {
      return
    }
    objectIdMap.set(key, objectId)
  })
  return Array.from(objectIdMap.values())
}

async function recordProperNounUsage(translationList) {
  if (!Array.isArray(translationList) || translationList.length === 0) {
    return
  }

  const usedAt = new Date()
  const termIdList = getUniqueObjectIdList(translationList, translation => {
    return translation.termId
  })
  const translationIdList = getUniqueObjectIdList(
    translationList,
    translation => {
      return translation._id
    }
  )

  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  await Promise.all([
    TermModel.updateMany(
      { _id: { $in: termIdList } },
      {
        $set: { lastUsedAt: usedAt },
        $inc: { usedCount: 1 }
      },
      { timestamps: false }
    ),
    TranslationModel.updateMany(
      { _id: { $in: translationIdList } },
      {
        $set: { lastUsedAt: usedAt },
        $inc: { usedCount: 1 }
      },
      { timestamps: false }
    )
  ])
}

function getUsageTracker(options = {}) {
  if (options.usageTracker instanceof Map) {
    return options.usageTracker
  }
  return null
}

function appendTrackedObjectId(targetList, tracker, trackerKey, objectId) {
  const objectIdKey = String(objectId || '')
  if (!objectIdKey) {
    return
  }
  if (tracker && tracker.has(trackerKey)) {
    return
  }
  if (tracker) {
    tracker.set(trackerKey, true)
  }
  if (!targetList.some(item => String(item || '') === objectIdKey)) {
    targetList.push(objectId)
  }
}

async function recordTrackedProperNounUsage(translationList, options = {}) {
  if (!Array.isArray(translationList) || translationList.length === 0) {
    return
  }

  const tracker = getUsageTracker(options)
  if (!tracker) {
    await recordProperNounUsage(translationList)
    return
  }

  const termIdList = []
  const translationIdList = []
  translationList.forEach(translation => {
    const termId = translation?.termId
    const termIdKey = String(termId || '')
    if (termIdKey) {
      appendTrackedObjectId(termIdList, tracker, `term:${termIdKey}`, termId)
    }

    const translationId = translation?._id
    const translationIdKey = String(translationId || '')
    if (translationIdKey) {
      appendTrackedObjectId(
        translationIdList,
        tracker,
        `translation:${translationIdKey}`,
        translationId
      )
    }
  })

  if (termIdList.length === 0 && translationIdList.length === 0) {
    return
  }

  const usedAt = new Date()
  const updateTasks = []
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  if (termIdList.length > 0) {
    updateTasks.push(
      TermModel.updateMany(
        { _id: { $in: termIdList } },
        {
          $set: { lastUsedAt: usedAt },
          $inc: { usedCount: 1 }
        },
        { timestamps: false }
      )
    )
  }
  if (translationIdList.length > 0) {
    updateTasks.push(
      TranslationModel.updateMany(
        { _id: { $in: translationIdList } },
        {
          $set: { lastUsedAt: usedAt },
          $inc: { usedCount: 1 }
        },
        { timestamps: false }
      )
    )
  }
  await Promise.all(updateTasks)
}

function normalizeString(value, maxLength = 600) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
}

function normalizeSourceText(value) {
  return normalizeString(value, 300).replace(/\s+/g, ' ')
}

function buildNormalizedSourceText(value) {
  return normalizeSourceText(value).toLocaleLowerCase()
}

function buildLooseSourceTextIdentity(value) {
  return buildNormalizedSourceText(value)
    .replace(/[\s\u3000]/g, '')
    .replace(
      /[!！?？。．.、，,：:；;"'“”‘’《》〈〉「」『』【】\[\]()（）×✕＆&＋+／/]/g,
      ''
    )
}

function isSameSourceAndTranslatedText(sourceText, translatedText) {
  const normalizedSourceText = normalizeSourceText(sourceText)
  const normalizedTranslatedText = normalizeSourceText(translatedText)
  if (!normalizedSourceText || !normalizedTranslatedText) {
    return false
  }
  return normalizedSourceText === normalizedTranslatedText
}

function hasTranslationNote(value) {
  return Boolean(normalizeString(value, 2000))
}

function shouldTreatTranslationAsMissing(sourceText, translation = {}) {
  if (!isSameSourceAndTranslatedText(sourceText, translation.translatedText)) {
    return false
  }

  const translationSource = normalizeTranslationSource(
    translation.translationSource
  )
  if (translationSource === 'manual') {
    return false
  }
  if (hasTranslationNote(translation.note)) {
    return false
  }
  return true
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getCompactTextLength(value) {
  return Array.from(normalizeSourceText(value).replace(/\s+/g, '')).length
}

function addCandidateKeyword(keywordList, value) {
  const keyword = buildNormalizedSourceText(value).slice(0, 120)
  if (!keyword || getCompactTextLength(keyword) < 2) {
    return
  }
  if (!keywordList.includes(keyword)) {
    keywordList.push(keyword)
  }

  const looseKeyword = buildLooseSourceTextIdentity(keyword).slice(0, 120)
  if (!looseKeyword || getCompactTextLength(looseKeyword) < 2) {
    return
  }
  if (!keywordList.includes(looseKeyword)) {
    keywordList.push(looseKeyword)
  }
}

function normalizeCandidateKeywordList(value, sourceText) {
  const keywordList = []
  if (Array.isArray(value)) {
    value.forEach(item => addCandidateKeyword(keywordList, item))
  }
  addCandidateKeyword(keywordList, sourceText)
  return keywordList.slice(0, MAX_CANDIDATE_KEYWORD_COUNT)
}

function mergeCandidateKeywordList(targetList, sourceList) {
  if (!Array.isArray(sourceList)) {
    return targetList
  }
  sourceList.forEach(keyword => {
    addCandidateKeyword(targetList, keyword)
  })
  return targetList.slice(0, MAX_CANDIDATE_KEYWORD_COUNT)
}

function normalizeBoolean(value, defaultValue = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false
  }
  return defaultValue
}

function normalizeBooleanFilter(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false
  }
  return null
}

function buildTermStarredMatch(value) {
  const isStarred = normalizeBooleanFilter(value)
  if (isStarred === true) {
    return { isStarred: true }
  }
  if (isStarred === false) {
    return { isStarred: { $ne: true } }
  }
  return {}
}

function normalizeTranslationSource(value) {
  const translationSource = normalizeString(value, 60)
  if (TRANSLATION_SOURCE_VALUES.includes(translationSource)) {
    return translationSource
  }
  return 'manual'
}

function hasInternetSearchMetadata(searchMetadata) {
  if (!searchMetadata || typeof searchMetadata !== 'object') {
    return false
  }
  if (
    Array.isArray(searchMetadata.webSearchQueries) &&
    searchMetadata.webSearchQueries.length > 0
  ) {
    return true
  }
  if (!Array.isArray(searchMetadata.groundingChunks)) {
    return false
  }
  return searchMetadata.groundingChunks.some(chunk => {
    return Boolean(chunk?.uri)
  })
}

function resolveAiTranslationSource(termItem = {}) {
  const translationSource = normalizeString(termItem.translationSource, 60)
  if (TRANSLATION_SOURCE_VALUES.includes(translationSource)) {
    return translationSource
  }
  if (hasInternetSearchMetadata(termItem.searchMetadata)) {
    return 'internetSearchAi'
  }
  return 'aiKnowledgeBase'
}

function normalizeOptionalLanguageCode(value) {
  const text = normalizeString(value, 20)
  if (!text) {
    return ''
  }
  const languageCode = normalizeLanguageCode(text)
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  return languageCode
}

function normalizeRequiredLanguageCode(value, fieldName = 'languageCode') {
  const languageCode = normalizeLanguageCode(normalizeString(value, 20))
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      fieldName,
      400
    )
  }
  return languageCode
}

function parseObjectId(value, fieldName = 'id') {
  const text = normalizeString(value, 80)
  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_ID_INVALID,
      undefined,
      fieldName,
      400
    )
  }
  return new mongoose.Types.ObjectId(text)
}

function parseObjectIdList(values, fieldName = 'ids') {
  if (!Array.isArray(values)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'ids 不能为空',
      fieldName,
      400
    )
  }

  const objectIdMap = new Map()
  values.forEach(value => {
    const objectId = parseObjectId(value, fieldName)
    const key = String(objectId)
    if (objectIdMap.has(key)) {
      return
    }
    objectIdMap.set(key, objectId)
  })

  if (objectIdMap.size === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'ids 不能为空',
      fieldName,
      400
    )
  }
  if (objectIdMap.size > MAX_BATCH_DELETE_TERM_COUNT) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `单次最多删除 ${MAX_BATCH_DELETE_TERM_COUNT} 个专有名词`,
      fieldName,
      400
    )
  }

  return Array.from(objectIdMap.values())
}

function parsePage(value) {
  const page = Number(value || 1)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

function parseLimit(value) {
  const limit = Number(value || DEFAULT_PAGE_SIZE)
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_PAGE_SIZE
  }
  if (limit > MAX_PAGE_SIZE) {
    return MAX_PAGE_SIZE
  }
  return limit
}

function escapeRegexp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSourceTextKeywordMatch(keyword) {
  const text = normalizeString(keyword, 120)
  if (!text) {
    return {}
  }
  const keywordRegExp = new RegExp(escapeRegexp(text), 'i')
  return {
    $or: [
      { sourceText: keywordRegExp },
      { normalizedSourceText: keywordRegExp }
    ]
  }
}

function buildNoteKeywordMatch(keyword) {
  const text = normalizeString(keyword, 120)
  if (!text) {
    return {}
  }
  return {
    note: new RegExp(escapeRegexp(text), 'i')
  }
}

function buildTermSearchMatch(query = {}) {
  const match = {}
  Object.assign(match, buildSourceTextKeywordMatch(query.sourceTextKeyword))
  Object.assign(match, buildNoteKeywordMatch(query.noteKeyword))

  Object.assign(match, buildTermStarredMatch(query.isStarred))

  /*
  if (query.enabled === 'true' || query.enabled === true) {
    match.enabled = true
  }
  if (query.enabled === 'false' || query.enabled === false) {
    match.enabled = false
  }
  */

  return match
}

function buildTermPayload(data = {}) {
  const sourceText = normalizeSourceText(data.sourceText)
  if (!sourceText) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '原文名词不能为空',
      'sourceText',
      400
    )
  }

  return {
    sourceText,
    normalizedSourceText: buildNormalizedSourceText(sourceText),
    sourceLanguageCode: normalizeOptionalLanguageCode(data.sourceLanguageCode),
    note: normalizeString(data.note, 2000),
    enabled: true
    // enabled: normalizeBoolean(data.enabled, true)
  }
}

function buildTranslationPayload(data = {}, term) {
  const languageCode = normalizeRequiredLanguageCode(data.languageCode)
  const translatedText = normalizeString(data.translatedText, 300)
  if (!translatedText) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '译名不能为空',
      'translatedText',
      400
    )
  }

  const sourceText = normalizeSourceText(term?.sourceText || data.sourceText)
  return {
    termId: term?._id || parseObjectId(data.termId, 'termId'),
    languageCode,
    translatedText,
    sourceTextSnapshot: sourceText,
    normalizedSourceTextSnapshot: buildNormalizedSourceText(sourceText),
    translationSource: normalizeTranslationSource(data.translationSource),
    provider: normalizeString(data.provider, 80),
    model: normalizeString(data.model, 120),
    note: normalizeString(data.note, 2000),
    searchMetadata:
      data.searchMetadata && typeof data.searchMetadata === 'object'
        ? data.searchMetadata
        : {},
    enabled: true
    // enabled: normalizeBoolean(data.enabled, true)
  }
}

async function findTermById(termId) {
  const TermModel = getTermModel()
  const term = await TermModel.findOne({
    _id: parseObjectId(termId, 'termId')
  }).lean()
  if (!term) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '名词不存在',
      'termId',
      404
    )
  }
  return term
}

function attachTranslationsToTerms(termList, translationList) {
  const translationMap = new Map()
  translationList.forEach(translation => {
    const key = String(translation.termId || '')
    if (!translationMap.has(key)) {
      translationMap.set(key, [])
    }
    translationMap.get(key).push(translation)
  })

  return termList.map(term => {
    return {
      ...term,
      translations: translationMap.get(String(term._id)) || []
    }
  })
}

function getSourcePostBindingScopeId(query = {}) {
  const sourceId = normalizeString(query.sourceId, 80)
  if (sourceId) {
    return sourceId
  }
  const sourcePostId = normalizeString(query.sourcePostId, 80)
  if (sourcePostId) {
    return sourcePostId
  }
  return normalizeString(query.boundSourceId, 80)
}

async function attachSourcePostBindingStateToTerms(termList, query = {}) {
  const sourceId = getSourcePostBindingScopeId(query)
  if (!sourceId || termList.length === 0) {
    return termList
  }
  const relationMap =
    await getSourcePostProperNounRelationService().getSourcePostTermRelationMap(
      {
        sourceId,
        termIds: termList.map(term => term._id)
      }
    )

  return termList.map(term => {
    const relation = relationMap.get(String(term._id)) || null
    return {
      ...term,
      isBoundToSourcePost: Boolean(relation),
      sourcePostRelation: relation
    }
  })
}

async function getTermList(query = {}) {
  const page = parsePage(query.page)
  const limit = parseLimit(query.limit)
  const match = buildTermSearchMatch(query)
  const languageCode = normalizeLanguageCode(
    normalizeString(query.languageCode)
  )
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()

  const termCount = await TermModel.countDocuments({})
  const starredTermCount = await TermModel.countDocuments({ isStarred: true })
  const total = await TermModel.countDocuments(match)
  const termList = await TermModel.find(match)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
  const termIdList = termList.map(term => term._id)
  const translationMatch = { termId: { $in: termIdList } }
  if (languageCode) {
    translationMatch.languageCode = languageCode
  }
  const translationList = await TranslationModel.find(translationMatch)
    .sort({ languageCode: 1, updatedAt: -1 })
    .lean()
  const list = await attachSourcePostBindingStateToTerms(
    attachTranslationsToTerms(termList, translationList),
    query
  )

  return {
    list,
    total,
    termCount,
    maxTermCount: MAX_TERM_COUNT,
    starredTermCount,
    maxStarredTermCount: MAX_STARRED_TERM_COUNT,
    page,
    limit
  }
}

async function updateTermStar(body = {}) {
  const id = parseObjectId(body.id || body._id || body.termId, 'id')
  const isStarred = normalizeBoolean(body.isStarred, false)
  const TermModel = getTermModel()

  return await utils.executeInLock(STARRED_TERM_LOCK_KEY, async () => {
    const existingTerm = await TermModel.findOne({ _id: id }).lean()
    if (!existingTerm) {
      throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '名词不存在', 'id', 404)
    }

    if (existingTerm.isStarred === isStarred) {
      const starredTermCount = await TermModel.countDocuments({
        isStarred: true
      })
      return {
        term: existingTerm,
        starredTermCount,
        maxStarredTermCount: MAX_STARRED_TERM_COUNT
      }
    }

    if (isStarred) {
      const starredTermCount = await TermModel.countDocuments({
        isStarred: true,
        _id: { $ne: id }
      })
      if (starredTermCount >= MAX_STARRED_TERM_COUNT) {
        throw new ApiError(
          ERROR_CODES.CONTENT_FIELD_INVALID,
          `最多只能标星 ${MAX_STARRED_TERM_COUNT} 个专有名词`,
          'isStarred',
          400,
          {
            starredTermCount,
            maxStarredTermCount: MAX_STARRED_TERM_COUNT
          }
        )
      }
    }

    const term = await TermModel.findOneAndUpdate(
      { _id: id },
      { $set: { isStarred } },
      { new: true }
    ).lean()
    const starredTermCount = await TermModel.countDocuments({
      isStarred: true
    })
    return {
      term,
      starredTermCount,
      maxStarredTermCount: MAX_STARRED_TERM_COUNT
    }
  })
}

async function getTermDetail(query = {}) {
  const term = await findTermById(query.id || query.termId)
  const TranslationModel = getTranslationModel()
  const translations = await TranslationModel.find({ termId: term._id })
    .sort({ languageCode: 1 })
    .lean()
  return { ...term, translations }
}

async function createTerm(body = {}) {
  const payload = buildTermPayload(body)
  const TermModel = getTermModel()
  try {
    const term = await TermModel.create(payload)
    scheduleProperNounTermCleanup()
    return term
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '该原文名词已存在',
        'sourceText',
        400
      )
    }
    throw error
  }
}

async function updateTerm(body = {}) {
  const id = parseObjectId(body.id || body._id, 'id')
  const payload = buildTermPayload(body)
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()

  try {
    const term = await TermModel.findOneAndUpdate(
      { _id: id },
      { $set: payload },
      { new: true }
    ).lean()
    if (!term) {
      throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '名词不存在', 'id', 404)
    }
    await TranslationModel.updateMany(
      { termId: id },
      {
        $set: {
          sourceTextSnapshot: payload.sourceText,
          normalizedSourceTextSnapshot: payload.normalizedSourceText
        }
      }
    )
    return term
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '该原文名词已存在',
        'sourceText',
        400
      )
    }
    throw error
  }
}

async function deleteTerm(query = {}) {
  const id = parseObjectId(query.id || query.termId, 'id')
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const result = await TermModel.deleteOne({ _id: id })
  if (result.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '名词不存在', 'id', 404)
  }
  await TranslationModel.deleteMany({ termId: id })
  await getSourcePostProperNounRelationService().deleteRelationsByTermIds([id])
  return { deletedCount: result.deletedCount }
}

async function batchDeleteTerms(body = {}) {
  const termIdList = parseObjectIdList(body.ids, 'ids')
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const termList = await TermModel.find({
    _id: { $in: termIdList }
  })
    .select('_id sourceText')
    .lean()
  const existingTermIdSet = new Set()
  termList.forEach(term => {
    existingTermIdSet.add(String(term._id))
  })
  const missingIds = termIdList
    .map(termId => String(termId))
    .filter(termId => {
      return !existingTermIdSet.has(termId)
    })
  if (missingIds.length > 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      `以下专有名词不存在或已删除：${missingIds.join('、')}`,
      'ids',
      400,
      { missingIds }
    )
  }

  const termDeleteResult = await TermModel.deleteMany({
    _id: { $in: termIdList }
  })
  if (
    !termDeleteResult ||
    termDeleteResult.deletedCount !== termIdList.length
  ) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '名词不存在', 'ids', 404)
  }
  const translationDeleteResult = await TranslationModel.deleteMany({
    termId: { $in: termIdList }
  })
  const relationDeleteResult =
    await getSourcePostProperNounRelationService().deleteRelationsByTermIds(
      termIdList
    )

  return {
    requestedCount: termIdList.length,
    deletedCount: termDeleteResult.deletedCount || 0,
    translationDeletedCount: translationDeleteResult.deletedCount || 0,
    relationDeletedCount: relationDeleteResult.deletedCount || 0
  }
}

async function getTranslationList(query = {}) {
  const term = await findTermById(query.termId)
  const TranslationModel = getTranslationModel()
  const languageCode = normalizeLanguageCode(
    normalizeString(query.languageCode)
  )
  const match = { termId: term._id }
  if (languageCode) {
    match.languageCode = languageCode
  }
  const list = await TranslationModel.find(match)
    .sort({ languageCode: 1, updatedAt: -1 })
    .lean()
  return { term, list, total: list.length }
}

async function createTranslation(body = {}) {
  const term = await findTermById(body.termId)
  const payload = buildTranslationPayload(body, term)
  const TranslationModel = getTranslationModel()
  try {
    return await TranslationModel.create(payload)
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '该语言译名已存在',
        'languageCode',
        400
      )
    }
    throw error
  }
}

async function updateTranslation(body = {}) {
  const id = parseObjectId(body.id || body._id, 'id')
  const TranslationModel = getTranslationModel()
  const current = await TranslationModel.findOne({ _id: id }).lean()
  if (!current) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '译名不存在', 'id', 404)
  }
  const term = await findTermById(body.termId || current.termId)
  const payload = buildTranslationPayload(
    {
      ...body,
      termId: term._id,
      languageCode: body.languageCode || current.languageCode
    },
    term
  )
  try {
    const record = await TranslationModel.findOneAndUpdate(
      { _id: id },
      { $set: payload },
      { new: true }
    ).lean()
    return record
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        '该语言译名已存在',
        'languageCode',
        400
      )
    }
    throw error
  }
}

async function deleteTranslation(query = {}) {
  const id = parseObjectId(query.id, 'id')
  const TranslationModel = getTranslationModel()
  const result = await TranslationModel.deleteOne({ _id: id })
  if (result.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.CONTENT_NOT_FOUND, '译名不存在', 'id', 404)
  }
  return { deletedCount: result.deletedCount }
}

function normalizeSourceTextList(sourceTexts) {
  if (!Array.isArray(sourceTexts)) {
    return []
  }
  const normalizedMap = new Map()
  sourceTexts.forEach(value => {
    const sourceText = normalizeSourceText(value)
    const normalizedSourceText = buildNormalizedSourceText(sourceText)
    if (!sourceText || normalizedMap.has(normalizedSourceText)) {
      return
    }
    normalizedMap.set(normalizedSourceText, sourceText)
  })
  return Array.from(normalizedMap.entries()).map(
    ([normalizedSourceText, sourceText]) => {
      return { normalizedSourceText, sourceText }
    }
  )
}

function normalizeOptionalExtractedSourceLanguageCode(value) {
  const languageCode = normalizeLanguageCode(normalizeString(value, 20))
  if (!languageCode) {
    return ''
  }
  return languageCode
}

function normalizeExtractedTermList(terms) {
  if (!Array.isArray(terms)) {
    return []
  }

  const normalizedMap = new Map()
  terms.forEach(value => {
    let sourceText = ''
    let note = ''
    let importance = 0
    let searchKeywords = []
    let sourceLanguageCode = ''
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sourceText = normalizeSourceText(value.sourceText)
      note = normalizeString(value.note, MAX_EXTRACTED_TERM_NOTE_LENGTH)
      importance = Number(value.importance || 0)
      sourceLanguageCode = normalizeOptionalExtractedSourceLanguageCode(
        value.sourceLanguageCode
      )
      searchKeywords = normalizeCandidateKeywordList(
        value.searchKeywords,
        sourceText
      )
    } else {
      sourceText = normalizeSourceText(value)
      searchKeywords = normalizeCandidateKeywordList([], sourceText)
    }

    const normalizedSourceText = buildNormalizedSourceText(sourceText)
    if (!sourceText || !normalizedSourceText) {
      return
    }

    const identityKey = buildLooseSourceTextIdentity(sourceText)
    const normalizedKey = identityKey || normalizedSourceText
    const existingTerm = normalizedMap.get(normalizedKey)
    if (!existingTerm) {
      normalizedMap.set(normalizedKey, {
        sourceText,
        normalizedSourceText,
        sourceLanguageCode,
        note,
        importance,
        searchKeywords
      })
      return
    }

    if (!existingTerm.note && note) {
      existingTerm.note = note
    }
    if (!existingTerm.sourceLanguageCode && sourceLanguageCode) {
      existingTerm.sourceLanguageCode = sourceLanguageCode
    }
    existingTerm.searchKeywords = mergeCandidateKeywordList(
      existingTerm.searchKeywords,
      searchKeywords
    )
    if (importance > existingTerm.importance) {
      existingTerm.sourceText = sourceText
      existingTerm.normalizedSourceText = normalizedSourceText
      if (sourceLanguageCode) {
        existingTerm.sourceLanguageCode = sourceLanguageCode
      }
      existingTerm.importance = importance
    }
  })

  return Array.from(normalizedMap.values())
}

function normalizeLanguageCodeList(languageCodes) {
  if (!Array.isArray(languageCodes)) {
    return [DEFAULT_LANGUAGE_CODE]
  }
  const normalizedList = []
  languageCodes.forEach(value => {
    const languageCode = normalizeLanguageCode(normalizeString(value, 20))
    if (languageCode && !normalizedList.includes(languageCode)) {
      normalizedList.push(languageCode)
    }
  })
  if (normalizedList.length === 0) {
    normalizedList.push(DEFAULT_LANGUAGE_CODE)
  }
  return normalizedList
}

function buildTranslationKey(normalizedSourceText, languageCode) {
  return `${normalizedSourceText}::${languageCode}`
}

function buildTermTranslationKey(termId, languageCode) {
  return `${String(termId || '')}::${languageCode}`
}

function getCandidateQueryLimit(sourceTextItems) {
  let sourceTermCount = 0
  if (Array.isArray(sourceTextItems)) {
    sourceTermCount = sourceTextItems.length
  }
  if (sourceTermCount <= 0) {
    return 0
  }
  return Math.min(
    sourceTermCount + MAX_CANDIDATE_EXTRA_COUNT,
    MAX_CANDIDATE_QUERY_LIMIT
  )
}

function buildCandidateKeywordQueryList(sourceTextItems) {
  const keywordList = []
  sourceTextItems.forEach(item => {
    normalizeCandidateKeywordList(item.searchKeywords, item.sourceText).forEach(
      keyword => {
        if (!keywordList.includes(keyword)) {
          keywordList.push(keyword)
        }
      }
    )
  })
  return keywordList.map(keyword => {
    return {
      normalizedSourceText: {
        $regex: escapeRegExp(keyword),
        $options: 'i'
      }
    }
  })
}

function isCandidateMatchedByKeyword(term, sourceTextItem) {
  const termText = buildNormalizedSourceText(term?.sourceText || '')
  const normalizedTermText = buildNormalizedSourceText(
    term?.normalizedSourceText || termText
  )
  const looseTermText = buildLooseSourceTextIdentity(
    term?.normalizedSourceText || termText
  )
  const keywordList = normalizeCandidateKeywordList(
    sourceTextItem.searchKeywords,
    sourceTextItem.sourceText
  )

  for (const keyword of keywordList) {
    if (
      normalizedTermText.includes(keyword) ||
      keyword.includes(normalizedTermText)
    ) {
      return true
    }
    const looseKeyword = buildLooseSourceTextIdentity(keyword)
    if (!looseKeyword) {
      continue
    }
    if (looseTermText.includes(looseKeyword)) {
      return true
    }
    if (looseKeyword.includes(looseTermText)) {
      return true
    }
  }
  return false
}

function attachMatchedSourceTextItems(termList, sourceTextItems) {
  return termList.map(term => {
    const matchedSourceTextItems = sourceTextItems.filter(sourceTextItem => {
      return isCandidateMatchedByKeyword(term, sourceTextItem)
    })
    return {
      ...term,
      matchedSourceTextItems: matchedSourceTextItems.map(item => {
        return {
          sourceText: item.sourceText,
          normalizedSourceText: item.normalizedSourceText,
          note: item.note || '',
          importance: item.importance || 0
        }
      })
    }
  })
}

function getCandidateSort() {
  return {
    usedCount: -1,
    lastUsedAt: -1,
    updatedAt: -1,
    createdAt: -1,
    _id: 1
  }
}

function buildTranslationsByTermId(translationList) {
  const translationMap = new Map()
  translationList.forEach(translation => {
    const key = buildTermTranslationKey(
      translation.termId,
      translation.languageCode
    )
    translationMap.set(key, translation)
  })
  return translationMap
}

function attachCandidateTranslations(termList, translationList) {
  const translationsByTermId = new Map()
  translationList.forEach(translation => {
    const termId = String(translation.termId || '')
    if (!termId) {
      return
    }
    if (!translationsByTermId.has(termId)) {
      translationsByTermId.set(termId, [])
    }
    translationsByTermId.get(termId).push(translation)
  })

  return termList.map(term => {
    const termId = String(term._id || '')
    return {
      ...term,
      translations: translationsByTermId.get(termId) || []
    }
  })
}

async function getTranslationsForSourceTexts({
  sourceTexts = [],
  targetLanguageCodes = []
} = {}) {
  const sourceTextItems = normalizeSourceTextList(sourceTexts)
  const languageCodes = normalizeLanguageCodeList(targetLanguageCodes)
  if (sourceTextItems.length === 0) {
    return {
      sourceTextItems,
      languageCodes,
      translations: [],
      translationMap: new Map(),
      termMap: new Map()
    }
  }

  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const termList = await TermModel.find({
    normalizedSourceText: {
      $in: sourceTextItems.map(item => item.normalizedSourceText)
    },
    enabled: true
  }).lean()
  const termMap = new Map()
  termList.forEach(term => {
    termMap.set(term.normalizedSourceText, term)
  })
  const translationList = await TranslationModel.find({
    termId: { $in: termList.map(term => term._id) },
    languageCode: { $in: languageCodes },
    enabled: true
  }).lean()

  const normalizedTextByTermId = new Map()
  termList.forEach(term => {
    normalizedTextByTermId.set(String(term._id), term.normalizedSourceText)
  })
  const translationMap = new Map()
  const translations = []
  translationList.forEach(translation => {
    const normalizedSourceText = normalizedTextByTermId.get(
      String(translation.termId)
    )
    if (!normalizedSourceText) {
      return
    }
    const sourceText =
      termMap.get(normalizedSourceText)?.sourceText ||
      translation.sourceTextSnapshot ||
      ''
    const sourceLanguageCode = normalizeOptionalExtractedSourceLanguageCode(
      termMap.get(normalizedSourceText)?.sourceLanguageCode
    )
    if (shouldTreatTranslationAsMissing(sourceText, translation)) {
      return
    }
    const item = {
      ...translation,
      normalizedSourceText,
      sourceLanguageCode,
      sourceText
    }
    translationMap.set(
      buildTranslationKey(normalizedSourceText, translation.languageCode),
      item
    )
    translations.push(item)
  })
  await recordProperNounUsage(translations)

  return {
    sourceTextItems,
    languageCodes,
    translations,
    translationMap,
    termMap
  }
}

async function getTranslationCandidatesForExtractedTerms({
  terms = [],
  targetLanguageCodes = []
} = {}) {
  const sourceTextItems = normalizeExtractedTermList(terms)
  const languageCodes = normalizeLanguageCodeList(targetLanguageCodes)
  const emptyResult = {
    sourceTextItems,
    languageCodes,
    candidateTerms: [],
    translations: []
  }
  if (sourceTextItems.length === 0) {
    return emptyResult
  }

  const candidateLimit = getCandidateQueryLimit(sourceTextItems)
  const keywordQueryList = buildCandidateKeywordQueryList(sourceTextItems)
  if (keywordQueryList.length === 0) {
    return emptyResult
  }
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const termList = await TermModel.find({
    $or: keywordQueryList,
    enabled: true
  })
    .sort(getCandidateSort())
    .limit(candidateLimit)
    .lean()

  if (termList.length === 0) {
    return emptyResult
  }

  const translationList = await TranslationModel.find({
    termId: { $in: termList.map(term => term._id) },
    languageCode: { $in: languageCodes },
    enabled: true
  }).lean()

  return {
    sourceTextItems,
    languageCodes,
    candidateTerms: attachCandidateTranslations(
      attachMatchedSourceTextItems(termList, sourceTextItems),
      translationList
    ),
    translations: translationList
  }
}

async function compareTermTranslationCoverage(options = {}) {
  const result = await getTranslationsForSourceTexts(options)
  const existingTerms = []
  const missingTerms = []

  result.sourceTextItems.forEach(sourceTextItem => {
    const existingTranslations = []
    const missingLanguageCodes = []
    const matchedTerm = result.termMap.get(sourceTextItem.normalizedSourceText)
    const sourceLanguageCode = getCoverageSourceLanguageCode(
      sourceTextItem,
      matchedTerm
    )
    result.languageCodes.forEach(languageCode => {
      const key = buildTranslationKey(
        sourceTextItem.normalizedSourceText,
        languageCode
      )
      const translation = result.translationMap.get(key)
      if (translation) {
        existingTranslations.push(translation)
        return
      }
      missingLanguageCodes.push(languageCode)
    })

    if (existingTranslations.length > 0) {
      existingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceLanguageCode,
        translations: existingTranslations
      })
    }
    if (missingLanguageCodes.length > 0) {
      missingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceLanguageCode,
        languageCodes: missingLanguageCodes
      })
    }
  })

  return {
    ...result,
    existingTerms,
    missingTerms
  }
}

function normalizeMatchedTermIdList(matchedTermIds) {
  if (!Array.isArray(matchedTermIds)) {
    return []
  }

  const termIdList = []
  matchedTermIds.forEach(value => {
    const termId = String(value || '').trim()
    if (!termId || termIdList.includes(termId)) {
      return
    }
    termIdList.push(termId)
  })
  return termIdList
}

function groupMatchedCandidateTerms(candidateTerms, matchedTermIds) {
  const matchedTermIdList = normalizeMatchedTermIdList(matchedTermIds)
  const matchedTermIdSet = new Set(matchedTermIdList)
  const matchedTermMap = new Map()
  candidateTerms.forEach(term => {
    const termId = String(term._id || '')
    if (!matchedTermIdSet.has(termId)) {
      return
    }
    const matchedSourceTextItems = Array.isArray(term.matchedSourceTextItems)
      ? term.matchedSourceTextItems
      : []
    const normalizedSourceTextList = matchedSourceTextItems
      .map(item => String(item?.normalizedSourceText || ''))
      .filter(Boolean)
    if (normalizedSourceTextList.length === 0 && term.normalizedSourceText) {
      normalizedSourceTextList.push(String(term.normalizedSourceText))
    }
    normalizedSourceTextList.forEach(normalizedSourceText => {
      if (!matchedTermMap.has(normalizedSourceText)) {
        matchedTermMap.set(normalizedSourceText, [])
      }
      matchedTermMap.get(normalizedSourceText).push(term)
    })
  })
  return matchedTermMap
}

function shouldIncludeGlossaryNote(sourceText, matchedTermCount) {
  if (matchedTermCount > 1) {
    return true
  }
  return getCompactTextLength(sourceText) <= 2
}

function buildGlossaryNote(sourceTextItem, term, matchedTermCount) {
  if (!shouldIncludeGlossaryNote(sourceTextItem.sourceText, matchedTermCount)) {
    return ''
  }

  const termNote = normalizeString(term?.note, MAX_EXTRACTED_TERM_NOTE_LENGTH)
  if (termNote) {
    return termNote
  }
  return normalizeString(sourceTextItem.note, MAX_EXTRACTED_TERM_NOTE_LENGTH)
}

function getCoverageSourceLanguageCode(sourceTextItem, matchedTerm) {
  const extractedSourceLanguageCode =
    normalizeOptionalExtractedSourceLanguageCode(
      sourceTextItem?.sourceLanguageCode
    )
  if (extractedSourceLanguageCode) {
    return extractedSourceLanguageCode
  }
  return normalizeOptionalExtractedSourceLanguageCode(
    matchedTerm?.sourceLanguageCode
  )
}

function findMatchedTranslationForLanguage({
  matchedTerms,
  languageCode,
  translationMap
}) {
  for (const term of matchedTerms) {
    const key = buildTermTranslationKey(term._id, languageCode)
    const translation = translationMap.get(key)
    if (translation) {
      return {
        term,
        translation
      }
    }
  }
  return null
}

async function compareMatchedTermTranslationCoverage({
  terms = [],
  targetLanguageCodes = [],
  candidateTerms = [],
  translations = [],
  matchedTermIds = [],
  usageTracker = null
} = {}) {
  const sourceTextItems = normalizeExtractedTermList(terms)
  const languageCodes = normalizeLanguageCodeList(targetLanguageCodes)
  const matchedTermMap = groupMatchedCandidateTerms(
    candidateTerms,
    matchedTermIds
  )
  const translationMap = buildTranslationsByTermId(translations)
  const existingTerms = []
  const missingTerms = []
  const selectedTranslations = []

  sourceTextItems.forEach(sourceTextItem => {
    const matchedTerms =
      matchedTermMap.get(sourceTextItem.normalizedSourceText) || []
    const existingTranslations = []
    const missingLanguageCodes = []

    languageCodes.forEach(languageCode => {
      const matchedTranslation = findMatchedTranslationForLanguage({
        matchedTerms,
        languageCode,
        translationMap
      })
      if (!matchedTranslation) {
        missingLanguageCodes.push(languageCode)
        return
      }
      let matchedSourceText = matchedTranslation.term.sourceText
      if (!matchedSourceText) {
        matchedSourceText = sourceTextItem.sourceText
      }
      let shouldTreatAsMissing = shouldTreatTranslationAsMissing(
        matchedSourceText,
        matchedTranslation.translation
      )
      if (
        !shouldTreatAsMissing &&
        matchedSourceText !== sourceTextItem.sourceText
      ) {
        shouldTreatAsMissing = shouldTreatTranslationAsMissing(
          sourceTextItem.sourceText,
          matchedTranslation.translation
        )
      }
      if (shouldTreatAsMissing) {
        missingLanguageCodes.push(languageCode)
        return
      }

      const item = {
        ...matchedTranslation.translation,
        termId: matchedTranslation.term._id,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceLanguageCode: getCoverageSourceLanguageCode(
          sourceTextItem,
          matchedTranslation.term
        ),
        sourceText: matchedSourceText,
        termNote: normalizeString(
          matchedTranslation.term.note,
          MAX_EXTRACTED_TERM_NOTE_LENGTH
        ),
        extractionNote: normalizeString(
          sourceTextItem.note,
          MAX_EXTRACTED_TERM_NOTE_LENGTH
        ),
        glossaryNote: buildGlossaryNote(
          sourceTextItem,
          matchedTranslation.term,
          matchedTerms.length
        )
      }
      existingTranslations.push(item)
      selectedTranslations.push(item)
    })

    if (existingTranslations.length > 0) {
      existingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceLanguageCode: getCoverageSourceLanguageCode(
          sourceTextItem,
          matchedTerms[0]
        ),
        note: sourceTextItem.note,
        matchedTermIds: matchedTerms.map(term => String(term._id || '')),
        translations: existingTranslations
      })
    }
    if (missingLanguageCodes.length > 0) {
      missingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceLanguageCode: getCoverageSourceLanguageCode(
          sourceTextItem,
          matchedTerms[0]
        ),
        note: sourceTextItem.note,
        glossaryNote: buildGlossaryNote(
          sourceTextItem,
          matchedTerms[0],
          matchedTerms.length
        ),
        languageCodes: missingLanguageCodes,
        matchedTermIds: matchedTerms.map(term => String(term._id || ''))
      })
    }
  })

  await recordTrackedProperNounUsage(selectedTranslations, { usageTracker })

  return {
    sourceTextItems,
    languageCodes,
    translations: selectedTranslations,
    existingTerms,
    missingTerms,
    candidateTerms
  }
}

async function createTermForSourceText(sourceText, options = {}) {
  const normalizedSourceText = buildNormalizedSourceText(sourceText)
  const TermModel = getTermModel()
  const term = await TermModel.create({
    sourceText: normalizeSourceText(sourceText),
    normalizedSourceText,
    sourceLanguageCode: normalizeOptionalLanguageCode(
      options.sourceLanguageCode
    ),
    note: normalizeString(options.note, 2000),
    enabled: true
  })
  scheduleProperNounTermCleanup()
  return term
}

async function findOrCreateTermForSourceText(sourceText, options = {}) {
  const normalizedSourceText = buildNormalizedSourceText(sourceText)
  const sourceLanguageCode = normalizeOptionalExtractedSourceLanguageCode(
    options.sourceLanguageCode
  )
  const TermModel = getTermModel()
  return await utils.executeInLock(
    `properNounTerm:${normalizedSourceText}`,
    async () => {
      const existing = await TermModel.findOne({ normalizedSourceText })
        .sort(getCandidateSort())
        .lean()
      if (existing) {
        const note = normalizeString(options.note, 2000)
        const currentNote = normalizeString(existing.note, 2000)
        const protectStarredNote =
          options.protectStarredTermFieldsFromAi === true &&
          existing.isStarred === true
        const currentSourceLanguageCode =
          normalizeOptionalExtractedSourceLanguageCode(
            existing.sourceLanguageCode
          )
        const updateData = {}
        let shouldUpdateNote = false
        if (!protectStarredNote) {
          if (note && !currentNote) {
            shouldUpdateNote = true
          }
          if (
            note &&
            options.shouldUpdateTermNote === true &&
            currentNote !== note
          ) {
            shouldUpdateNote = true
          }
        }
        if (shouldUpdateNote) {
          updateData.note = note
        }
        if (sourceLanguageCode && !currentSourceLanguageCode) {
          updateData.sourceLanguageCode = sourceLanguageCode
        }
        if (Object.keys(updateData).length > 0) {
          const updatedTerm = await TermModel.findOneAndUpdate(
            { _id: existing._id },
            { $set: updateData },
            { new: true }
          ).lean()
          if (updatedTerm) {
            return updatedTerm
          }
        }
        return existing
      }

      try {
        return await createTermForSourceText(sourceText, {
          ...options,
          sourceLanguageCode
        })
      } catch (error) {
        if (error && error.code === 11000) {
          return await TermModel.findOne({ normalizedSourceText })
            .sort(getCandidateSort())
            .lean()
        }
        throw error
      }
    }
  )
}

async function resolveTermForAiSearchTerm(termItem, sourceText) {
  const termId = normalizeString(termItem?.termId, 80)
  const sourceLanguageCode = normalizeOptionalExtractedSourceLanguageCode(
    termItem?.sourceLanguageCode
  )
  if (termId) {
    const term = await findTermById(termId)
    const note = normalizeString(termItem?.note, 2000)
    const currentNote = normalizeString(term.note, 2000)
    const currentSourceLanguageCode =
      normalizeOptionalExtractedSourceLanguageCode(term.sourceLanguageCode)
    const updateData = {}
    let shouldUpdateNote = false
    // 标星名词：禁止 AI 修改其备注（note）。仅未标星的名词才允许 AI 补充/修订备注。
    if (term.isStarred !== true) {
      if (note && !currentNote) {
        shouldUpdateNote = true
      }
      if (
        note &&
        termItem?.shouldUpdateTermNote === true &&
        currentNote !== note
      ) {
        shouldUpdateNote = true
      }
    }
    if (shouldUpdateNote) {
      updateData.note = note
    }
    if (sourceLanguageCode && !currentSourceLanguageCode) {
      updateData.sourceLanguageCode = sourceLanguageCode
    }
    if (Object.keys(updateData).length > 0) {
      const TermModel = getTermModel()
      const updatedTerm = await TermModel.findOneAndUpdate(
        { _id: term._id },
        { $set: updateData },
        { new: true }
      ).lean()
      if (updatedTerm) {
        return updatedTerm
      }
    }
    return term
  }

  return await findOrCreateTermForSourceText(sourceText, {
    note: termItem?.note,
    sourceLanguageCode,
    shouldUpdateTermNote: termItem?.shouldUpdateTermNote === true,
    protectStarredTermFieldsFromAi: true
  })
}

function normalizeAiTranslationNoteMap(termItem = {}) {
  const translationNoteMap = new Map()
  const translationNotes = termItem?.translationNotes
  if (
    translationNotes &&
    typeof translationNotes === 'object' &&
    !Array.isArray(translationNotes)
  ) {
    Object.keys(translationNotes).forEach(languageCode => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode) {
        return
      }
      const note = normalizeString(translationNotes[languageCode], 2000)
      if (note) {
        translationNoteMap.set(normalizedLanguageCode, note)
      }
    })
  }

  const sharedTranslationNote = normalizeString(termItem?.translationNote, 2000)
  if (sharedTranslationNote) {
    translationNoteMap.set('*', sharedTranslationNote)
  }

  return translationNoteMap
}

function getAiTranslationNoteForLanguage(translationNoteMap, languageCode) {
  const languageNote = normalizeString(
    translationNoteMap.get(languageCode),
    2000
  )
  if (languageNote) {
    return languageNote
  }
  return normalizeString(translationNoteMap.get('*'), 2000)
}

function buildWritableAiTranslationEntries(
  sourceText,
  termItem = {},
  options = {}
) {
  const translations = termItem.translations || {}
  const translationNoteMap = normalizeAiTranslationNoteMap(termItem)
  const translationEntries = []
  Object.keys(translations).forEach(languageCode => {
    const normalizedLanguageCode = normalizeLanguageCode(languageCode)
    if (!normalizedLanguageCode) {
      return
    }
    const translatedText = normalizeString(translations[languageCode], 300)
    if (!translatedText) {
      return
    }
    const note = getAiTranslationNoteForLanguage(
      translationNoteMap,
      normalizedLanguageCode
    )
    if (isSameSourceAndTranslatedText(sourceText, translatedText)) {
      if (options.allowSameSourceTranslationWithNote !== true) {
        return
      }
      if (!note) {
        return
      }
    }
    translationEntries.push({
      languageCode: normalizedLanguageCode,
      translatedText,
      note
    })
  })
  return translationEntries
}

function buildAiSearchTranslationPayload({
  term,
  sourceText,
  translationEntry,
  termItem,
  provider,
  model,
  allowSameSourceTranslationWithNote = false
}) {
  const termSourceText = normalizeSourceText(term?.sourceText || sourceText)
  if (
    isSameSourceAndTranslatedText(
      termSourceText,
      translationEntry.translatedText
    )
  ) {
    if (allowSameSourceTranslationWithNote !== true) {
      return null
    }
    if (!hasTranslationNote(translationEntry.note)) {
      return null
    }
  }

  let searchMetadata = {}
  if (termItem?.searchMetadata && typeof termItem.searchMetadata === 'object') {
    searchMetadata = termItem.searchMetadata
  }

  return {
    termId: term._id,
    languageCode: translationEntry.languageCode,
    translatedText: translationEntry.translatedText,
    sourceTextSnapshot: termSourceText,
    normalizedSourceTextSnapshot: buildNormalizedSourceText(termSourceText),
    translationSource: resolveAiTranslationSource(termItem),
    provider: normalizeString(provider, 80),
    model: normalizeString(model, 120),
    note: normalizeString(translationEntry.note, 2000),
    searchMetadata,
    enabled: true
  }
}

async function getExistingTranslationLanguageSet(TranslationModel, termId) {
  const existingTranslations = await TranslationModel.find(
    { termId },
    { languageCode: 1 }
  ).lean()
  const languageSet = new Set()
  existingTranslations.forEach(item => {
    const languageCode = normalizeLanguageCode(item.languageCode)
    if (languageCode) {
      languageSet.add(languageCode)
    }
  })
  return languageSet
}

function getUpsertedIdFromResult(updateResult) {
  if (!updateResult) {
    return null
  }
  if (updateResult.upsertedId) {
    if (updateResult.upsertedId._id) {
      return updateResult.upsertedId._id
    }
    return updateResult.upsertedId
  }
  if (
    Array.isArray(updateResult.upserted) &&
    updateResult.upserted.length > 0
  ) {
    const firstUpserted = updateResult.upserted[0]
    if (firstUpserted && firstUpserted._id) {
      return firstUpserted._id
    }
  }
  return null
}

async function insertAiSearchTranslationIfMissing(TranslationModel, payload) {
  const updateResult = await TranslationModel.updateOne(
    {
      termId: payload.termId,
      languageCode: payload.languageCode
    },
    { $setOnInsert: payload },
    { upsert: true, setDefaultsOnInsert: true }
  )
  const upsertedId = getUpsertedIdFromResult(updateResult)
  if (upsertedId) {
    return await TranslationModel.findOne({ _id: upsertedId }).lean()
  }
  if (Number(updateResult?.upsertedCount || 0) > 0) {
    return await TranslationModel.findOne({
      termId: payload.termId,
      languageCode: payload.languageCode
    }).lean()
  }
  return null
}

async function saveAiSearchTranslation({
  TranslationModel,
  payload,
  allowExistingTranslationOverwrite = false
}) {
  if (allowExistingTranslationOverwrite === true) {
    return await TranslationModel.findOneAndUpdate(
      { termId: payload.termId, languageCode: payload.languageCode },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()
  }
  return await insertAiSearchTranslationIfMissing(TranslationModel, payload)
}

async function upsertAiSearchTerms({
  terms = [],
  provider = '',
  model = '',
  allowSameSourceTranslationWithNote = false,
  allowExistingTranslationOverwrite = false
}) {
  const TranslationModel = getTranslationModel()
  const savedTranslations = []
  const resolvedTermMap = new Map()
  const canOverwriteExistingTranslation =
    allowExistingTranslationOverwrite === true

  for (const termItem of terms) {
    const sourceText = normalizeSourceText(termItem?.sourceText)
    if (!sourceText) {
      continue
    }
    const translations = termItem.translations || {}
    if (
      !translations ||
      typeof translations !== 'object' ||
      Array.isArray(translations)
    ) {
      continue
    }
    const translationEntries = buildWritableAiTranslationEntries(
      sourceText,
      termItem,
      { allowSameSourceTranslationWithNote }
    )
    if (translationEntries.length === 0) {
      continue
    }
    const termId = normalizeString(termItem?.termId, 80)
    let termCacheKey = buildNormalizedSourceText(sourceText)
    if (termId) {
      termCacheKey = `id:${termId}`
    }
    let term = resolvedTermMap.get(termCacheKey)
    if (!term) {
      term = await resolveTermForAiSearchTerm(termItem, sourceText)
      resolvedTermMap.set(termCacheKey, term)
    }
    // 自动整理名词库时禁止覆盖任何已有译名，只允许补充缺失语言；人工校对后的应用入口会显式放开。
    let existingLanguageSet = null
    if (!canOverwriteExistingTranslation) {
      existingLanguageSet = await getExistingTranslationLanguageSet(
        TranslationModel,
        term._id
      )
    }
    for (const translationEntry of translationEntries) {
      if (
        existingLanguageSet &&
        existingLanguageSet.has(translationEntry.languageCode)
      ) {
        continue
      }
      const payload = buildAiSearchTranslationPayload({
        term,
        sourceText,
        translationEntry,
        termItem,
        provider,
        model,
        allowSameSourceTranslationWithNote
      })
      if (!payload) {
        continue
      }
      const record = await saveAiSearchTranslation({
        TranslationModel,
        payload,
        allowExistingTranslationOverwrite: canOverwriteExistingTranslation
      })
      if (!record) {
        continue
      }
      if (existingLanguageSet) {
        existingLanguageSet.add(translationEntry.languageCode)
      }
      savedTranslations.push({
        ...record,
        sourceText: term.sourceText,
        sourceLanguageCode: normalizeOptionalExtractedSourceLanguageCode(
          term.sourceLanguageCode
        ),
        normalizedSourceText: term.normalizedSourceText
      })
    }
  }

  if (savedTranslations.length > 0) {
    scheduleProperNounTermCleanup()
  }

  return savedTranslations
}

function buildMarkdownTableRow(cells) {
  return `| ${cells
    .map(cell =>
      String(cell || '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
    )
    .join(' | ')} |`
}

function getGlossaryTranslationForSource({
  sourceTextItem,
  languageCode,
  translationMap
}) {
  const translation = translationMap.get(
    buildTranslationKey(sourceTextItem.normalizedSourceText, languageCode)
  )
  if (!translation) {
    return null
  }
  if (
    isSameSourceAndTranslatedText(
      sourceTextItem.sourceText,
      translation.translatedText
    ) &&
    shouldTreatTranslationAsMissing(sourceTextItem.sourceText, translation)
  ) {
    return null
  }
  return translation
}

function getGlossarySourceLanguageCode(sourceTextItem, translation) {
  const sourceTextItemLanguageCode =
    normalizeOptionalExtractedSourceLanguageCode(
      sourceTextItem?.sourceLanguageCode
    )
  if (sourceTextItemLanguageCode) {
    return sourceTextItemLanguageCode
  }
  return normalizeOptionalExtractedSourceLanguageCode(
    translation?.sourceLanguageCode
  )
}

function getGlossarySourceLanguageText(sourceTextItem, translation) {
  const sourceLanguageCode = getGlossarySourceLanguageCode(
    sourceTextItem,
    translation
  )
  if (!sourceLanguageCode) {
    return ''
  }
  return `${getLanguageText(sourceLanguageCode)}（${sourceLanguageCode}）`
}

function appendMissingGlossaryTranslations(translationMap, missingTerms = []) {
  if (!Array.isArray(missingTerms)) {
    return
  }
  missingTerms.forEach(missingTerm => {
    const normalizedSourceText =
      missingTerm?.normalizedSourceText ||
      buildNormalizedSourceText(missingTerm?.sourceText || '')
    if (!normalizedSourceText || !Array.isArray(missingTerm?.languageCodes)) {
      return
    }
    missingTerm.languageCodes.forEach(languageCode => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode) {
        return
      }
      const key = buildTranslationKey(
        normalizedSourceText,
        normalizedLanguageCode
      )
      if (translationMap.has(key)) {
        return
      }
      translationMap.set(key, {
        normalizedSourceText,
        sourceText: missingTerm.sourceText || '',
        sourceLanguageCode: missingTerm.sourceLanguageCode || '',
        languageCode: normalizedLanguageCode,
        translatedText: '未收录',
        glossaryNote: missingTerm.glossaryNote || missingTerm.note || ''
      })
    })
  })
}

function pushSingleLanguageGlossaryRow({
  lines,
  sourceTextItem,
  languageCode,
  translationMap,
  includeSourceLanguageColumn,
  includeNoteColumn,
  includeTranslationNoteColumn
}) {
  const translation = getGlossaryTranslationForSource({
    sourceTextItem,
    languageCode,
    translationMap
  })
  if (translation) {
    const cells = [sourceTextItem.sourceText]
    if (includeSourceLanguageColumn) {
      cells.push(getGlossarySourceLanguageText(sourceTextItem, translation))
    }
    if (includeNoteColumn) {
      cells.push(translation.glossaryNote || '')
    }
    cells.push(translation.translatedText)
    if (includeTranslationNoteColumn) {
      cells.push(normalizeString(translation.note, 300))
    }
    lines.push(buildMarkdownTableRow(cells))
    return
  }
}

function buildSingleLanguageGlossaryMarkdown({
  sourceTextItems,
  languageCode,
  translationMap,
  includeSourceLanguageColumn,
  includeNoteColumn,
  includeTranslationNoteColumn
}) {
  const headerCells = ['原文']
  const separatorCells = ['---']
  if (includeSourceLanguageColumn) {
    headerCells.push('原文语言')
    separatorCells.push('---')
  }
  if (includeNoteColumn) {
    headerCells.push('备注')
    separatorCells.push('---')
  }
  headerCells.push('译名')
  separatorCells.push('---')
  if (includeTranslationNoteColumn) {
    headerCells.push('译名备注')
    separatorCells.push('---')
  }

  const lines = [
    '## 专有名词翻译数据库',
    '',
    `目标语言：${getLanguageText(languageCode)}（${languageCode}）`,
    '',
    buildMarkdownTableRow(headerCells),
    buildMarkdownTableRow(separatorCells)
  ]

  sourceTextItems.forEach(sourceTextItem => {
    pushSingleLanguageGlossaryRow({
      lines,
      sourceTextItem,
      languageCode,
      translationMap,
      includeSourceLanguageColumn,
      includeNoteColumn,
      includeTranslationNoteColumn
    })
  })

  return lines.join('\n')
}

function shouldIncludeGlossaryNoteColumn(
  sourceTextItems,
  languageCodes,
  translationMap
) {
  return sourceTextItems.some(sourceTextItem => {
    return languageCodes.some(languageCode => {
      const translation = getGlossaryTranslationForSource({
        sourceTextItem,
        languageCode,
        translationMap
      })
      if (!translation) {
        return false
      }
      return Boolean(normalizeString(translation.glossaryNote, 300))
    })
  })
}

function shouldIncludeGlossaryTranslationNoteColumn(
  sourceTextItems,
  languageCodes,
  translationMap
) {
  return sourceTextItems.some(sourceTextItem => {
    return languageCodes.some(languageCode => {
      const translation = getGlossaryTranslationForSource({
        sourceTextItem,
        languageCode,
        translationMap
      })
      if (!translation) {
        return false
      }
      return Boolean(normalizeString(translation.note, 300))
    })
  })
}

function shouldIncludeGlossarySourceLanguageColumn(
  sourceTextItems,
  languageCodes,
  translationMap
) {
  return sourceTextItems.some(sourceTextItem => {
    return languageCodes.some(languageCode => {
      const translation = getGlossaryTranslationForSource({
        sourceTextItem,
        languageCode,
        translationMap
      })
      if (!translation) {
        return false
      }
      return Boolean(getGlossarySourceLanguageCode(sourceTextItem, translation))
    })
  })
}

function hasGlossaryTranslationRows(
  sourceTextItems,
  languageCodes,
  translationMap
) {
  return sourceTextItems.some(sourceTextItem => {
    return languageCodes.some(languageCode => {
      return Boolean(
        getGlossaryTranslationForSource({
          sourceTextItem,
          languageCode,
          translationMap
        })
      )
    })
  })
}

function buildGlossaryMarkdown({
  sourceTexts = [],
  targetLanguageCodes = [],
  translations = [],
  missingTerms = []
} = {}) {
  const sourceTextItems = normalizeExtractedTermList(sourceTexts)
  const languageCodes = normalizeLanguageCodeList(targetLanguageCodes)
  if (sourceTextItems.length === 0) {
    return ''
  }

  const translationMap = new Map()
  translations.forEach(translation => {
    const normalizedSourceText =
      translation.normalizedSourceText ||
      buildNormalizedSourceText(
        translation.sourceText || translation.sourceTextSnapshot
      )
    if (!normalizedSourceText || !translation.languageCode) {
      return
    }
    translationMap.set(
      buildTranslationKey(normalizedSourceText, translation.languageCode),
      translation
    )
  })
  appendMissingGlossaryTranslations(translationMap, missingTerms)
  const includeSourceLanguageColumn = shouldIncludeGlossarySourceLanguageColumn(
    sourceTextItems,
    languageCodes,
    translationMap
  )
  const includeNoteColumn = shouldIncludeGlossaryNoteColumn(
    sourceTextItems,
    languageCodes,
    translationMap
  )
  const includeTranslationNoteColumn =
    shouldIncludeGlossaryTranslationNoteColumn(
      sourceTextItems,
      languageCodes,
      translationMap
    )
  if (
    !hasGlossaryTranslationRows(sourceTextItems, languageCodes, translationMap)
  ) {
    return ''
  }
  if (languageCodes.length === 1) {
    return buildSingleLanguageGlossaryMarkdown({
      sourceTextItems,
      languageCode: languageCodes[0],
      translationMap,
      includeSourceLanguageColumn,
      includeNoteColumn,
      includeTranslationNoteColumn
    })
  }

  const headerCells = ['原文']
  const separatorCells = ['---']
  if (includeSourceLanguageColumn) {
    headerCells.push('原文语言')
    separatorCells.push('---')
  }
  if (includeNoteColumn) {
    headerCells.push('备注')
    separatorCells.push('---')
  }
  headerCells.push('目标语言')
  headerCells.push('译名')
  separatorCells.push('---')
  separatorCells.push('---')
  if (includeTranslationNoteColumn) {
    headerCells.push('译名备注')
    separatorCells.push('---')
  }

  const lines = [
    '## 专有名词翻译数据库',
    '',
    buildMarkdownTableRow(headerCells),
    buildMarkdownTableRow(separatorCells)
  ]

  sourceTextItems.forEach(sourceTextItem => {
    languageCodes.forEach(languageCode => {
      const translation = getGlossaryTranslationForSource({
        sourceTextItem,
        languageCode,
        translationMap
      })
      if (translation) {
        const cells = [sourceTextItem.sourceText]
        if (includeSourceLanguageColumn) {
          cells.push(getGlossarySourceLanguageText(sourceTextItem, translation))
        }
        if (includeNoteColumn) {
          cells.push(translation.glossaryNote || '')
        }
        cells.push(`${getLanguageText(languageCode)}（${languageCode}）`)
        cells.push(translation.translatedText)
        if (includeTranslationNoteColumn) {
          cells.push(normalizeString(translation.note, 300))
        }
        lines.push(buildMarkdownTableRow(cells))
      }
    })
  })

  return lines.join('\n')
}

module.exports = {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_SOURCE_VALUES,
  buildGlossaryMarkdown,
  buildTermStarredMatch,
  buildLooseSourceTextIdentity,
  buildNormalizedSourceText,
  batchDeleteTerms,
  compareMatchedTermTranslationCoverage,
  compareTermTranslationCoverage,
  createTerm,
  createTermForSourceText,
  createTranslation,
  deleteTerm,
  deleteTranslation,
  enforceProperNounTermLimit,
  findOrCreateTermForSourceText,
  getTermDetail,
  getTermList,
  getTranslationList,
  getTranslationCandidatesForExtractedTerms,
  getTranslationsForSourceTexts,
  isSameSourceAndTranslatedText,
  normalizeExtractedTermList,
  normalizeSourceText,
  scheduleProperNounTermCleanup,
  updateTerm,
  updateTermStar,
  updateTranslation,
  upsertAiSearchTerms
}
