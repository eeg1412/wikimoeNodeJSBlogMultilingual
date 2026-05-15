const mongoose = require('mongoose')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const internetSearchAiService = require('./internetSearchAiService')
const properNounTranslationService = require('./properNounTranslationService')
const sourcePostProperNounRelationService = require('./sourcePostProperNounRelationService')

const MAX_DIRECT_SEARCH_TERM_COUNT = 100
const MAX_REALTIME_SEARCH_LANGUAGE_PAIR_COUNT = 30
const REALTIME_INTERNET_SEARCH_TIMEOUT_SECONDS = 120

function getTermModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.properNounTerms
  if (!repository || !repository.model) {
    throw new Error('properNounTerms repository not found')
  }
  return repository.model
}

function normalizeString(value, maxLength = 600) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
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
    return []
  }
  const idMap = new Map()
  values.forEach(value => {
    const objectId = parseObjectId(value, fieldName)
    const key = String(objectId)
    if (idMap.has(key)) {
      return
    }
    idMap.set(key, objectId)
  })
  return Array.from(idMap.values())
}

function normalizeTargetLanguageCodes(value) {
  const languageCodes = []
  if (!Array.isArray(value)) {
    return languageCodes
  }
  value.forEach(item => {
    const languageCode = normalizeLanguageCode(normalizeString(item, 20))
    if (languageCode && !languageCodes.includes(languageCode)) {
      languageCodes.push(languageCode)
    }
  })
  return languageCodes
}

function assertTargetLanguages(targetLanguageCodes) {
  if (targetLanguageCodes.length > 0) {
    return
  }
  throw new ApiError(
    ERROR_CODES.CONTENT_FIELD_INVALID,
    '请选择至少一个目标语言',
    'targetLanguageCodes',
    400
  )
}

function assertRealtimeSearchSize(terms, targetLanguageCodes) {
  const pairCount = terms.length * targetLanguageCodes.length
  if (pairCount <= MAX_REALTIME_SEARCH_LANGUAGE_PAIR_COUNT) {
    return pairCount
  }
  throw new ApiError(
    ERROR_CODES.CONTENT_FIELD_INVALID,
    `实时联网检索一次最多处理 ${MAX_REALTIME_SEARCH_LANGUAGE_PAIR_COUNT} 个名词-语言组合，请减少名词或目标语言后重试`,
    'targetLanguageCodes',
    400
  )
}

async function getTermsByIds(termIds) {
  const idList = parseObjectIdList(termIds, 'termIds')
  if (idList.length === 0) {
    return []
  }
  if (idList.length > MAX_DIRECT_SEARCH_TERM_COUNT) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `单次最多联网检索 ${MAX_DIRECT_SEARCH_TERM_COUNT} 个名词`,
      'termIds',
      400
    )
  }
  const TermModel = getTermModel()
  const terms = await TermModel.find({
    _id: { $in: idList },
    enabled: true
  }).lean()
  const termMap = new Map()
  terms.forEach(term => {
    termMap.set(String(term._id), term)
  })
  return idList.map(id => termMap.get(String(id))).filter(Boolean)
}

function buildSearchContextSummary({ sourcePost, contextSummary }) {
  const text = normalizeString(contextSummary, 800)
  if (text) {
    return text
  }
  if (!sourcePost) {
    return ''
  }
  const title = normalizeString(sourcePost.title || sourcePost.alias, 200)
  if (!title) {
    return ''
  }
  return `源文章：${title}`
}

function buildTermRequests(terms, targetLanguageCodes) {
  return terms.map(term => {
    return {
      sourceText: term.sourceText,
      termId: String(term._id || ''),
      note: term.note || '',
      targetLanguageCodes
    }
  })
}

function getSourceLanguageCode(terms, body, sourcePost) {
  const fromBody = normalizeLanguageCode(
    normalizeString(body.sourceLanguageCode, 20)
  )
  if (fromBody) {
    return fromBody
  }
  const fromSourcePost = normalizeLanguageCode(
    normalizeString(sourcePost?.sourceLanguageCode, 20)
  )
  if (fromSourcePost) {
    return fromSourcePost
  }
  for (const term of terms) {
    const languageCode = normalizeLanguageCode(
      normalizeString(term?.sourceLanguageCode, 20)
    )
    if (languageCode) {
      return languageCode
    }
  }
  return ''
}

async function resolveSearchTerms(body = {}) {
  const termIds = parseObjectIdList(body.termIds, 'termIds')
  if (termIds.length > 0) {
    return {
      terms: await getTermsByIds(body.termIds),
      sourcePost: null,
      hasMore: false,
      maxCount: MAX_DIRECT_SEARCH_TERM_COUNT
    }
  }

  const sourceId = normalizeString(body.sourceId || body.id, 80)
  if (!sourceId) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请选择需要联网检索的名词或源文章',
      'sourceId',
      400
    )
  }
  return await sourcePostProperNounRelationService.getSourcePostTermsForInternetSearch(
    {
      sourceId
    }
  )
}

function normalizePreviewTerm(term) {
  const translations = {}
  if (term?.translations && typeof term.translations === 'object') {
    Object.keys(term.translations).forEach(languageCode => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      const translatedText = normalizeString(
        term.translations[languageCode],
        300
      )
      if (normalizedLanguageCode && translatedText) {
        translations[normalizedLanguageCode] = translatedText
      }
    })
  }
  return {
    sourceText: normalizeString(term?.sourceText, 300),
    termId: normalizeString(term?.termId, 80),
    note: normalizeString(term?.note, 2000),
    shouldUpdateTermNote: term?.shouldUpdateTermNote === true,
    translationSource: 'internetSearchAi',
    translations,
    searchMetadata:
      term?.searchMetadata && typeof term.searchMetadata === 'object'
        ? term.searchMetadata
        : {}
  }
}

function notifyStatus(options, message, payload = {}) {
  if (!options || typeof options.onStatus !== 'function') {
    return
  }
  options.onStatus({
    message,
    ...payload
  })
}

async function searchInternetTranslations(body = {}, options = {}) {
  const targetLanguageCodes = normalizeTargetLanguageCodes(
    body.targetLanguageCodes
  )
  assertTargetLanguages(targetLanguageCodes)
  const resolved = await resolveSearchTerms(body)
  const terms = Array.isArray(resolved.terms) ? resolved.terms : []
  if (terms.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '没有可联网检索的名词',
      'termIds',
      400
    )
  }

  const requestedLanguagePairCount = assertRealtimeSearchSize(
    terms,
    targetLanguageCodes
  )
  notifyStatus(
    options,
    `准备联网检索 ${terms.length} 个名词、${targetLanguageCodes.length} 个目标语言`
  )
  const searchResult =
    await internetSearchAiService.searchOfficialTermTranslations({
      termRequests: buildTermRequests(terms, targetLanguageCodes),
      targetLanguageCodes,
      sourceLanguageCode: getSourceLanguageCode(
        terms,
        body,
        resolved.sourcePost
      ),
      contextSummary: buildSearchContextSummary({
        sourcePost: resolved.sourcePost,
        contextSummary: body.contextSummary
      }),
      skipKnowledgeBase: true,
      timeoutSeconds: REALTIME_INTERNET_SEARCH_TIMEOUT_SECONDS,
      onStatus: options.onStatus,
      cancellation: options.cancellation
    })
  notifyStatus(options, '联网检索已完成', {
    requestedLanguagePairCount
  })

  return {
    provider: searchResult.provider || '',
    model: searchResult.model || '',
    terms: searchResult.terms.map(normalizePreviewTerm),
    stats: {
      ...(searchResult.stats || {}),
      requestedTermCount: terms.length,
      requestedLanguagePairCount,
      maxLanguagePairCount: MAX_REALTIME_SEARCH_LANGUAGE_PAIR_COUNT,
      truncated: resolved.hasMore === true,
      maxCount: resolved.maxCount || MAX_DIRECT_SEARCH_TERM_COUNT
    }
  }
}

function normalizeApplyTerms(terms) {
  if (!Array.isArray(terms)) {
    return []
  }
  return terms.map(normalizePreviewTerm).filter(term => {
    return term.sourceText && Object.keys(term.translations).length > 0
  })
}

async function applyInternetTranslations(body = {}) {
  const terms = normalizeApplyTerms(body.terms)
  if (terms.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请选择至少一个需要应用的译名',
      'terms',
      400
    )
  }
  const savedTranslations =
    await properNounTranslationService.upsertAiSearchTerms({
      terms,
      provider: normalizeString(body.provider, 80) || 'gemini',
      model: normalizeString(body.model, 120)
    })
  return {
    savedCount: savedTranslations.length,
    translations: savedTranslations
  }
}

module.exports = {
  applyInternetTranslations,
  searchInternetTranslations
}
