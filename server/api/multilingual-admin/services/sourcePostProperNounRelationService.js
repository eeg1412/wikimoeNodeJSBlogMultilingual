const mongoose = require('mongoose')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const properNounTranslationService = require('./properNounTranslationService')

const SOURCE_COLLECTION_POSTS = 'posts'
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const MAX_INTERNET_SEARCH_TERM_COUNT = 100
const MAX_BATCH_BIND_TERM_COUNT = 100
const RELATION_SOURCE_VALUES = ['manual', 'aiOrganize', 'translationWorkflow']
const SOURCE_POST_RELATED_FIELDS = [
  'postList',
  'tweetList',
  'contentPostList',
  'contentTweetList'
]
const SOURCE_POST_SUMMARY_SELECT_FIELDS = [
  '_id',
  'title',
  'excerpt',
  'alias',
  'type',
  'status',
  'sourceLanguageCode',
  'updatedAt',
  'createdAt',
  ...SOURCE_POST_RELATED_FIELDS
].join(' ')

function getRelationModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.sourcePostProperNounRelations
  if (!repository || !repository.model) {
    throw new Error('sourcePostProperNounRelations repository not found')
  }
  return repository.model
}

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

function getSourcePostRepository() {
  const repository = global.$mongodDB?.source?.repositories?.posts
  if (!repository) {
    throw new Error('source posts repository not found')
  }
  return repository
}

function normalizeString(value, maxLength = 600) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
}

function parseObjectId(value, fieldName) {
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

function parseSourceId(value) {
  const text = normalizeString(value, 80)
  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      'sourceId',
      400
    )
  }
  return new mongoose.Types.ObjectId(text)
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

function normalizeOptionalLanguageCode(value, fieldName) {
  const text = normalizeString(value, 20)
  if (!text) {
    return ''
  }
  const languageCode = normalizeLanguageCode(text)
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

function normalizeRelationSource(value) {
  const relationSource = normalizeString(value, 40)
  if (RELATION_SOURCE_VALUES.includes(relationSource)) {
    return relationSource
  }
  return 'manual'
}

function escapeRegexp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getSourcePostIdText(value) {
  if (!value) {
    return ''
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return String(value)
  }
  if (typeof value === 'object' && value._id) {
    return getSourcePostIdText(value._id)
  }
  return normalizeString(value, 80)
}

function getSourcePostIdList(values) {
  const idMap = new Map()
  if (!Array.isArray(values)) {
    return []
  }
  values.forEach(value => {
    const idText = getSourcePostIdText(value)
    if (!mongoose.Types.ObjectId.isValid(idText) || idMap.has(idText)) {
      return
    }
    idMap.set(idText, new mongoose.Types.ObjectId(idText))
  })
  return Array.from(idMap.values())
}

function buildRelationMatch({
  sourceId,
  sourceLanguageCode = '',
  enabled = true
}) {
  const match = {
    sourceCollection: SOURCE_COLLECTION_POSTS,
    sourceId
  }
  if (sourceLanguageCode) {
    match.sourceLanguageCode = sourceLanguageCode
  }
  if (enabled === true) {
    match.enabled = true
  }
  if (enabled === false) {
    match.enabled = false
  }
  return match
}

async function getSourcePostSummary(sourceId) {
  const repository = getSourcePostRepository()
  const sourcePost = await repository.findOne(
    { _id: sourceId },
    SOURCE_POST_SUMMARY_SELECT_FIELDS,
    { lean: true }
  )
  if (!sourcePost) {
    throw new ApiError(
      ERROR_CODES.SOURCE_POST_NOT_FOUND,
      '源文章不存在',
      'sourceId',
      404
    )
  }
  const summary = {
    _id: sourcePost._id,
    sourceId: sourcePost._id,
    title: sourcePost.title || '',
    excerpt: sourcePost.excerpt || '',
    alias: sourcePost.alias || '',
    type: sourcePost.type,
    status: sourcePost.status,
    sourceLanguageCode: sourcePost.sourceLanguageCode || '',
    updatedAt: sourcePost.updatedAt || null,
    createdAt: sourcePost.createdAt || null
  }
  SOURCE_POST_RELATED_FIELDS.forEach(fieldName => {
    if (Array.isArray(sourcePost[fieldName])) {
      summary[fieldName] = sourcePost[fieldName]
      return
    }
    summary[fieldName] = []
  })
  return summary
}

function buildRelationSnapshotPayload(sourcePost) {
  if (!sourcePost) {
    return {
      sourceTitleSnapshot: '',
      sourceAliasSnapshot: ''
    }
  }
  return {
    sourceTitleSnapshot: normalizeString(sourcePost.title, 300),
    sourceAliasSnapshot: normalizeString(sourcePost.alias, 200)
  }
}

function getTermIdText(value) {
  if (!value) {
    return ''
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return String(value)
  }
  if (typeof value === 'object' && value._id) {
    return getTermIdText(value._id)
  }
  return normalizeString(value, 80)
}

function getUniqueTermIdList(values) {
  const idMap = new Map()
  if (!Array.isArray(values)) {
    return []
  }
  values.forEach(value => {
    const idText = getTermIdText(value)
    if (!mongoose.Types.ObjectId.isValid(idText) || idMap.has(idText)) {
      return
    }
    idMap.set(idText, new mongoose.Types.ObjectId(idText))
  })
  return Array.from(idMap.values())
}

function parseTermIdList(values, fieldName = 'termIds') {
  if (!Array.isArray(values)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'termIds 不能为空',
      fieldName,
      400
    )
  }

  const idMap = new Map()
  values.forEach(value => {
    const idText = getTermIdText(value)
    if (!mongoose.Types.ObjectId.isValid(idText)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_ID_INVALID,
        undefined,
        fieldName,
        400
      )
    }
    if (idMap.has(idText)) {
      return
    }
    idMap.set(idText, new mongoose.Types.ObjectId(idText))
  })

  if (idMap.size === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'termIds 不能为空',
      fieldName,
      400
    )
  }

  if (idMap.size > MAX_BATCH_BIND_TERM_COUNT) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `单次最多绑定 ${MAX_BATCH_BIND_TERM_COUNT} 个专有名词`,
      fieldName,
      400
    )
  }

  return Array.from(idMap.values())
}

async function getRelationCountMapBySourceIds(sourceIds, options = {}) {
  const sourceIdList = getSourcePostIdList(sourceIds)
  const countMap = new Map()
  if (sourceIdList.length === 0) {
    return countMap
  }
  const match = {
    sourceCollection: SOURCE_COLLECTION_POSTS,
    sourceId: { $in: sourceIdList },
    enabled: true
  }
  const RelationModel = getRelationModel()
  const rows = await RelationModel.aggregate([
    { $match: match },
    { $group: { _id: '$sourceId', count: { $sum: 1 } } }
  ])
  rows.forEach(row => {
    countMap.set(String(row._id), row.count || 0)
  })
  return countMap
}

function buildTermSourceTextKeywordMatch(keyword) {
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

function buildTermNoteKeywordMatch(keyword) {
  const text = normalizeString(keyword, 120)
  if (!text) {
    return {}
  }
  return {
    note: new RegExp(escapeRegexp(text), 'i')
  }
}

function attachTranslationsToTerms(termList, translationList) {
  const translationMap = new Map()
  translationList.forEach(translation => {
    const termId = String(translation.termId || '')
    if (!termId) {
      return
    }
    if (!translationMap.has(termId)) {
      translationMap.set(termId, [])
    }
    translationMap.get(termId).push(translation)
  })

  return termList.map(term => {
    return {
      ...term,
      translations: translationMap.get(String(term._id)) || []
    }
  })
}

function attachRelationToTerms(termList, relationList) {
  const relationMap = new Map()
  relationList.forEach(relation => {
    relationMap.set(String(relation.termId || ''), relation)
  })
  return termList.map(term => {
    const relation = relationMap.get(String(term._id)) || null
    return {
      ...term,
      relation
    }
  })
}

async function getSourcePostTermList(query = {}) {
  const sourceId = parseSourceId(query.sourceId || query.id)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    query.sourceLanguageCode,
    'sourceLanguageCode'
  )
  const languageCode = normalizeOptionalLanguageCode(
    query.languageCode,
    'languageCode'
  )
  const page = parsePage(query.page)
  const limit = parseLimit(query.limit)
  const sourcePost = await getSourcePostSummary(sourceId)
  const RelationModel = getRelationModel()
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const relationMatch = buildRelationMatch({ sourceId, sourceLanguageCode })
  const relationList = await RelationModel.find(relationMatch)
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const relationTermIdList = relationList.map(relation => relation.termId)
  if (relationTermIdList.length === 0) {
    return {
      sourcePost,
      list: [],
      total: 0,
      relationCount: 0,
      page,
      limit
    }
  }

  const termMatch = {
    _id: { $in: relationTermIdList },
    enabled: true,
    ...properNounTranslationService.buildTermStarredMatch(query.isStarred),
    ...buildTermSourceTextKeywordMatch(query.sourceTextKeyword),
    ...buildTermNoteKeywordMatch(query.noteKeyword)
  }
  const matchedTerms = await TermModel.find(termMatch)
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const matchedTermIdSet = new Set(
    matchedTerms.map(term => {
      return String(term._id)
    })
  )
  const matchedRelations = relationList.filter(relation => {
    return matchedTermIdSet.has(String(relation.termId || ''))
  })
  const total = matchedRelations.length
  const pageRelations = matchedRelations.slice((page - 1) * limit, page * limit)
  const pageTermIdSet = new Set(
    pageRelations.map(relation => {
      return String(relation.termId || '')
    })
  )
  const pageTerms = matchedTerms.filter(term => {
    return pageTermIdSet.has(String(term._id))
  })
  const translationMatch = {
    termId: { $in: pageTerms.map(term => term._id) },
    enabled: true
  }
  if (languageCode) {
    translationMatch.languageCode = languageCode
  }
  const translationList = await TranslationModel.find(translationMatch)
    .sort({ languageCode: 1, updatedAt: -1 })
    .lean()
  const termWithTranslations = attachTranslationsToTerms(
    pageTerms,
    translationList
  )
  const list = attachRelationToTerms(termWithTranslations, pageRelations)

  return {
    sourcePost,
    list,
    total,
    relationCount: relationList.length,
    page,
    limit
  }
}

async function getSourcePostTermsForInternetSearch(query = {}) {
  const sourceId = parseSourceId(query.sourceId || query.id)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    query.sourceLanguageCode,
    'sourceLanguageCode'
  )
  const sourcePost = await getSourcePostSummary(sourceId)
  const RelationModel = getRelationModel()
  const TermModel = getTermModel()
  const relationMatch = buildRelationMatch({ sourceId, sourceLanguageCode })
  const relationList = await RelationModel.find(relationMatch)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(MAX_INTERNET_SEARCH_TERM_COUNT + 1)
    .lean()
  const hasMore = relationList.length > MAX_INTERNET_SEARCH_TERM_COUNT
  const visibleRelations = relationList.slice(0, MAX_INTERNET_SEARCH_TERM_COUNT)
  const termIdList = visibleRelations.map(relation => relation.termId)
  if (termIdList.length === 0) {
    return {
      sourcePost,
      terms: [],
      total: 0,
      hasMore: false,
      maxCount: MAX_INTERNET_SEARCH_TERM_COUNT
    }
  }

  const terms = await TermModel.find({
    _id: { $in: termIdList },
    enabled: true
  }).lean()
  const termMap = new Map()
  terms.forEach(term => {
    termMap.set(String(term._id), term)
  })
  return {
    sourcePost,
    terms: visibleRelations
      .map(relation => termMap.get(String(relation.termId || '')))
      .filter(Boolean),
    total: visibleRelations.length,
    hasMore,
    maxCount: MAX_INTERNET_SEARCH_TERM_COUNT
  }
}

async function findTermById(termId) {
  const TermModel = getTermModel()
  const term = await TermModel.findOne({
    _id: parseObjectId(termId, 'termId'),
    enabled: true
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

async function resolveTermForBind(body = {}) {
  const termId = normalizeString(body.termId, 80)
  if (termId) {
    return await findTermById(termId)
  }

  const sourceText = properNounTranslationService.normalizeSourceText(
    body.sourceText
  )
  if (!sourceText) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '原文名词不能为空',
      'sourceText',
      400
    )
  }
  return await properNounTranslationService.findOrCreateTermForSourceText(
    sourceText,
    {
      sourceLanguageCode: body.sourceLanguageCode,
      note: body.note
    }
  )
}

async function bindTermToSourcePost({
  sourceId,
  sourceLanguageCode = '',
  termId,
  relationSource = 'manual',
  sourcePost = null,
  note = '',
  lastOrganizedAt = null
}) {
  const RelationModel = getRelationModel()
  const snapshotPayload = buildRelationSnapshotPayload(sourcePost)
  const payload = {
    sourceCollection: SOURCE_COLLECTION_POSTS,
    sourceId,
    sourceLanguageCode,
    termId,
    relationSource: normalizeRelationSource(relationSource),
    note: normalizeString(note, 1000),
    enabled: true,
    ...snapshotPayload
  }
  if (lastOrganizedAt) {
    payload.lastOrganizedAt = lastOrganizedAt
  }
  return await RelationModel.findOneAndUpdate(
    {
      sourceCollection: SOURCE_COLLECTION_POSTS,
      sourceId,
      termId
    },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
}

async function createOrBindSourcePostTerm(body = {}) {
  const sourceId = parseSourceId(body.sourceId || body.id)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    body.sourceLanguageCode,
    'sourceLanguageCode'
  )
  const sourcePost = await getSourcePostSummary(sourceId)
  const term = await resolveTermForBind({
    ...body,
    sourceLanguageCode
  })
  const relation = await bindTermToSourcePost({
    sourceId,
    sourceLanguageCode,
    termId: term._id,
    relationSource: body.relationSource || 'manual',
    sourcePost,
    note: body.relationNote || ''
  })
  return {
    sourcePost,
    term,
    relation
  }
}

async function bindTermsToSourcePost({
  sourceId,
  sourceLanguageCode = '',
  termIds = [],
  relationSource = 'aiOrganize',
  sourcePost = null,
  lastOrganizedAt = new Date()
}) {
  const normalizedSourceId = parseSourceId(sourceId)
  const normalizedSourceLanguageCode = normalizeOptionalLanguageCode(
    sourceLanguageCode,
    'sourceLanguageCode'
  )
  let sourcePostSummary = sourcePost
  if (!sourcePostSummary) {
    sourcePostSummary = await getSourcePostSummary(normalizedSourceId)
  }
  const termIdList = getUniqueTermIdList(termIds)
  const relations = []
  for (const termId of termIdList) {
    relations.push(
      await bindTermToSourcePost({
        sourceId: normalizedSourceId,
        sourceLanguageCode: normalizedSourceLanguageCode,
        termId,
        relationSource,
        sourcePost: sourcePostSummary,
        lastOrganizedAt
      })
    )
  }
  return {
    sourcePost: sourcePostSummary,
    requestedCount: termIdList.length,
    relationCount: relations.length,
    relations
  }
}

async function bindOrganizedTermsToSourcePost({
  sourceId,
  sourceLanguageCode = '',
  sourcePost = null,
  extractedTerms = [],
  matchedTermIds = [],
  matchedTermLinks = [],
  relationSource = 'translationWorkflow',
  lastOrganizedAt = new Date()
}) {
  const resolvedTermIds = await resolveOrganizedTermIds({
    extractedTerms,
    matchedTermIds,
    matchedTermLinks,
    sourceLanguageCode
  })
  const bindResult = await bindTermsToSourcePost({
    sourceId,
    sourceLanguageCode,
    termIds: resolvedTermIds,
    relationSource,
    sourcePost,
    lastOrganizedAt
  })
  return {
    ...bindResult,
    matchedTermIds: resolvedTermIds
  }
}

async function getSourcePostTermRelationMap({
  sourceId,
  termIds = [],
  enabled = true
}) {
  const relationMap = new Map()
  const normalizedSourceId = parseSourceId(sourceId)
  const termIdList = getUniqueTermIdList(termIds)
  if (termIdList.length === 0) {
    return relationMap
  }

  const RelationModel = getRelationModel()
  const relationMatch = buildRelationMatch({
    sourceId: normalizedSourceId,
    enabled
  })
  relationMatch.termId = { $in: termIdList }
  const relations = await RelationModel.find(relationMatch).lean()
  relations.forEach(relation => {
    relationMap.set(String(relation.termId || ''), relation)
  })
  return relationMap
}

async function batchBindExistingTermsToSourcePost(body = {}) {
  const sourceId = parseSourceId(body.sourceId || body.id)
  const sourcePost = await getSourcePostSummary(sourceId)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    body.sourceLanguageCode || sourcePost.sourceLanguageCode,
    'sourceLanguageCode'
  )
  const termIdList = parseTermIdList(body.termIds || body.ids, 'termIds')
  const TermModel = getTermModel()
  const termList = await TermModel.find({
    _id: { $in: termIdList },
    enabled: true
  })
    .select('_id sourceText')
    .lean()
  const existingTermIdSet = new Set()
  termList.forEach(term => {
    existingTermIdSet.add(String(term._id))
  })
  const missingTermIds = termIdList
    .map(termId => String(termId))
    .filter(termId => {
      return !existingTermIdSet.has(termId)
    })
  if (missingTermIds.length > 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      `以下专有名词不存在或已停用：${missingTermIds.join('、')}`,
      'termIds',
      400,
      { missingTermIds }
    )
  }

  const existingRelationMap = await getSourcePostTermRelationMap({
    sourceId,
    termIds: termIdList,
    enabled: true
  })
  const bindTermIdList = termIdList.filter(termId => {
    return !existingRelationMap.has(String(termId))
  })
  const relations = []
  for (const termId of bindTermIdList) {
    relations.push(
      await bindTermToSourcePost({
        sourceId,
        sourceLanguageCode,
        termId,
        relationSource: 'manual',
        sourcePost
      })
    )
  }

  let requestedCount = 0
  const requestedValues = body.termIds || body.ids
  if (Array.isArray(requestedValues)) {
    requestedCount = requestedValues.length
  }

  return {
    sourcePost,
    requestedCount,
    uniqueRequestedCount: termIdList.length,
    boundCount: relations.length,
    skippedAlreadyBoundCount: existingRelationMap.size,
    relations
  }
}

async function unbindSourcePostTerm(query = {}) {
  const RelationModel = getRelationModel()
  const id = normalizeString(query.id, 80)
  let result = null
  if (id) {
    result = await RelationModel.deleteOne({
      _id: parseObjectId(id, 'id')
    })
  } else {
    const sourceId = parseSourceId(query.sourceId)
    const termId = parseObjectId(query.termId, 'termId')
    result = await RelationModel.deleteOne({
      sourceCollection: SOURCE_COLLECTION_POSTS,
      sourceId,
      termId
    })
  }
  if (!result || result.deletedCount === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '文章名词关联不存在',
      'id',
      404
    )
  }
  return {
    deletedCount: result.deletedCount
  }
}

async function deleteRelationsByTermIds(termIds) {
  const termIdList = getUniqueTermIdList(termIds)
  if (termIdList.length === 0) {
    return { deletedCount: 0 }
  }
  const RelationModel = getRelationModel()
  const result = await RelationModel.deleteMany({
    termId: { $in: termIdList }
  })
  return {
    deletedCount: result.deletedCount || 0
  }
}

function appendUniqueTermId(termIdList, value) {
  const idText = getTermIdText(value)
  if (!mongoose.Types.ObjectId.isValid(idText)) {
    return
  }
  if (termIdList.some(termId => String(termId) === idText)) {
    return
  }
  termIdList.push(new mongoose.Types.ObjectId(idText))
}

async function resolveOrganizedTermIds({
  extractedTerms = [],
  matchedTermIds = [],
  matchedTermLinks = [],
  sourceLanguageCode = ''
}) {
  const termIdList = []
  getUniqueTermIdList(matchedTermIds).forEach(termId => {
    appendUniqueTermId(termIdList, termId)
  })
  const linkedNormalizedSourceTextSet = new Set()
  if (Array.isArray(matchedTermLinks)) {
    matchedTermLinks.forEach(link => {
      const normalizedSourceText = normalizeString(
        link?.normalizedSourceText,
        300
      )
      if (normalizedSourceText) {
        linkedNormalizedSourceTextSet.add(normalizedSourceText)
      }
    })
  }
  if (!Array.isArray(extractedTerms)) {
    return termIdList
  }
  for (const termItem of extractedTerms) {
    const sourceText = normalizeSourceText(termItem?.sourceText || termItem)
    const normalizedSourceText = buildNormalizedSourceText(sourceText)
    if (
      !sourceText ||
      linkedNormalizedSourceTextSet.has(normalizedSourceText)
    ) {
      continue
    }
    const term =
      await properNounTranslationService.findOrCreateTermForSourceText(
        sourceText,
        {
          sourceLanguageCode,
          note: termItem?.note || '',
          protectStarredTermFieldsFromAi: true
        }
      )
    appendUniqueTermId(termIdList, term._id)
  }
  return termIdList
}

function getSourcePostIdFromScopeKey(scopeKey) {
  const text = normalizeString(scopeKey, 120)
  const prefixList = ['sourcePostImport:', 'sourcePost:']
  for (const prefix of prefixList) {
    if (!text.startsWith(prefix)) {
      continue
    }
    const idText = text.slice(prefix.length)
    if (mongoose.Types.ObjectId.isValid(idText)) {
      return idText
    }
  }
  return ''
}

function normalizeTargetLanguageCodes(targetLanguageCodes) {
  const languageCodes = []
  if (!Array.isArray(targetLanguageCodes)) {
    return languageCodes
  }
  targetLanguageCodes.forEach(value => {
    const languageCode = normalizeLanguageCode(value)
    if (languageCode && !languageCodes.includes(languageCode)) {
      languageCodes.push(languageCode)
    }
  })
  return languageCodes
}

function normalizeSourceText(value) {
  return properNounTranslationService.normalizeSourceText(value)
}

function buildNormalizedSourceText(value) {
  return properNounTranslationService.buildNormalizedSourceText(value)
}

function buildLooseSourceTextIdentity(value) {
  return properNounTranslationService.buildLooseSourceTextIdentity(value)
}

function getCandidateKeywordList(sourceTextItem) {
  const keywordList = []
  if (Array.isArray(sourceTextItem?.searchKeywords)) {
    sourceTextItem.searchKeywords.forEach(keyword => {
      const normalizedKeyword = buildNormalizedSourceText(keyword)
      if (normalizedKeyword && !keywordList.includes(normalizedKeyword)) {
        keywordList.push(normalizedKeyword)
      }
      const looseKeyword = buildLooseSourceTextIdentity(keyword)
      if (looseKeyword && !keywordList.includes(looseKeyword)) {
        keywordList.push(looseKeyword)
      }
    })
  }
  const sourceText = normalizeSourceText(sourceTextItem?.sourceText)
  const normalizedSourceText = buildNormalizedSourceText(sourceText)
  if (normalizedSourceText && !keywordList.includes(normalizedSourceText)) {
    keywordList.push(normalizedSourceText)
  }
  const looseSourceText = buildLooseSourceTextIdentity(sourceText)
  if (looseSourceText && !keywordList.includes(looseSourceText)) {
    keywordList.push(looseSourceText)
  }
  return keywordList
}

function isTermMatchedToSourceTextItem(term, sourceTextItem) {
  const termText = normalizeSourceText(term?.sourceText)
  const normalizedTermText = buildNormalizedSourceText(
    term?.normalizedSourceText || termText
  )
  const looseTermText = buildLooseSourceTextIdentity(
    term?.normalizedSourceText || termText
  )
  const keywordList = getCandidateKeywordList(sourceTextItem)
  for (const keyword of keywordList) {
    if (normalizedTermText && normalizedTermText.includes(keyword)) {
      return true
    }
    if (normalizedTermText && keyword.includes(normalizedTermText)) {
      return true
    }
    const looseKeyword = buildLooseSourceTextIdentity(keyword)
    if (!looseKeyword || !looseTermText) {
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

function buildMatchedSourceTextItemsForLinkedTerm(term, sourceTextItems) {
  const matchedItems = sourceTextItems.filter(sourceTextItem => {
    return isTermMatchedToSourceTextItem(term, sourceTextItem)
  })
  let finalItems = matchedItems
  if (finalItems.length === 0) {
    finalItems = sourceTextItems
  }
  return finalItems.map(item => {
    return {
      sourceText: item.sourceText,
      normalizedSourceText: item.normalizedSourceText,
      note: item.note || '',
      importance: item.importance || 0
    }
  })
}

function attachLinkedCandidateTranslations(termList, translationList) {
  const termTranslationMap = new Map()
  translationList.forEach(translation => {
    const termId = String(translation.termId || '')
    if (!termId) {
      return
    }
    if (!termTranslationMap.has(termId)) {
      termTranslationMap.set(termId, [])
    }
    termTranslationMap.get(termId).push(translation)
  })
  return termList.map(term => {
    return {
      ...term,
      translations: termTranslationMap.get(String(term._id)) || []
    }
  })
}

function mergeMatchedSourceTextItems(leftItems, rightItems) {
  const itemMap = new Map()
  const appendItem = item => {
    const key = String(item?.normalizedSourceText || '')
    if (!key || itemMap.has(key)) {
      return
    }
    itemMap.set(key, {
      sourceText: item.sourceText || '',
      normalizedSourceText: key,
      note: item.note || '',
      importance: item.importance || 0
    })
  }
  if (Array.isArray(leftItems)) {
    leftItems.forEach(appendItem)
  }
  if (Array.isArray(rightItems)) {
    rightItems.forEach(appendItem)
  }
  return Array.from(itemMap.values())
}

function mergeCandidateTerms(candidateTerms, linkedTerms) {
  const termMap = new Map()
  candidateTerms.forEach(term => {
    const termId = String(term?._id || '')
    if (!termId) {
      return
    }
    termMap.set(termId, term)
  })
  linkedTerms.forEach(linkedTerm => {
    const termId = String(linkedTerm?._id || '')
    if (!termId) {
      return
    }
    const existing = termMap.get(termId)
    if (!existing) {
      termMap.set(termId, {
        ...linkedTerm,
        articleLinked: true
      })
      return
    }
    termMap.set(termId, {
      ...existing,
      articleLinked: true,
      translations: mergeTranslationArray(
        existing.translations || [],
        linkedTerm.translations || []
      ),
      matchedSourceTextItems: mergeMatchedSourceTextItems(
        existing.matchedSourceTextItems,
        linkedTerm.matchedSourceTextItems
      )
    })
  })
  return Array.from(termMap.values())
}

function getTranslationDeduplicationKey(translation) {
  const idText = String(translation?._id || '')
  if (idText) {
    return `id:${idText}`
  }
  return [
    'term',
    String(translation?.termId || ''),
    String(translation?.languageCode || '')
  ].join(':')
}

function mergeTranslationArray(leftList, rightList) {
  const translationMap = new Map()
  const appendTranslation = translation => {
    const key = getTranslationDeduplicationKey(translation)
    if (!key || translationMap.has(key)) {
      return
    }
    translationMap.set(key, translation)
  }
  if (Array.isArray(leftList)) {
    leftList.forEach(appendTranslation)
  }
  if (Array.isArray(rightList)) {
    rightList.forEach(appendTranslation)
  }
  return Array.from(translationMap.values())
}

async function getArticleLinkedCandidateTerms({
  sourcePostId,
  sourceLanguageCode = '',
  sourceTextItems = [],
  targetLanguageCodes = []
}) {
  if (!mongoose.Types.ObjectId.isValid(sourcePostId)) {
    return {
      candidateTerms: [],
      translations: []
    }
  }
  const languageCodes = normalizeTargetLanguageCodes(targetLanguageCodes)
  if (languageCodes.length === 0 || sourceTextItems.length === 0) {
    return {
      candidateTerms: [],
      translations: []
    }
  }
  const RelationModel = getRelationModel()
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  // 绑定关系由 sourceId 唯一确定，源文章只有一种源语言。
  // 手动绑定或历史关系快照的 sourceLanguageCode 可能为空，
  // 不按源语言过滤，避免漏掉已绑定的专有名词。
  const relationMatch = buildRelationMatch({
    sourceId: new mongoose.Types.ObjectId(sourcePostId)
  })
  const relations = await RelationModel.find(relationMatch)
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const termIdList = getUniqueTermIdList(
    relations.map(relation => relation.termId)
  )
  if (termIdList.length === 0) {
    return {
      candidateTerms: [],
      translations: []
    }
  }
  const termList = await TermModel.find({
    _id: { $in: termIdList },
    enabled: true
  }).lean()
  if (termList.length === 0) {
    return {
      candidateTerms: [],
      translations: []
    }
  }
  const translationList = await TranslationModel.find({
    termId: { $in: termList.map(term => term._id) },
    languageCode: { $in: languageCodes },
    enabled: true
  }).lean()
  const linkedTerms = attachLinkedCandidateTranslations(
    termList.map(term => {
      return {
        ...term,
        articleLinked: true,
        matchedSourceTextItems: buildMatchedSourceTextItemsForLinkedTerm(
          term,
          sourceTextItems
        )
      }
    }),
    translationList
  )
  return {
    candidateTerms: linkedTerms,
    translations: translationList
  }
}

function buildEmptyLinkedTermGlossaryCoverage(languageCodes = []) {
  return {
    sourceTextItems: [],
    candidateTerms: [],
    translations: [],
    matchedTermIds: [],
    matchedTermLinks: [],
    coverage: {
      sourceTextItems: [],
      languageCodes,
      translations: [],
      existingTerms: [],
      missingTerms: [],
      candidateTerms: []
    }
  }
}

async function getSourcePostLinkedTermGlossaryCoverage({
  sourcePostId,
  sourceLanguageCode = '',
  targetLanguageCodes = []
} = {}) {
  if (!mongoose.Types.ObjectId.isValid(sourcePostId)) {
    return buildEmptyLinkedTermGlossaryCoverage()
  }

  const languageCodes = normalizeTargetLanguageCodes(targetLanguageCodes)
  if (languageCodes.length === 0) {
    return buildEmptyLinkedTermGlossaryCoverage(languageCodes)
  }

  const sourceId = new mongoose.Types.ObjectId(sourcePostId)
  const normalizedSourceLanguageCode = normalizeOptionalLanguageCode(
    sourceLanguageCode,
    'sourceLanguageCode'
  )
  const RelationModel = getRelationModel()
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  // 一篇源文章只有一种源语言，绑定关系由 sourceId 唯一确定。
  // 手动绑定或历史数据的关系快照里 sourceLanguageCode 可能为空，
  // 因此这里不按源语言过滤，避免漏掉已绑定的专有名词词库。
  const relations = await RelationModel.find(
    buildRelationMatch({
      sourceId
    })
  )
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const termIdList = getUniqueTermIdList(
    relations.map(relation => relation.termId)
  )
  if (termIdList.length === 0) {
    return buildEmptyLinkedTermGlossaryCoverage(languageCodes)
  }

  const termList = await TermModel.find({
    _id: { $in: termIdList },
    enabled: true
  }).lean()
  const termMap = new Map()
  termList.forEach(term => {
    termMap.set(String(term._id), term)
  })
  const orderedTermList = termIdList
    .map(termId => termMap.get(String(termId)))
    .filter(Boolean)
  if (orderedTermList.length === 0) {
    return buildEmptyLinkedTermGlossaryCoverage(languageCodes)
  }

  const translationList = await TranslationModel.find({
    termId: { $in: orderedTermList.map(term => term._id) },
    languageCode: { $in: languageCodes },
    enabled: true
  }).lean()
  const candidateTerms = orderedTermList.map(term => {
    return {
      ...term,
      articleLinked: true
    }
  })
  const sourceTextItems = orderedTermList.map(term => {
    return {
      sourceText: term.sourceText,
      sourceLanguageCode:
        term.sourceLanguageCode || normalizedSourceLanguageCode,
      note: term.note || ''
    }
  })
  const matchedTermIds = orderedTermList.map(term => String(term._id))
  const coverage =
    await properNounTranslationService.compareMatchedTermTranslationCoverage({
      terms: sourceTextItems,
      targetLanguageCodes: languageCodes,
      candidateTerms,
      translations: translationList,
      matchedTermIds
    })

  return {
    sourceTextItems: coverage.sourceTextItems,
    candidateTerms,
    translations: translationList,
    matchedTermIds,
    matchedTermLinks: [],
    coverage
  }
}

async function mergeArticleLinkedCandidateCoverage({
  scopeKey = '',
  sourceLanguageCode = '',
  candidateCoverage,
  targetLanguageCodes = []
}) {
  if (!candidateCoverage) {
    return candidateCoverage
  }
  const sourcePostId = getSourcePostIdFromScopeKey(scopeKey)
  if (!sourcePostId) {
    return candidateCoverage
  }
  const linkedCoverage = await getArticleLinkedCandidateTerms({
    sourcePostId,
    sourceLanguageCode,
    sourceTextItems: candidateCoverage.sourceTextItems || [],
    targetLanguageCodes
  })
  if (linkedCoverage.candidateTerms.length === 0) {
    return candidateCoverage
  }
  return {
    ...candidateCoverage,
    candidateTerms: mergeCandidateTerms(
      candidateCoverage.candidateTerms || [],
      linkedCoverage.candidateTerms
    ),
    translations: mergeTranslationArray(
      candidateCoverage.translations || [],
      linkedCoverage.translations || []
    ),
    articleLinkedCandidateCount: linkedCoverage.candidateTerms.length
  }
}

const SOURCE_POST_TERM_EXPORT_SCHEMA =
  'wikimoe.proper-noun.source-post-terms.export'
const SOURCE_POST_TERM_EXPORT_VERSION = 1
const MAX_IMPORT_TERM_COUNT = 500
const MAX_IMPORT_TRANSLATION_COUNT_PER_TERM = 50

/**
 * 规范化导出/模板所选的译名语言列表（至少需要一种）
 * @param {(string[]|string)} value - 语言代码数组或以逗号分隔的字符串
 * @returns {string[]} 去重后的合法语言代码列表
 */
function normalizeExportLanguageCodes(value) {
  let rawList = []
  if (Array.isArray(value)) {
    rawList = value
  } else if (typeof value === 'string') {
    rawList = value.split(',')
  }
  const codeMap = new Map()
  rawList.forEach(item => {
    const text = normalizeString(item, 20)
    if (!text) {
      return
    }
    const languageCode = normalizeLanguageCode(text)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        `译名语言代码不受支持：${text}`,
        'languageCodes',
        400
      )
    }
    if (!codeMap.has(languageCode)) {
      codeMap.set(languageCode, languageCode)
    }
  })
  const languageCodes = Array.from(codeMap.values())
  if (languageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一种译名语言',
      'languageCodes',
      400
    )
  }
  return languageCodes
}

/**
 * 将单条导入译名数据规范化；译名内容为空（含模板中的 null 占位）时返回 null 以跳过
 * @param {Object} rawTranslation - 译名原始数据
 * @param {number} termIndex - 名词在导入列表中的序号（从 0 开始）
 * @param {number} translationIndex - 译名在该名词下的序号（从 0 开始）
 * @returns {({languageCode: string, translatedText: string, note: string}|null)}
 */
function normalizeImportTranslationEntry(
  rawTranslation,
  termIndex,
  translationIndex
) {
  const positionText = `第 ${termIndex + 1} 个名词的第 ${
    translationIndex + 1
  } 个译名`
  if (
    !rawTranslation ||
    typeof rawTranslation !== 'object' ||
    Array.isArray(rawTranslation)
  ) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${positionText}格式不正确`,
      'terms',
      400
    )
  }
  const translatedText = normalizeString(rawTranslation.translatedText, 300)
  if (!translatedText) {
    // 译名内容为空（如模板中的 null 占位）时跳过，不写入空译名
    return null
  }
  let languageCode = ''
  try {
    languageCode = normalizeOptionalLanguageCode(
      rawTranslation.languageCode,
      'languageCode'
    )
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      `${positionText}的语言代码不受支持：${normalizeString(
        rawTranslation.languageCode,
        20
      )}`,
      'terms',
      400
    )
  }
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${positionText}缺少语言代码`,
      'terms',
      400
    )
  }
  return {
    languageCode,
    translatedText,
    note: normalizeString(rawTranslation.note, 2000)
  }
}

/**
 * 将单条导入名词数据规范化并校验
 * @param {Object} rawTerm - 名词原始数据
 * @param {number} termIndex - 名词在导入列表中的序号（从 0 开始）
 * @returns {{id: string, objectId: (mongoose.Types.ObjectId|null), sourceText: string, sourceLanguageCode: string, note: string, translations: Array}}
 */
function normalizeImportTermEntry(rawTerm, termIndex) {
  const positionText = `第 ${termIndex + 1} 个名词`
  if (!rawTerm || typeof rawTerm !== 'object' || Array.isArray(rawTerm)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${positionText}格式不正确`,
      'terms',
      400
    )
  }
  const idText = normalizeString(rawTerm.id || rawTerm._id, 80)
  let objectId = null
  if (idText) {
    if (!mongoose.Types.ObjectId.isValid(idText)) {
      throw new ApiError(
        ERROR_CODES.CONTENT_ID_INVALID,
        `${positionText}的 id 格式不正确：${idText}`,
        'terms',
        400
      )
    }
    objectId = new mongoose.Types.ObjectId(idText)
  }
  const sourceText = properNounTranslationService.normalizeSourceText(
    rawTerm.sourceText
  )
  if (!sourceText) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${positionText}缺少原文名词`,
      'terms',
      400
    )
  }
  let sourceLanguageCode = ''
  try {
    sourceLanguageCode = normalizeOptionalLanguageCode(
      rawTerm.sourceLanguageCode,
      'sourceLanguageCode'
    )
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      `${positionText}的原文语言代码不受支持：${normalizeString(
        rawTerm.sourceLanguageCode,
        20
      )}`,
      'terms',
      400
    )
  }
  const rawTranslations = Array.isArray(rawTerm.translations)
    ? rawTerm.translations
    : []
  if (rawTranslations.length > MAX_IMPORT_TRANSLATION_COUNT_PER_TERM) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${positionText}的译名数量超过上限 ${MAX_IMPORT_TRANSLATION_COUNT_PER_TERM}`,
      'terms',
      400
    )
  }
  const translationMap = new Map()
  rawTranslations.forEach((rawTranslation, translationIndex) => {
    const translation = normalizeImportTranslationEntry(
      rawTranslation,
      termIndex,
      translationIndex
    )
    if (!translation) {
      return
    }
    translationMap.set(translation.languageCode, translation)
  })
  return {
    id: idText,
    objectId,
    sourceText,
    sourceLanguageCode,
    note: normalizeString(rawTerm.note, 2000),
    translations: Array.from(translationMap.values())
  }
}

/**
 * 解析并完整校验导入名词列表，并为每个条目预解析其在库中的现有名词（供导入与预览共用）
 * @param {Object} body - 导入参数
 * @returns {Promise<{sourceId: mongoose.Types.ObjectId, sourcePost: Object, sourceLanguageCode: string, entries: Array}>}
 */
async function prepareSourcePostTermImportEntries(body = {}) {
  const sourceId = parseSourceId(body.sourceId || body.id)
  const sourcePost = await getSourcePostSummary(sourceId)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    body.sourceLanguageCode || sourcePost.sourceLanguageCode,
    'sourceLanguageCode'
  )

  const rawTerms = Array.isArray(body.terms) ? body.terms : null
  if (!rawTerms) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '导入数据格式不正确，缺少 terms 名词列表',
      'terms',
      400
    )
  }
  if (rawTerms.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '导入数据为空',
      'terms',
      400
    )
  }
  if (rawTerms.length > MAX_IMPORT_TERM_COUNT) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `单次最多导入 ${MAX_IMPORT_TERM_COUNT} 个名词`,
      'terms',
      400
    )
  }

  const entries = rawTerms.map((rawTerm, termIndex) => {
    return normalizeImportTermEntry(rawTerm, termIndex)
  })

  const TermModel = getTermModel()

  // 一次性加载所有提供了 id 的名词，并校验其均存在
  const providedObjectIdMap = new Map()
  entries.forEach(entry => {
    if (entry.objectId) {
      providedObjectIdMap.set(entry.id, entry.objectId)
    }
  })
  const idTermMap = new Map()
  if (providedObjectIdMap.size > 0) {
    const idTermRows = await TermModel.find({
      _id: { $in: Array.from(providedObjectIdMap.values()) }
    }).lean()
    idTermRows.forEach(term => {
      idTermMap.set(String(term._id), term)
    })
    const missingIds = Array.from(providedObjectIdMap.keys()).filter(id => {
      return !idTermMap.has(id)
    })
    if (missingIds.length > 0) {
      throw new ApiError(
        ERROR_CODES.CONTENT_NOT_FOUND,
        `以下名词 id 在数据库中不存在：${missingIds.join('、')}`,
        'terms',
        400,
        { missingIds }
      )
    }
  }

  // 一次性按原文名词加载未提供 id 的名词，用于判断新增 / 匹配既有
  const normalizedTextSet = new Set()
  entries.forEach(entry => {
    if (!entry.objectId) {
      normalizedTextSet.add(
        properNounTranslationService.buildNormalizedSourceText(entry.sourceText)
      )
    }
  })
  const normalizedTextTermMap = new Map()
  if (normalizedTextSet.size > 0) {
    const noIdTermRows = await TermModel.find({
      normalizedSourceText: { $in: Array.from(normalizedTextSet) }
    }).lean()
    noIdTermRows.forEach(term => {
      const key = term.normalizedSourceText
      if (!normalizedTextTermMap.has(key)) {
        normalizedTextTermMap.set(key, term)
      }
    })
  }

  entries.forEach(entry => {
    if (entry.objectId) {
      entry.existingTerm = idTermMap.get(entry.id) || null
      return
    }
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(entry.sourceText)
    entry.existingTerm = normalizedTextTermMap.get(normalizedSourceText) || null
  })

  return { sourceId, sourcePost, sourceLanguageCode, entries }
}

/**
 * 按所选语言构建一个名词的导出译名数组；缺少译名的语言输出 null 占位
 * @param {Map<string, Object>} languageTranslationMap - 语言代码到译名的映射
 * @param {string[]} languageCodes - 所选语言代码列表
 * @returns {Array<{languageCode: string, translatedText: (string|null), note: (string|null)}>}
 */
function buildExportTranslationList(languageTranslationMap, languageCodes) {
  return languageCodes.map(languageCode => {
    const translation = languageTranslationMap.get(languageCode)
    if (!translation) {
      return {
        languageCode,
        translatedText: null,
        note: null
      }
    }
    return {
      languageCode,
      translatedText: translation.translatedText || '',
      note: translation.note || ''
    }
  })
}

/**
 * 构建源文章名词导出的空白模板
 * @param {string[]} languageCodes - 所选译名语言代码列表
 * @returns {Object} 模板数据
 */
function buildSourcePostTermExportTemplate(languageCodes) {
  return {
    schema: SOURCE_POST_TERM_EXPORT_SCHEMA,
    version: SOURCE_POST_TERM_EXPORT_VERSION,
    sourceId: '',
    sourcePostTitle: '',
    languageCodes,
    terms: [
      {
        id: '',
        sourceText: '示例名词（新增名词时请将 id 留空）',
        sourceLanguageCode: 'ja-JP',
        note: '名词注释（可选）',
        translations: languageCodes.map((languageCode, index) => {
          if (index === 0) {
            return {
              languageCode,
              translatedText: '示例译名',
              note: '译名注释（可选）'
            }
          }
          return {
            languageCode,
            translatedText: null,
            note: null
          }
        })
      }
    ]
  }
}

/**
 * 导出源文章关联的所有名词及译名，或仅导出空白模板
 * @param {Object} body - 参数
 * @param {string} body.sourceId - 源文章 id
 * @param {(string[]|string)} body.languageCodes - 所选译名语言列表
 * @param {boolean} [body.templateOnly] - 是否仅导出模板
 * @returns {Promise<Object>} 导出数据
 */
async function exportSourcePostTerms(body = {}) {
  const languageCodes = normalizeExportLanguageCodes(body.languageCodes)
  const templateOnly =
    body.templateOnly === true || body.templateOnly === 'true'
  if (templateOnly) {
    return buildSourcePostTermExportTemplate(languageCodes)
  }

  const sourceId = parseSourceId(body.sourceId || body.id)
  const sourceLanguageCode = normalizeOptionalLanguageCode(
    body.sourceLanguageCode,
    'sourceLanguageCode'
  )
  const sourcePost = await getSourcePostSummary(sourceId)
  const RelationModel = getRelationModel()
  const TermModel = getTermModel()
  const TranslationModel = getTranslationModel()
  const relationMatch = buildRelationMatch({ sourceId, sourceLanguageCode })
  const relationList = await RelationModel.find(relationMatch)
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
  const relationTermIdList = relationList.map(relation => relation.termId)

  let terms = []
  if (relationTermIdList.length > 0) {
    const termRows = await TermModel.find({
      _id: { $in: relationTermIdList },
      enabled: true
    }).lean()
    const termMap = new Map()
    termRows.forEach(term => {
      termMap.set(String(term._id), term)
    })
    const translationRows = await TranslationModel.find({
      termId: { $in: termRows.map(term => term._id) },
      languageCode: { $in: languageCodes },
      enabled: true
    })
      .sort({ languageCode: 1, updatedAt: -1 })
      .lean()
    const termLanguageTranslationMap = new Map()
    translationRows.forEach(translation => {
      const key = String(translation.termId || '')
      if (!termLanguageTranslationMap.has(key)) {
        termLanguageTranslationMap.set(key, new Map())
      }
      const languageTranslationMap = termLanguageTranslationMap.get(key)
      if (!languageTranslationMap.has(translation.languageCode)) {
        languageTranslationMap.set(translation.languageCode, translation)
      }
    })
    terms = relationList
      .map(relation => termMap.get(String(relation.termId || '')))
      .filter(Boolean)
      .map(term => {
        const languageTranslationMap =
          termLanguageTranslationMap.get(String(term._id)) || new Map()
        return {
          id: String(term._id),
          sourceText: term.sourceText || '',
          sourceLanguageCode: term.sourceLanguageCode || '',
          note: term.note || '',
          translations: buildExportTranslationList(
            languageTranslationMap,
            languageCodes
          )
        }
      })
  }

  return {
    schema: SOURCE_POST_TERM_EXPORT_SCHEMA,
    version: SOURCE_POST_TERM_EXPORT_VERSION,
    sourceId: String(sourceId),
    sourcePostTitle: sourcePost.title || '',
    languageCodes,
    terms
  }
}

/**
 * 解析导入计划：批量读取既有名词/译名/关联，逐条计算真实变化与所需操作（供导入与预览共用）
 * @param {Object} body - 导入参数
 * @returns {Promise<{sourceId: mongoose.Types.ObjectId, sourcePost: Object, sourceLanguageCode: string, plans: Array}>}
 */
async function resolveImportPlan(body = {}) {
  const { sourceId, sourcePost, sourceLanguageCode, entries } =
    await prepareSourcePostTermImportEntries(body)

  const TranslationModel = getTranslationModel()
  const RelationModel = getRelationModel()

  const existingTermIdList = []
  entries.forEach(entry => {
    if (entry.existingTerm) {
      existingTermIdList.push(entry.existingTerm._id)
    }
  })

  // 一次性加载所有现有名词的译名
  const translationKeyMap = new Map()
  if (existingTermIdList.length > 0) {
    const translationRows = await TranslationModel.find({
      termId: { $in: existingTermIdList }
    }).lean()
    translationRows.forEach(translation => {
      const key = `${String(translation.termId)}|${translation.languageCode}`
      translationKeyMap.set(key, translation)
    })
  }

  // 一次性加载现有名词与当前文章的绑定关系
  const boundTermIdSet = new Set()
  if (existingTermIdList.length > 0) {
    const relationRows = await RelationModel.find({
      sourceCollection: SOURCE_COLLECTION_POSTS,
      sourceId,
      termId: { $in: existingTermIdList },
      enabled: true
    })
      .select('termId')
      .lean()
    relationRows.forEach(relation => {
      boundTermIdSet.add(String(relation.termId))
    })
  }

  const plans = entries.map((entry, index) => {
    const existingTerm = entry.existingTerm
    const isIdEntry = Boolean(entry.objectId)
    const previousSourceText = existingTerm ? existingTerm.sourceText || '' : ''
    const previousSourceLanguageCode = existingTerm
      ? existingTerm.sourceLanguageCode || ''
      : ''
    const previousNote = existingTerm ? existingTerm.note || '' : ''
    const termIdKey = existingTerm ? String(existingTerm._id) : ''

    // 计算名词字段是否真正发生变化（与导入实际写入行为保持一致）
    let sourceTextChanged = false
    let sourceLanguageCodeChanged = false
    let noteChanged = false
    if (existingTerm) {
      noteChanged = previousNote !== entry.note
      if (isIdEntry) {
        // 提供 id 时执行 updateTerm，会整体覆盖原文、原文语言、备注
        sourceTextChanged = previousSourceText !== entry.sourceText
        sourceLanguageCodeChanged =
          previousSourceLanguageCode !== (entry.sourceLanguageCode || '')
      } else {
        // 未提供 id 时按原文匹配既有名词：原文不变，原文语言仅在原为空时补充
        sourceLanguageCodeChanged =
          !previousSourceLanguageCode && Boolean(entry.sourceLanguageCode)
      }
    }
    const termFieldsChanged =
      sourceTextChanged || sourceLanguageCodeChanged || noteChanged

    const translationPlans = entry.translations.map(translation => {
      let existingTranslation = null
      if (termIdKey) {
        existingTranslation = translationKeyMap.get(
          `${termIdKey}|${translation.languageCode}`
        )
      }
      let translationAction = 'create'
      let previousTranslatedText = null
      let previousTranslationNote = null
      let translationTextChanged = false
      let translationNoteChanged = false
      let existingTranslationId = null
      if (existingTranslation) {
        existingTranslationId = existingTranslation._id
        previousTranslatedText = existingTranslation.translatedText || ''
        previousTranslationNote = existingTranslation.note || ''
        translationTextChanged =
          previousTranslatedText !== translation.translatedText
        translationNoteChanged = previousTranslationNote !== translation.note
        if (translationTextChanged || translationNoteChanged) {
          translationAction = 'update'
        } else {
          translationAction = 'unchanged'
        }
      } else {
        translationTextChanged = true
        translationNoteChanged = Boolean(translation.note)
      }
      return {
        languageCode: translation.languageCode,
        translatedText: translation.translatedText,
        note: translation.note,
        action: translationAction,
        existingTranslationId,
        textChanged: translationTextChanged,
        noteChanged: translationNoteChanged,
        previousTranslatedText,
        previousNote: previousTranslationNote
      }
    })

    const hasTranslationChange = translationPlans.some(translationPlan => {
      return translationPlan.action !== 'unchanged'
    })

    let action = 'create'
    if (existingTerm) {
      if (termFieldsChanged || hasTranslationChange) {
        action = 'update'
      } else {
        action = 'unchanged'
      }
    }

    const alreadyBound = existingTerm ? boundTermIdSet.has(termIdKey) : false
    const needsBind = !alreadyBound
    const needsWork =
      !existingTerm || termFieldsChanged || hasTranslationChange || needsBind

    return {
      index,
      entry,
      existingTerm,
      isIdEntry,
      action,
      sourceTextChanged,
      sourceLanguageCodeChanged,
      noteChanged,
      previousSourceText,
      previousSourceLanguageCode,
      previousNote,
      termFieldsChanged,
      hasTranslationChange,
      alreadyBound,
      needsBind,
      needsWork,
      translationPlans
    }
  })

  return { sourceId, sourcePost, sourceLanguageCode, plans }
}

/**
 * 导入源文章名词：有 id 则更新、无 id 则新增，并绑定到当前文章
 * @param {Object} body - 导入参数
 * @param {string} body.sourceId - 源文章 id
 * @param {string} [body.sourceLanguageCode] - 源文章语言代码
 * @param {Array} body.terms - 名词列表
 * @param {Object} [options] - 选项
 * @param {Function} [options.onProgress] - 进度回调，参数为 { processedCount, totalCount, createdCount, updatedCount }
 * @param {Object} [options.cancellation] - 取消上下文，含 isCancelled
 * @returns {Promise<Object>} 导入结果统计
 */
async function importSourcePostTerms(body = {}, options = {}) {
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : null
  const cancellation = options.cancellation || null

  const { sourceId, sourcePost, sourceLanguageCode, plans } =
    await resolveImportPlan(body)

  // 只处理真正需要变更的条目（内容有变化或尚未关联），跳过无变化且已关联的条目
  const workPlans = plans.filter(plan => plan.needsWork)
  const totalCount = workPlans.length
  const skippedCount = plans.length - workPlans.length
  let createdCount = 0
  let updatedCount = 0
  let translationUpsertCount = 0
  let processedCount = 0
  const boundTermIdSet = new Set()

  if (onProgress) {
    onProgress({
      processedCount,
      totalCount,
      createdCount,
      updatedCount
    })
  }

  for (const plan of workPlans) {
    if (cancellation && cancellation.isCancelled) {
      break
    }
    const entry = plan.entry
    let termId = null

    if (!plan.existingTerm) {
      const term =
        await properNounTranslationService.findOrCreateTermForSourceText(
          entry.sourceText,
          {
            sourceLanguageCode: entry.sourceLanguageCode,
            note: entry.note,
            shouldUpdateTermNote: true
          }
        )
      termId = term._id
      createdCount += 1
    } else {
      termId = plan.existingTerm._id
      // 仅当名词字段确有变化时才写名词文档
      if (plan.termFieldsChanged) {
        if (plan.isIdEntry) {
          await properNounTranslationService.updateTerm({
            id: entry.id,
            sourceText: entry.sourceText,
            sourceLanguageCode: entry.sourceLanguageCode,
            note: entry.note
          })
        } else {
          await properNounTranslationService.findOrCreateTermForSourceText(
            entry.sourceText,
            {
              sourceLanguageCode: entry.sourceLanguageCode,
              note: entry.note,
              shouldUpdateTermNote: true
            }
          )
        }
      }
      if (plan.action === 'update') {
        updatedCount += 1
      }
    }

    // 仅写入确有变化的译名
    for (const translationPlan of plan.translationPlans) {
      if (translationPlan.action === 'unchanged') {
        continue
      }
      if (translationPlan.existingTranslationId) {
        await properNounTranslationService.updateTranslation({
          id: translationPlan.existingTranslationId,
          termId,
          languageCode: translationPlan.languageCode,
          translatedText: translationPlan.translatedText,
          note: translationPlan.note,
          translationSource: 'imported'
        })
      } else {
        await properNounTranslationService.createTranslation({
          termId,
          languageCode: translationPlan.languageCode,
          translatedText: translationPlan.translatedText,
          note: translationPlan.note,
          translationSource: 'imported'
        })
      }
      translationUpsertCount += 1
    }

    // 仅在尚未关联时才创建关联
    if (plan.needsBind) {
      await bindTermToSourcePost({
        sourceId,
        sourceLanguageCode,
        termId,
        relationSource: 'manual',
        sourcePost
      })
      boundTermIdSet.add(String(termId))
    }

    processedCount += 1
    if (onProgress) {
      onProgress({
        processedCount,
        totalCount,
        createdCount,
        updatedCount
      })
    }
  }

  return {
    sourcePost,
    totalCount,
    processedCount,
    createdCount,
    updatedCount,
    translationUpsertCount,
    boundCount: boundTermIdSet.size,
    skippedCount,
    cancelled: Boolean(cancellation && cancellation.isCancelled)
  }
}

/**
 * 预览导入效果（只读，不写入）：标记新增 / 修改 / 无变化，并给出原值与新值对比
 * @param {Object} body - 导入参数
 * @param {string} body.sourceId - 源文章 id
 * @param {Array} body.terms - 名词列表
 * @returns {Promise<Object>} 预览数据
 */
async function previewImportSourcePostTerms(body = {}) {
  const { sourcePost, plans } = await resolveImportPlan(body)

  let createCount = 0
  let updateCount = 0
  let unchangedCount = 0
  const previewTerms = plans.map(plan => {
    if (plan.action === 'create') {
      createCount += 1
    } else if (plan.action === 'update') {
      updateCount += 1
    } else {
      unchangedCount += 1
    }
    return {
      index: plan.index,
      action: plan.action,
      id: plan.existingTerm ? String(plan.existingTerm._id) : null,
      sourceText: plan.entry.sourceText,
      previousSourceText: plan.previousSourceText,
      sourceTextChanged: plan.sourceTextChanged,
      sourceLanguageCode: plan.entry.sourceLanguageCode,
      previousSourceLanguageCode: plan.previousSourceLanguageCode,
      sourceLanguageCodeChanged: plan.sourceLanguageCodeChanged,
      note: plan.entry.note,
      previousNote: plan.previousNote,
      noteChanged: plan.noteChanged,
      alreadyBound: plan.alreadyBound,
      translations: plan.translationPlans.map(translationPlan => {
        return {
          languageCode: translationPlan.languageCode,
          action: translationPlan.action,
          textChanged: translationPlan.textChanged,
          noteChanged: translationPlan.noteChanged,
          translatedText: translationPlan.translatedText,
          previousTranslatedText: translationPlan.previousTranslatedText,
          note: translationPlan.note,
          previousNote: translationPlan.previousNote
        }
      })
    }
  })

  return {
    sourcePost,
    totalCount: plans.length,
    createCount,
    updateCount,
    unchangedCount,
    terms: previewTerms
  }
}

module.exports = {
  SOURCE_COLLECTION_POSTS,
  batchBindExistingTermsToSourcePost,
  bindOrganizedTermsToSourcePost,
  bindTermsToSourcePost,
  createOrBindSourcePostTerm,
  deleteRelationsByTermIds,
  exportSourcePostTerms,
  getRelationCountMapBySourceIds,
  getSourcePostTermRelationMap,
  getSourcePostIdFromScopeKey,
  getSourcePostLinkedTermGlossaryCoverage,
  getSourcePostSummary,
  getSourcePostTermList,
  getSourcePostTermsForInternetSearch,
  importSourcePostTerms,
  mergeArticleLinkedCandidateCoverage,
  previewImportSourcePostTerms,
  resolveOrganizedTermIds,
  unbindSourcePostTerm
}
