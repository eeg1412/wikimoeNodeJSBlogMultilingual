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

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
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
    return await TermModel.create(payload)
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

async function findOrCreateTermForSourceText(sourceText) {
  const normalizedSourceText = buildNormalizedSourceText(sourceText)
  const TermModel = getTermModel()
  const existing = await TermModel.findOne({ normalizedSourceText }).lean()
  if (existing) {
    return existing
  }

  try {
    return await TermModel.create({
      sourceText: normalizeSourceText(sourceText),
      normalizedSourceText,
      sourceLanguageCode: '',
      enabled: true
    })
  } catch (error) {
    if (error && error.code === 11000) {
      return await TermModel.findOne({ normalizedSourceText }).lean()
    }
    throw error
  }
}

async function upsertAiSearchTerms({ terms = [], provider = '', model = '' }) {
  const TranslationModel = getTranslationModel()
  const savedTranslations = []

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
    const term = await findOrCreateTermForSourceText(sourceText)
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
      delete payload.enabled
      const record = await TranslationModel.findOneAndUpdate(
        { termId: term._id, languageCode: normalizedLanguageCode },
        { $set: payload, $setOnInsert: { enabled: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean()
      savedTranslations.push({
        ...record,
        sourceText: term.sourceText,
        normalizedSourceText: term.normalizedSourceText
      })
    }
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
  missingMap
}) {
  const translation = translationMap.get(
    buildTranslationKey(sourceTextItem.normalizedSourceText, languageCode)
  )
  if (translation) {
    const sourceText = translation.sourceText || sourceTextItem.sourceText
    const sourceLabel = getTranslationSourceLabel(translation.translationSource)
    lines.push(
      buildMarkdownTableRow([
        sourceText,
        translation.translatedText,
        sourceLabel
      ])
    )
    return
  }

  if (isMissingTermForLanguage(missingMap, sourceTextItem, languageCode)) {
    lines.push(
      buildMarkdownTableRow([
        sourceTextItem.sourceText,
        '未收录，请按上下文直译或音译，并在本次翻译中保持一致',
        'missing'
      ])
    )
  }
}

function buildSingleLanguageGlossaryMarkdown({
  sourceTextItems,
  languageCode,
  translationMap,
  missingMap
}) {
  const lines = [
    '## 专有名词翻译数据库',
    '',
    `目标语言：${getLanguageText(languageCode)}（${languageCode}）`,
    '',
    buildMarkdownTableRow(['原文', '译名', '来源']),
    buildMarkdownTableRow(['---', '---', '---'])
  ]

  sourceTextItems.forEach(sourceTextItem => {
    pushSingleLanguageGlossaryRow({
      lines,
      sourceTextItem,
      languageCode,
      translationMap,
      missingMap
    })
  })

  return lines.join('\n')
}

function buildGlossaryMarkdown({
  sourceTexts = [],
  targetLanguageCodes = [],
  translations = [],
  missingTerms = []
} = {}) {
  const sourceTextItems = normalizeSourceTextList(sourceTexts)
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
  const missingMap = new Map()
  missingTerms.forEach(item => {
    missingMap.set(item.normalizedSourceText, item)
  })

  if (languageCodes.length === 1) {
    return buildSingleLanguageGlossaryMarkdown({
      sourceTextItems,
      languageCode: languageCodes[0],
      translationMap,
      missingMap
    })
  }

  const lines = [
    '## 专有名词翻译数据库',
    '',
    buildMarkdownTableRow(['原文', '目标语言', '译名', '来源']),
    buildMarkdownTableRow(['---', '---', '---', '---'])
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
        lines.push(
          buildMarkdownTableRow([
            sourceText,
            `${getLanguageText(languageCode)}（${languageCode}）`,
            translation.translatedText,
            sourceLabel
          ])
        )
        return
      }

      if (isMissingTermForLanguage(missingMap, sourceTextItem, languageCode)) {
        lines.push(
          buildMarkdownTableRow([
            sourceTextItem.sourceText,
            `${getLanguageText(languageCode)}（${languageCode}）`,
            '未收录，请按上下文直译或音译，并在本次翻译中保持一致',
            'missing'
          ])
        )
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
  compareTermTranslationCoverage,
  createTerm,
  createTranslation,
  deleteTerm,
  deleteTranslation,
  getTermDetail,
  getTermList,
  getTranslationList,
  getTranslationsForSourceTexts,
  normalizeSourceText,
  updateTerm,
  updateTranslation,
  upsertAiSearchTerms
}
