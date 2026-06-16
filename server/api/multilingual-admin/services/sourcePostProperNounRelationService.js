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

module.exports = {
  SOURCE_COLLECTION_POSTS,
  batchBindExistingTermsToSourcePost,
  bindOrganizedTermsToSourcePost,
  bindTermsToSourcePost,
  createOrBindSourcePostTerm,
  deleteRelationsByTermIds,
  getRelationCountMapBySourceIds,
  getSourcePostTermRelationMap,
  getSourcePostIdFromScopeKey,
  getSourcePostLinkedTermGlossaryCoverage,
  getSourcePostSummary,
  getSourcePostTermList,
  getSourcePostTermsForInternetSearch,
  mergeArticleLinkedCandidateCoverage,
  resolveOrganizedTermIds,
  unbindSourcePostTerm
}
