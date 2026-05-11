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
const MAX_BATCH_DELETE_TERM_COUNT = 100
const MAX_CANDIDATE_EXTRA_COUNT = 50
const MAX_EXTRACTED_TERM_NOTE_LENGTH = 200
const CLEANUP_DEBOUNCE_MS = 30 * 1000
const CLEANUP_LOCK_KEY = 'properNounTermCleanup'
const TRANSLATION_SOURCE_VALUES = [
  'manual',
  'internetSearchAi',
  'aiKnowledgeBase',
  'imported'
]
const TRANSLATION_SOURCE_LABEL_MAP = {
  manual: '手动维护',
  internetSearchAi: '联网检索',
  aiKnowledgeBase: 'AI知识库',
  imported: '导入'
}
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
    const staleTermList = await TermModel.find({}, { _id: 1 })
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
    const termDeleteResult = await TermModel.deleteMany({
      _id: { $in: termIdList }
    })

    return {
      total,
      deletedCount: termDeleteResult.deletedCount || 0,
      translationDeletedCount: translationDeleteResult.deletedCount || 0
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

function normalizeBoolean(value, defaultValue = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false
  }
  return defaultValue
}

function normalizeTranslationSource(value) {
  const translationSource = normalizeString(value, 60)
  if (TRANSLATION_SOURCE_VALUES.includes(translationSource)) {
    return translationSource
  }
  return 'manual'
}

function getTranslationSourceLabel(value) {
  const translationSource = normalizeTranslationSource(value)
  if (TRANSLATION_SOURCE_LABEL_MAP[translationSource]) {
    return TRANSLATION_SOURCE_LABEL_MAP[translationSource]
  }
  return translationSource || 'database'
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

function buildTermSearchMatch(query = {}) {
  const match = {}
  const keyword = normalizeString(query.keyword, 120)
  if (keyword) {
    const keywordRegExp = new RegExp(escapeRegexp(keyword), 'i')
    match.$or = [
      { sourceText: keywordRegExp },
      { normalizedSourceText: keywordRegExp },
      { note: keywordRegExp }
    ]
  }

  if (query.enabled === 'true' || query.enabled === true) {
    match.enabled = true
  }
  if (query.enabled === 'false' || query.enabled === false) {
    match.enabled = false
  }

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
    enabled: normalizeBoolean(data.enabled, true)
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
    enabled: normalizeBoolean(data.enabled, true)
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

  return {
    list: attachTranslationsToTerms(termList, translationList),
    total,
    termCount,
    maxTermCount: MAX_TERM_COUNT,
    page,
    limit
  }
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

  return {
    requestedCount: termIdList.length,
    deletedCount: termDeleteResult.deletedCount || 0,
    translationDeletedCount: translationDeleteResult.deletedCount || 0
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

function normalizeExtractedTermList(terms) {
  if (!Array.isArray(terms)) {
    return []
  }

  const normalizedMap = new Map()
  terms.forEach(value => {
    let sourceText = ''
    let note = ''
    let importance = 0
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sourceText = normalizeSourceText(value.sourceText)
      note = normalizeString(value.note, MAX_EXTRACTED_TERM_NOTE_LENGTH)
      importance = Number(value.importance || 0)
    } else {
      sourceText = normalizeSourceText(value)
    }

    const normalizedSourceText = buildNormalizedSourceText(sourceText)
    if (!sourceText || !normalizedSourceText) {
      return
    }

    const existingTerm = normalizedMap.get(normalizedSourceText)
    if (!existingTerm) {
      normalizedMap.set(normalizedSourceText, {
        sourceText,
        normalizedSourceText,
        note,
        importance
      })
      return
    }

    if (!existingTerm.note && note) {
      existingTerm.note = note
    }
    if (importance > existingTerm.importance) {
      existingTerm.sourceText = sourceText
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
  return sourceTermCount + MAX_CANDIDATE_EXTRA_COUNT
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
  await recordProperNounUsage(translationList)

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
    const item = {
      ...translation,
      normalizedSourceText,
      sourceText:
        termMap.get(normalizedSourceText)?.sourceText ||
        translation.sourceTextSnapshot ||
        ''
    }
    translationMap.set(
      buildTranslationKey(normalizedSourceText, translation.languageCode),
      item
    )
    translations.push(item)
  })

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
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const termList = await TermModel.find({
    normalizedSourceText: {
      $in: sourceTextItems.map(item => item.normalizedSourceText)
    },
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
    candidateTerms: attachCandidateTranslations(termList, translationList),
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
        translations: existingTranslations
      })
    }
    if (missingLanguageCodes.length > 0) {
      missingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
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
    const normalizedSourceText = String(term.normalizedSourceText || '')
    if (!normalizedSourceText) {
      return
    }
    if (!matchedTermMap.has(normalizedSourceText)) {
      matchedTermMap.set(normalizedSourceText, [])
    }
    matchedTermMap.get(normalizedSourceText).push(term)
  })
  return matchedTermMap
}

function getCompactTextLength(value) {
  const text = normalizeSourceText(value).replace(/\s+/g, '')
  return Array.from(text).length
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
  matchedTermIds = []
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

      const item = {
        ...matchedTranslation.translation,
        termId: matchedTranslation.term._id,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
        sourceText:
          matchedTranslation.term.sourceText || sourceTextItem.sourceText,
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
        note: sourceTextItem.note,
        matchedTermIds: matchedTerms.map(term => String(term._id || '')),
        translations: existingTranslations
      })
    }
    if (missingLanguageCodes.length > 0) {
      missingTerms.push({
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText,
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

  await recordProperNounUsage(selectedTranslations)

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
    sourceLanguageCode: '',
    note: normalizeString(options.note, 2000),
    enabled: true
  })
  scheduleProperNounTermCleanup()
  return term
}

async function findOrCreateTermForSourceText(sourceText, options = {}) {
  const normalizedSourceText = buildNormalizedSourceText(sourceText)
  const TermModel = getTermModel()
  const existing = await TermModel.findOne({ normalizedSourceText })
    .sort(getCandidateSort())
    .lean()
  if (existing) {
    return existing
  }

  try {
    return await createTermForSourceText(sourceText, options)
  } catch (error) {
    if (error && error.code === 11000) {
      return await TermModel.findOne({ normalizedSourceText })
        .sort(getCandidateSort())
        .lean()
    }
    throw error
  }
}

async function resolveTermForAiSearchTerm(termItem, sourceText) {
  const termId = normalizeString(termItem?.termId, 80)
  if (termId) {
    const term = await findTermById(termId)
    const note = normalizeString(termItem?.note, 2000)
    if (note && !normalizeString(term.note, 2000)) {
      const TermModel = getTermModel()
      const updatedTerm = await TermModel.findOneAndUpdate(
        { _id: term._id },
        { $set: { note } },
        { new: true }
      ).lean()
      if (updatedTerm) {
        return updatedTerm
      }
    }
    return term
  }

  return await createTermForSourceText(sourceText, {
    note: termItem?.note
  })
}

async function upsertAiSearchTerms({ terms = [], provider = '', model = '' }) {
  const TranslationModel = getTranslationModel()
  const savedTranslations = []
  const resolvedTermMap = new Map()

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
    for (const languageCode of Object.keys(translations)) {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode) {
        continue
      }
      const translatedText = normalizeString(translations[languageCode], 300)
      if (!translatedText) {
        continue
      }
      const payload = buildTranslationPayload(
        {
          termId: term._id,
          languageCode: normalizedLanguageCode,
          translatedText,
          translationSource: resolveAiTranslationSource(termItem),
          provider,
          model,
          searchMetadata: termItem.searchMetadata || {},
          enabled: true
        },
        term
      )
      const record = await TranslationModel.findOneAndUpdate(
        { termId: term._id, languageCode: normalizedLanguageCode },
        { $set: payload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean()
      savedTranslations.push({
        ...record,
        sourceText: term.sourceText,
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

function isMissingTermForLanguage(missingMap, sourceTextItem, languageCode) {
  const missingTerm = missingMap.get(sourceTextItem.normalizedSourceText)
  if (!missingTerm) {
    return false
  }
  if (!Array.isArray(missingTerm.languageCodes)) {
    return true
  }
  return missingTerm.languageCodes.includes(languageCode)
}

function pushSingleLanguageGlossaryRow({
  lines,
  sourceTextItem,
  languageCode,
  translationMap,
  missingMap,
  includeNoteColumn
}) {
  const translation = translationMap.get(
    buildTranslationKey(sourceTextItem.normalizedSourceText, languageCode)
  )
  if (translation) {
    const sourceText = translation.sourceText || sourceTextItem.sourceText
    const sourceLabel = getTranslationSourceLabel(translation.translationSource)
    const cells = [sourceText]
    if (includeNoteColumn) {
      cells.push(translation.glossaryNote || '')
    }
    cells.push(translation.translatedText)
    cells.push(sourceLabel)
    lines.push(buildMarkdownTableRow(cells))
    return
  }

  if (isMissingTermForLanguage(missingMap, sourceTextItem, languageCode)) {
    const missingTerm = missingMap.get(sourceTextItem.normalizedSourceText)
    const cells = [sourceTextItem.sourceText]
    if (includeNoteColumn) {
      cells.push(missingTerm?.glossaryNote || '')
    }
    cells.push('未收录，请按上下文直译或音译，并在本次翻译中保持一致')
    cells.push('missing')
    lines.push(buildMarkdownTableRow(cells))
  }
}

function buildSingleLanguageGlossaryMarkdown({
  sourceTextItems,
  languageCode,
  translationMap,
  missingMap,
  includeNoteColumn
}) {
  const headerCells = ['原文']
  const separatorCells = ['---']
  if (includeNoteColumn) {
    headerCells.push('备注')
    separatorCells.push('---')
  }
  headerCells.push('译名')
  headerCells.push('来源')
  separatorCells.push('---')
  separatorCells.push('---')

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
      missingMap,
      includeNoteColumn
    })
  })

  return lines.join('\n')
}

function shouldIncludeGlossaryNoteColumn(translations, missingTerms) {
  const hasTranslationNote = translations.some(translation => {
    return Boolean(normalizeString(translation.glossaryNote, 300))
  })
  if (hasTranslationNote) {
    return true
  }
  return missingTerms.some(missingTerm => {
    return Boolean(normalizeString(missingTerm.glossaryNote, 300))
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
  const includeNoteColumn = shouldIncludeGlossaryNoteColumn(
    translations,
    missingTerms
  )

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
  const missingMap = new Map()
  missingTerms.forEach(item => {
    missingMap.set(item.normalizedSourceText, item)
  })

  if (languageCodes.length === 1) {
    return buildSingleLanguageGlossaryMarkdown({
      sourceTextItems,
      languageCode: languageCodes[0],
      translationMap,
      missingMap,
      includeNoteColumn
    })
  }

  const headerCells = ['原文']
  const separatorCells = ['---']
  if (includeNoteColumn) {
    headerCells.push('备注')
    separatorCells.push('---')
  }
  headerCells.push('目标语言')
  headerCells.push('译名')
  headerCells.push('来源')
  separatorCells.push('---')
  separatorCells.push('---')
  separatorCells.push('---')

  const lines = [
    '## 专有名词翻译数据库',
    '',
    buildMarkdownTableRow(headerCells),
    buildMarkdownTableRow(separatorCells)
  ]

  sourceTextItems.forEach(sourceTextItem => {
    languageCodes.forEach(languageCode => {
      const translation = translationMap.get(
        buildTranslationKey(sourceTextItem.normalizedSourceText, languageCode)
      )
      if (translation) {
        const sourceText = translation.sourceText || sourceTextItem.sourceText
        const sourceLabel = getTranslationSourceLabel(
          translation.translationSource
        )
        const cells = [sourceText]
        if (includeNoteColumn) {
          cells.push(translation.glossaryNote || '')
        }
        cells.push(`${getLanguageText(languageCode)}（${languageCode}）`)
        cells.push(translation.translatedText)
        cells.push(sourceLabel)
        lines.push(buildMarkdownTableRow(cells))
        return
      }

      if (isMissingTermForLanguage(missingMap, sourceTextItem, languageCode)) {
        const missingTerm = missingMap.get(sourceTextItem.normalizedSourceText)
        const cells = [sourceTextItem.sourceText]
        if (includeNoteColumn) {
          cells.push(missingTerm?.glossaryNote || '')
        }
        cells.push(`${getLanguageText(languageCode)}（${languageCode}）`)
        cells.push('未收录，请按上下文直译或音译，并在本次翻译中保持一致')
        cells.push('missing')
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
  buildNormalizedSourceText,
  batchDeleteTerms,
  compareMatchedTermTranslationCoverage,
  compareTermTranslationCoverage,
  createTerm,
  createTranslation,
  deleteTerm,
  deleteTranslation,
  enforceProperNounTermLimit,
  getTermDetail,
  getTermList,
  getTranslationList,
  getTranslationCandidatesForExtractedTerms,
  getTranslationsForSourceTexts,
  normalizeExtractedTermList,
  normalizeSourceText,
  scheduleProperNounTermCleanup,
  updateTerm,
  updateTranslation,
  upsertAiSearchTerms
}
