const crypto = require('crypto')
const mongoose = require('mongoose')
const {
  normalizeLanguageCode,
  getLanguageText
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const aiSettingsService = require('./aiSettingsService')
const aiUsageService = require('./aiUsageService')
const coverImageTranslationService = require('./coverImageTranslationService')
const internetSearchAiService = require('./internetSearchAiService')
const properNounTranslationService = require('./properNounTranslationService')
const sourcePostProperNounRelationService = require('./sourcePostProperNounRelationService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
const translationOfficialTermGlossaryService = require('./translationOfficialTermGlossaryService')
const translationPromptPolicyService = require('./translationPromptPolicyService')
const { runAiStepWithRetry } = require('./aiStepRetryService')
const {
  buildJsonRequestBody,
  getProviderCode,
  getProviderErrorField,
  getProviderLabel,
  requestProviderJson,
  requestProviderStream
} = require('./textAiProviderRequestService')

const TRANSLATION_JSON_SCHEMA = 'wikimoe.translation.post'
const TRANSLATION_JSON_VERSION = 2
const AI_RESULT_SCHEMA = 'wikimoe.ai.translation.result'
const TERM_EXTRACTION_RESULT_SCHEMA = 'wikimoe.ai.proper_noun.term_extract'
const TERM_EXISTING_FILTER_RESULT_SCHEMA =
  'wikimoe.ai.proper_noun.existing_filter'
const SUPPORTED_ENTRY_VALUE_TYPES = new Set([
  'plainText',
  'richTextLite',
  'richTextDocument'
])
const RICH_TEXT_INDEXED_VALUE_TYPE = 'indexedRichText'
const AI_TRANSLATION_ERROR_FIELD = 'aiTranslation'
const MAX_AI_REQUEST_TEXT_LENGTH = 6000
const MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH = 3000
const MIN_AI_REQUEST_TEXT_LENGTH = 600
const MIN_RICH_TEXT_SEGMENT_TEXT_LENGTH = 400
const AI_RESPONSE_JSON_TOKEN_RESERVE = 1024
const AI_THINKING_TOKEN_RESERVE_RATIO = 0.35
const AI_THINKING_MAX_EFFORT_TOKEN_RESERVE_RATIO = 0.5
const AI_THINKING_TOKEN_RESERVE_MIN = 2048
const AI_THINKING_MAX_EFFORT_TOKEN_RESERVE_MIN = 3072
const AI_OUTPUT_TEXT_TOKEN_RATIO = 0.55
const RICH_TEXT_SEGMENT_TEXT_RATIO = 0.75
const RICH_TEXT_SEGMENT_CONTEXT_LENGTH = 160
const MAX_TERM_EXTRACTION_PACKAGE_TEXT_LENGTH = 10000
const MAX_TERM_EXTRACTION_TEXT_SLICE_LENGTH = 8000
const MAX_EXTRACTED_TERM_COUNT = 50
const MAX_TERM_CONTEXT_SUMMARY_LENGTH = 800
const MAX_EXTRACTED_TERM_NOTE_LENGTH = 120
const MAX_TERM_SEARCH_KEYWORD_COUNT = 6
const MAX_TERM_FILTER_TOKENS = 2048
const MAX_TERM_FILTER_THINKING_TOKENS = 4096
const MAX_TERM_FILTER_MAX_EFFORT_TOKENS = 6144
const MIN_TERM_IMPORTANCE = 1
const MAX_TERM_IMPORTANCE = 100
const MAX_AI_PARSE_ERROR_PREVIEW_LENGTH = 220
const MAX_TRANSLATION_MEMO_PROMPT_LENGTH = 6000

function getProviderLabelBySettings(settings) {
  return getProviderLabel(settings)
}

function getProviderFieldBySettings(settings) {
  return getProviderErrorField(settings)
}

function getProviderCodeBySettings(settings) {
  return getProviderCode(settings) || 'deepseek'
}

function getConfiguredModelBySettings(settings = {}) {
  const model = normalizeString(settings.model).trim()
  if (model) {
    return model
  }
  return normalizeString(settings.deepSeekModel).trim()
}

function getResponseModel(responseResult = {}, settings = {}) {
  const responseModel = normalizeString(responseResult.model).trim()
  if (responseModel) {
    return responseModel
  }
  return getConfiguredModelBySettings(settings)
}

function createProviderApiError(settings, message, status = 502, extra = {}) {
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    message,
    getProviderFieldBySettings(settings),
    status,
    extra
  )
}

function getPostModel() {
  const repository = global.$mongodDB.multilingual.repositories.posts
  if (!repository || !repository.model) {
    throw new Error('multilingual posts repository not found')
  }

  return repository.model
}

function createBrowserRequestContext() {
  return {
    id: new mongoose.Types.ObjectId().toString()
  }
}

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value)
}

function normalizePrompt(value) {
  return normalizeString(value).trim().slice(0, 6000)
}

function normalizeTranslationMemoPrompt(value) {
  return normalizeString(value)
    .trim()
    .slice(0, MAX_TRANSLATION_MEMO_PROMPT_LENGTH)
}

function normalizeTermContextSummary(value) {
  return normalizeString(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TERM_CONTEXT_SUMMARY_LENGTH)
}

function normalizeTargetLanguageCodeList({
  targetLanguageCode,
  targetLanguageCodes
} = {}) {
  const languageCodes = []
  const primaryLanguageCode = normalizeLanguageCode(targetLanguageCode)
  if (primaryLanguageCode) {
    languageCodes.push(primaryLanguageCode)
  }
  if (Array.isArray(targetLanguageCodes)) {
    targetLanguageCodes.forEach(value => {
      const languageCode = normalizeLanguageCode(value)
      if (!languageCode || languageCodes.includes(languageCode)) {
        return
      }
      languageCodes.push(languageCode)
    })
  }
  return languageCodes
}

function normalizeOfficialTermGlossaryTaskCache(value) {
  if (value instanceof Map) {
    return value
  }
  return null
}

function getOfficialTermGlossaryTaskCache(input) {
  const taskCache = normalizeOfficialTermGlossaryTaskCache(
    input?.officialTermGlossaryTaskCache
  )
  if (taskCache) {
    return taskCache
  }
  return new Map()
}

function cloneSerializableValue(value) {
  if (typeof value === 'undefined') {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function getLanguageLabel(languageCode) {
  return getLanguageText(languageCode)
}

function assertPlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${fieldName} 必须是对象`,
      fieldName,
      400
    )
  }
}

function validateRichTextDocumentNode(node, path) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`${path} 必须是对象`)
  }

  if (node.type === 'root') {
    if (!Array.isArray(node.children)) {
      throw new Error(`${path}.children 必须是数组`)
    }
    node.children.forEach((childNode, index) => {
      validateRichTextDocumentNode(childNode, `${path}.children[${index}]`)
    })
    return
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') {
      throw new Error(`${path}.text 必须是字符串`)
    }
    return
  }

  if (node.type !== 'element') {
    throw new Error(`${path}.type 不受支持`)
  }
  if (typeof node.tag !== 'string' || !node.tag.trim()) {
    throw new Error(`${path}.tag 不能为空`)
  }
  if (node.attrs !== undefined) {
    assertRichTextAttributeMap(node.attrs, `${path}.attrs`)
  }
  if (node.translatableAttrs !== undefined) {
    assertRichTextAttributeMap(
      node.translatableAttrs,
      `${path}.translatableAttrs`
    )
  }
  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error(`${path}.children 必须是数组`)
  }
  ;(node.children || []).forEach((childNode, index) => {
    validateRichTextDocumentNode(childNode, `${path}.children[${index}]`)
  })
}

function assertRichTextAttributeMap(attributeMap, path) {
  if (
    !attributeMap ||
    typeof attributeMap !== 'object' ||
    Array.isArray(attributeMap)
  ) {
    throw new Error(`${path} 必须是对象`)
  }

  Object.entries(attributeMap).forEach(([key, value]) => {
    if (!String(key || '').trim()) {
      throw new Error(`${path} 包含空属性名`)
    }
    if (typeof value !== 'string') {
      throw new Error(`${path}.${key} 必须是字符串`)
    }
  })
}

function validateInputEntry(entry, index) {
  assertPlainObject(entry, `entries[${index}]`)
  if (!entry.id || typeof entry.id !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目缺少 id`,
      'entries',
      400
    )
  }
  if (!entry.fieldName || typeof entry.fieldName !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目缺少 fieldName`,
      'entries',
      400
    )
  }
  if (!SUPPORTED_ENTRY_VALUE_TYPES.has(entry.valueType)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目的 valueType 不受支持`,
      'entries',
      400
    )
  }
  if (entry.valueType === 'richTextDocument') {
    try {
      validateRichTextDocumentNode(entry.value, `entries[${index}].value`)
    } catch (error) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        `第 ${index + 1} 个富文本条目结构不合法：${error.message}`,
        'entries',
        400
      )
    }
    return
  }
  if (typeof entry.value !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目的 value 必须是字符串`,
      'entries',
      400
    )
  }
}

function shouldAutoOrganizeOfficialTermGlossaryFromBody(body = {}) {
  return body.autoOrganizeOfficialTermGlossary !== false
}

function shouldSearchOfficialTermTranslationsFromBody(body = {}) {
  if (!shouldAutoOrganizeOfficialTermGlossaryFromBody(body)) {
    return false
  }
  return body.searchOfficialTermTranslations === true
}

function parseInput(body = {}) {
  const postId = String(body.postId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_ID_INVALID,
      'translation post id invalid',
      'postId',
      400
    )
  }

  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  const targetLanguageCode = normalizeLanguageCode(body.targetLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }
  const translateCoverImage = body.translateCoverImage === true
  if (
    (!Array.isArray(body.entries) || body.entries.length === 0) &&
    !translateCoverImage
  ) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一个翻译条目',
      'entries',
      400
    )
  }

  let entries = []
  if (Array.isArray(body.entries)) {
    entries = body.entries
  }
  entries.forEach((entry, index) => validateInputEntry(entry, index))
  const targetTitle = String(body.targetTitle || '').trim()
  const targetLanguageCodes = normalizeTargetLanguageCodeList({
    targetLanguageCode,
    targetLanguageCodes: body.targetLanguageCodes
  })

  return {
    postId,
    sourceLanguageCode,
    targetLanguageCode,
    targetLanguageCodes,
    prompt: normalizePrompt(body.prompt),
    translationMemoPrompt: normalizeTranslationMemoPrompt(
      body.translationMemoPrompt
    ),
    entries,
    targetTitle,
    translateCoverImage,
    translationJobId: String(body.translationJobId || '').trim(),
    cacheKey: String(body.cacheKey || '').trim(),
    cacheScopeKey: String(body.cacheScopeKey || '').trim(),
    officialTermGlossaryTaskCache: normalizeOfficialTermGlossaryTaskCache(
      body.officialTermGlossaryTaskCache
    ),
    autoOrganizeOfficialTermGlossary:
      shouldAutoOrganizeOfficialTermGlossaryFromBody(body),
    searchOfficialTermTranslations:
      shouldSearchOfficialTermTranslationsFromBody(body)
  }
}

function parseGenericInput(body = {}) {
  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  const targetLanguageCode = normalizeLanguageCode(body.targetLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一个翻译条目',
      'entries',
      400
    )
  }

  body.entries.forEach((entry, index) => validateInputEntry(entry, index))
  const targetLanguageCodes = normalizeTargetLanguageCodeList({
    targetLanguageCode,
    targetLanguageCodes: body.targetLanguageCodes
  })

  return {
    contentId: String(body.contentId || '').trim(),
    contentType: String(body.contentType || 'content').trim() || 'content',
    sourceLanguageCode,
    targetLanguageCode,
    targetLanguageCodes,
    prompt: normalizePrompt(body.prompt),
    translationMemoPrompt: normalizeTranslationMemoPrompt(
      body.translationMemoPrompt
    ),
    entries: body.entries,
    snapshotVersion: Number(body.snapshotVersion || 1) || 1,
    sourceSnapshotId: body.sourceSnapshotId || null,
    properNounScopeKey: String(body.properNounScopeKey || '').trim(),
    translationJobId: String(body.translationJobId || '').trim(),
    cacheKey: String(body.cacheKey || '').trim(),
    cacheScopeKey: String(body.cacheScopeKey || '').trim(),
    officialTermGlossaryTaskCache: normalizeOfficialTermGlossaryTaskCache(
      body.officialTermGlossaryTaskCache
    ),
    skipUsageLog: body.skipUsageLog === true,
    autoOrganizeOfficialTermGlossary:
      shouldAutoOrganizeOfficialTermGlossaryFromBody(body),
    searchOfficialTermTranslations:
      shouldSearchOfficialTermTranslationsFromBody(body)
  }
}

function parseProperNounOrganizeInput(body = {}) {
  const sourceId = String(body.sourceId || body.postId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      'sourceId',
      400
    )
  }
  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  const targetLanguageCodes = normalizeTargetLanguageCodeList({
    targetLanguageCode: body.targetLanguageCode,
    targetLanguageCodes: body.targetLanguageCodes
  })
  if (targetLanguageCodes.length === 0) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      '请至少选择一个目标语言',
      'targetLanguageCodes',
      400
    )
  }
  let entries = []
  if (Array.isArray(body.entries)) {
    entries = body.entries
  }
  if (entries.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '文章名词整理没有可分析的正文条目',
      'entries',
      400
    )
  }
  entries.forEach((entry, index) => validateInputEntry(entry, index))

  return {
    contentId: sourceId,
    contentType: 'sourcePostProperNounOrganize',
    sourceId,
    sourceLanguageCode,
    targetLanguageCode: targetLanguageCodes[0],
    targetLanguageCodes,
    prompt: '',
    entries,
    properNounScopeKey: `sourcePostImport:${sourceId}`,
    translationJobId: String(body.translationJobId || '').trim(),
    cacheKey: String(body.cacheKey || '').trim(),
    cacheScopeKey: String(body.cacheScopeKey || '').trim(),
    officialTermGlossaryTaskCache: normalizeOfficialTermGlossaryTaskCache(
      body.officialTermGlossaryTaskCache
    ),
    skipUsageLog: body.skipUsageLog === true,
    searchOfficialTermTranslations: body.searchOfficialTermTranslations === true
  }
}

async function getTranslationPost(input) {
  const PostModel = getPostModel()
  const post = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(input.postId),
    recordKind: 'translation'
  })
    .select(
      '_id languageCode sourceLanguageCode title type snapshotVersion sourceSnapshotId translationGroupId coverImages sourceId'
    )
    .lean()

  if (!post) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation post not found',
      'postId',
      404
    )
  }
  if (post.languageCode !== input.targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      'targetLanguageCode does not match translation post',
      'targetLanguageCode',
      400
    )
  }

  return post
}

async function getSourcePostForTranslationPost(post) {
  const sourceSnapshotId = String(post?.sourceSnapshotId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceSnapshotId)) {
    return null
  }

  const PostModel = getPostModel()
  return await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(sourceSnapshotId)
  })
    .select('_id title type coverImages sourceId sourceSnapshotId languageCode')
    .lean()
}

function appendCoverImageResultToStreamData(
  data,
  coverResult,
  registry,
  input
) {
  const nextData = {
    ...data,
    aiJsonLogs: [],
    coverImagePreviewEntries: [],
    coverImageArtifacts: [],
    coverImageWarnings: []
  }

  if (Array.isArray(data.aiJsonLogs)) {
    nextData.aiJsonLogs = data.aiJsonLogs.slice()
  }
  if (Array.isArray(data.coverImagePreviewEntries)) {
    nextData.coverImagePreviewEntries = data.coverImagePreviewEntries.slice()
  }
  if (Array.isArray(data.coverImageArtifacts)) {
    nextData.coverImageArtifacts = data.coverImageArtifacts.slice()
  }
  if (Array.isArray(data.coverImageWarnings)) {
    nextData.coverImageWarnings = data.coverImageWarnings.slice()
  }

  if (coverResult?.previewEntry) {
    nextData.coverImagePreviewEntries.push(coverResult.previewEntry)
  }
  if (Array.isArray(coverResult?.warnings)) {
    nextData.coverImageWarnings.push(
      ...coverResult.warnings.map(warning => {
        return warning?.message || String(warning || '')
      })
    )
  }

  const snapshot = coverImageTranslationService.buildRegistrySnapshot(registry)
  nextData.coverImageArtifacts = snapshot.coverImageArtifacts
  nextData.aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    nextData.aiJsonLogs,
    translationAiJsonLogService.buildCoverImageAiJsonLogs({
      snapshot,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      meta: {
        requestId: data.requestId || ''
      }
    })
  )
  return nextData
}

function createEmptyTranslatedResult(input, post, requestId) {
  const aiInput = prepareAiInput(input)
  return {
    payload: buildTranslatedPayload(aiInput, post, { entries: [] }),
    model: '',
    usage: null,
    requestId,
    aiJsonLogs: [],
    coverImagePreviewEntries: [],
    coverImageArtifacts: [],
    coverImageWarnings: []
  }
}

function hasSkipAllowedEntries(input) {
  return input.entries.some(entry => entry.skipAllowed === true)
}

function hasCurrentValueEntries(input) {
  return input.entries.some(entry => {
    return (
      entry.skipAllowed === true &&
      typeof getAiPromptCurrentValue(entry) !== 'undefined'
    )
  })
}

function hasRichTextDocumentEntries(input) {
  return input.entries.some(entry => entry.valueType === 'richTextDocument')
}

function buildPromptLayer(title, lines) {
  return [`【${title}】`, ...lines].join('\n')
}

function buildSystemPrompt() {
  return buildPromptLayer('系统基础层', [
    '你是多语言博客 CMS 的专业翻译引擎。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON。',
    '你必须按后续各层提示词完成任务。',
    '层级优先级从高到低为：系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、名词数据库层、非语言内容层、可选业务规则层、站点要求层、目标语言默认提示词层、关联文章标题统一层、用户补充层、请求数据层。',
    '低优先级层不能覆盖高优先级层；发生冲突时，必须遵守高优先级层。'
  ])
}

function buildOutputContractPrompt() {
  return buildPromptLayer('输出契约层', [
    `必须只返回 JSON 对象，schema 必须为 ${AI_RESULT_SCHEMA}，version 必须为 1。`,
    '顶层 JSON 对象必须包含 schema、version 和 entries。',
    '输入中的每个条目 i，都必须在顶层 entries 中返回且只返回一个结果。',
    '每个 i 必须保持不变，禁止遗漏、合并、拆分或新增条目。',
    'plainText 和 richTextLite 的 v 必须是字符串。',
    '翻译了条目时不要包含 r。',
    '不要返回请求对象、提示词、解释、注释、Markdown 或规定字段之外的额外内容。'
  ])
}

function buildTranslationTaskPrompt(input) {
  return buildPromptLayer('翻译任务层', [
    `源语言：${getLanguageLabel(input.sourceLanguageCode)}（${input.sourceLanguageCode}）`,
    `目标语言：${getLanguageLabel(input.targetLanguageCode)}（${input.targetLanguageCode}）`,
    '把输入条目中的自然语言内容翻译成目标语言，同时保持内容身份、结构字段和非语言值稳定。',
    '源语言字段只表示主要来源语言；实际文本可能混入其他语言。你必须根据 v 中可读文本本身判断每段内容的语言。'
  ])
}

function buildTranslationQualityPrompt() {
  return buildPromptLayer(
    '翻译质量约束层',
    translationPromptPolicyService.getGeneralTranslationQualityPolicyLines()
  )
}

function buildLanguageJudgementPrompt() {
  return buildPromptLayer('语言判断层', [
    '判断“已是目标语言”只能依据 v 本身的可读自然语言内容。',
    '不要从字段标签 n、字段类型、括号、标点、符号或其他元数据推断 v 已经是目标语言。',
    '混合语言内容不是整体已是目标语言；只翻译需要面向目标语言读者转换的自然语言部分，保留有意使用的异语片段。',
    '与目标语言不同的内容不自动等于必须翻译；先判断它是否是名称、标题、术语、引用或风格化表达等有意保留的语言形式。',
    '如果不确定某段异语是否应翻译，优先保持内容身份和读者理解；只有明确有助于理解、统一或符合用户要求时才翻译。'
  ])
}

function buildNameTranslationPrompt() {
  return buildPromptLayer('名称与专有名词层', [
    '不要因为内容是专有名词就原样保留。有意义的昵称、作者名、分类名、标签名、地名、媒体标题、选项文案、包含可读词语的文件名，都属于可翻译内容。',
    '翻译专有名词、昵称、地名、名称或标题时，要保留指代对象身份，同时产出目标语言表达。',
    '优先使用目标语言既有译名；疑似需要官方译名、权威译名或稳定通用译名的名称，如果名词数据库没有提供译名，先判断在语境中是否需要翻译，如果需要翻译则遵循信达雅的原则进行翻译。',
    '对名词数据库标记为未确认官方译名的名称，必须保留原文表面形式；只有明显不是稳定实体、只是普通可读词语或描述性短语时，才按目标语言常规表达翻译。',
    '禁止用专有名词、昵称、作者名、分类名、标签名、地名、中文地名、媒体标题、无需翻译、字段类型不需要翻译等理由保留 v；如果名词数据库中当前目标语言的译名与原文完全一致且有译名备注，必须按该数据库译名处理。'
  ])
}

function buildOfficialTermGlossaryPrompt(input) {
  const glossaryMarkdown = normalizeString(
    input.officialTermGlossaryMarkdown
  ).trim()
  if (!glossaryMarkdown) {
    return ''
  }

  const contextSummary = normalizeTermContextSummary(
    input.officialTermContextSummary
  )
  const promptLines = []
  if (input.autoOrganizeOfficialTermGlossary === false) {
    promptLines.push('以下名词数据库来自源文章已整理并关联的专有名词词库。')
  } else {
    promptLines.push(
      '以下名词数据库由本次选中的翻译内容抽取，并与站点专有名词翻译集合合并整理。'
    )
  }
  promptLines.push(
    '这份名词数据库只包含当前目标语言，不包含其他语言的译名。',
    '翻译正文、标题、摘要、关联内容和递归关联文章时，必须优先使用表格中的译名。',
    '同一个原文名词在同一次请求的所有条目、富文本片段和关联字段中必须保持同一译法。',
    '如果表格包含“译名备注”，它说明对应译名的选择原因；当译名与原文完全一致时，译名备注表示该同名译名已经过专门整理确认，不要误判为缺失译名，也不要自行改成直译、音译、意译或本地化写法。',
    '译名为“未收录”的名词表示本次没有可验证译名；不得把它当成已确认的官方译名、权威译名或稳定通用译名处理。',
    '处理“未收录”名词时，先判断在语境中是否需要翻译，如果需要翻译则遵循信达雅的原则进行翻译。'
  )
  if (input.searchOfficialTermTranslations === true) {
    promptLines.push(
      '本次已开启官方译名搜索；如果表格仍显示“未收录”，说明数据库和联网流程没有取得可验证译名，不能再用模型记忆补造译名。'
    )
  }
  if (contextSummary) {
    promptLines.push(`本次内容简要上下文：${contextSummary}`)
  }
  promptLines.push(glossaryMarkdown)

  return buildPromptLayer('名词数据库层', promptLines)
}

function buildNonLanguagePrompt() {
  return buildPromptLayer('非语言内容层', [
    '不要翻译 URL、代码标识符、segment index、CSS class、data-* 属性或媒体路径。',
    '无意义的非语言字符串仅限纯日期、纯数字、哈希、随机字母数字 ID、文件扩展名、URL、路径，或不包含可读词语的文件名。',
    '如果值包含代码块，保留代码语法；只有明确属于自然语言的注释或说明文字才翻译。'
  ])
}

function buildSkipPolicyPrompt(input) {
  if (!hasSkipAllowedEntries(input)) {
    return buildPromptLayer('翻译义务层', [
      '本请求没有允许保留原值的 k=true 条目。',
      '只要 v 包含自然语言文本，就必须翻译。'
    ])
  }

  return buildPromptLayer('k=true 保留原值规则层', [
    'k=true 是很窄的“允许保留原值”标记，不是拒绝翻译的许可。',
    '只有当 k=true，并且 v 本身完整地属于目标语言，或 v 是无意义的非语言字符串时，才允许返回原始 v。',
    '当 k=true 且你合法保留 v 不变时，必须包含 r，并用面向用户的简体中文短句说明具体原因：完整已是目标语言(源语种→目标语言语种)、URL/路径/代码、数字/日期/哈希/ID，或不可读文件名。',
    '不要用 r 为可读的源语言文本、专有名词、地名、分类、标签、昵称或混合语言文本辩解。'
  ])
}

function buildCurrentValuePolicyPrompt(input) {
  if (input.verificationMode === true) {
    return ''
  }
  if (!hasCurrentValueEntries(input)) {
    return ''
  }

  return buildPromptLayer('当前值 c 语义层', [
    '当前值 c 只用于对比上下文。c 不是翻译源，也不能让你把 v 标记为已翻译。',
    'c 可能未翻译、可能是源语言复制值、可能过期、可能为空、也可能和 v 完全相同。',
    '不要把 c 的任何状态当作 v 已是目标语言的证据。',
    '如果 v 等于 c，这只表示已有值和输入值相同，不表示可以跳过翻译。',
    '不要把当前、已有、未变化的内容当作已经翻译。只要 v 中可读文本不完整属于目标语言，就必须翻译。'
  ])
}

function buildVerificationModePrompt(input) {
  if (input.verificationMode !== true) {
    return ''
  }

  return buildPromptLayer('翻译校验层', [
    '本次为翻译质检校验任务。v 是源语言原文，c 是已有的目标语言译文。',
    '你必须逐条审查 c 是否准确、完整地翻译了 v，并保持术语一致、语气恰当、表达通顺。',
    '当 c 存在翻译错误、漏译、多译、术语不一致、语义偏差、语气不当或不通顺时，必须输出修正后的目标语言译文作为该条目的 v 翻译结果。',
    '当 c 已经是准确且高质量的译文时，保持其表达不变，直接输出与 c 相同的译文。',
    '不要因为这是校验任务就保留源语言原文；输出必须是目标语言译文。',
    '不要增删事实，不要解释，不要输出译文以外的注释。',
    'richTextDocument 仍然遵守 indexedRichText 规则：只修改 text，保持每个 index 与结构不变。'
  ])
}

function buildRichTextPolicyPrompt(input) {
  if (!hasRichTextDocumentEntries(input)) {
    return ''
  }

  return buildPromptLayer('富文本结构层', [
    'richTextDocument 的输入值会被转换为 indexedRichText，结构为 segments: [{ index, text }]。',
    'indexedRichText 值必须返回 v: { type: "indexedRichText", segments: [{ index, text }] }。',
    '每个输入 segment 必须返回且只返回一个翻译后的 segment。',
    '只能翻译 text 字段，并且必须保持每个 index 不变。',
    'segment 可能包含 contextBefore/contextAfter，它们只能用于理解边界上下文，不要翻译，也不要输出。',
    '服务端会按 index 把译文写回原 HTML。不要创造 HTML、属性、标签或额外 index。',
    '翻译所有可见自然语言文本，包括从 alt/title/placeholder/aria-label 属性中提取出的 indexed text。'
  ])
}

function buildSitePrompt(settings) {
  const defaultPrompt = normalizePrompt(settings.mainTranslationDefaultPrompt)
  if (!defaultPrompt) {
    return ''
  }

  return buildPromptLayer('站点要求层', [
    '以下是站点管理员配置的默认翻译要求。',
    '站点要求不得覆盖系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、非语言内容层或可选业务规则层。',
    defaultPrompt
  ])
}

function buildTargetLanguageDefaultPrompt(settings, input) {
  let languagePromptMap = {}
  if (
    settings.mainTranslationLanguagePrompts &&
    typeof settings.mainTranslationLanguagePrompts === 'object' &&
    !Array.isArray(settings.mainTranslationLanguagePrompts)
  ) {
    languagePromptMap = settings.mainTranslationLanguagePrompts
  }
  const targetLanguagePrompt = normalizePrompt(
    languagePromptMap[input.targetLanguageCode]
  )
  if (!targetLanguagePrompt) {
    return ''
  }

  return buildPromptLayer('目标语言默认提示词层', [
    `以下是目标语言 ${getLanguageLabel(input.targetLanguageCode)}（${input.targetLanguageCode}）的默认翻译要求。`,
    '目标语言默认提示词紧跟站点默认提示词生效。',
    '目标语言默认提示词不得覆盖系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、非语言内容层、可选业务规则层或站点要求层。',
    targetLanguagePrompt
  ])
}

function buildTranslationMemoPrompt(input) {
  const memoPrompt = normalizeTranslationMemoPrompt(input.translationMemoPrompt)
  if (!memoPrompt) {
    return ''
  }

  return buildPromptLayer('关联文章标题统一层', [
    `以下内容只用于 ${getLanguageLabel(input.targetLanguageCode)}（${
      input.targetLanguageCode
    }）关联文章标题翻译统一。`,
    memoPrompt
  ])
}

function getWorkflowTargetLanguageCodes(input) {
  const languageCodes = []
  const singleLanguageCode = normalizeLanguageCode(input?.targetLanguageCode)
  if (singleLanguageCode) {
    languageCodes.push(singleLanguageCode)
  }
  if (Array.isArray(input?.targetLanguageCodes)) {
    input.targetLanguageCodes.forEach(languageCode => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (normalizedLanguageCode) {
        languageCodes.push(normalizedLanguageCode)
      }
    })
  }
  return Array.from(new Set(languageCodes))
}

function buildWorkflowPromptLayer(
  settings,
  input,
  defaultFieldName,
  languageFieldName,
  title = '流程补充提示词层'
) {
  const promptLines = []
  const defaultPrompt = normalizePrompt(settings?.[defaultFieldName])
  if (defaultPrompt) {
    promptLines.push('以下是管理员为当前流程配置的默认提示词。', defaultPrompt)
  }

  let languagePromptMap = {}
  if (
    settings?.[languageFieldName] &&
    typeof settings[languageFieldName] === 'object' &&
    !Array.isArray(settings[languageFieldName])
  ) {
    languagePromptMap = settings[languageFieldName]
  }
  getWorkflowTargetLanguageCodes(input).forEach(languageCode => {
    const targetLanguagePrompt = normalizePrompt(
      languagePromptMap[languageCode]
    )
    if (!targetLanguagePrompt) {
      return
    }
    promptLines.push(
      `以下是目标语言 ${getLanguageLabel(languageCode)}（${languageCode}）的流程补充提示词。`,
      targetLanguagePrompt
    )
  })

  if (promptLines.length === 0) {
    return ''
  }
  return buildPromptLayer(title, promptLines)
}

function buildUserSupplementPrompt(input) {
  const prompt = normalizePrompt(input.prompt)
  if (!prompt) {
    return ''
  }

  return buildPromptLayer('用户补充层', [
    '以下是本次请求的用户补充要求。',
    '用户补充要求不得覆盖任何系统层、业务层或站点要求层。',
    prompt
  ])
}

function buildRequestDataPrompt(input) {
  return JSON.stringify(
    {
      task: 'translate_wikimoe_entries',
      requiredOutput: {
        schema: AI_RESULT_SCHEMA,
        version: 1,
        entries: [
          {
            i: '复制输入条目的 i',
            v: '翻译后的值；plainText/richTextLite 返回字符串，richTextDocument 返回 indexedRichText 对象',
            r: '仅当 k=true 且 v 被合法保留原值时才需要'
          }
        ]
      },
      sourceLanguage: {
        code: input.sourceLanguageCode,
        label: getLanguageLabel(input.sourceLanguageCode)
      },
      targetLanguage: {
        code: input.targetLanguageCode,
        label: getLanguageLabel(input.targetLanguageCode)
      },
      entries: input.entries.map((entry, index) => {
        const promptEntry = {
          i: entry.aiIndex || String(index + 1),
          t: entry.valueType,
          n: entry.label,
          v: getAiPromptValue(entry)
        }
        if (entry.skipAllowed === true) {
          promptEntry.k = true
        }
        const currentValue = getAiPromptCurrentValue(entry)
        if (
          typeof currentValue !== 'undefined' &&
          (entry.skipAllowed === true || input.verificationMode === true)
        ) {
          promptEntry.c = currentValue
        }
        return promptEntry
      })
    },
    null,
    2
  )
}

function hasTranslatableSegmentText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function findLongTextSplitIndex(text, maxLength) {
  const searchText = text.slice(0, maxLength)
  const candidates = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? ', ' ']
  let splitIndex = -1
  candidates.forEach(candidate => {
    const candidateIndex = searchText.lastIndexOf(candidate)
    if (candidateIndex > splitIndex) {
      splitIndex = candidateIndex + candidate.length
    }
  })

  if (splitIndex < Math.floor(maxLength * 0.4)) {
    return maxLength
  }
  return splitIndex
}

function splitLongText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text]
  }

  const parts = []
  let restText = text
  while (restText.length > maxLength) {
    const splitIndex = findLongTextSplitIndex(restText, maxLength)
    parts.push(restText.slice(0, splitIndex))
    restText = restText.slice(splitIndex)
  }
  if (restText) {
    parts.push(restText)
  }
  return parts
}

function getConfiguredMaxTokens(settings = {}) {
  const maxTokens = Number(
    settings.maxTokens || settings.deepSeekMaxTokens || 0
  )
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    return maxTokens
  }
  return 8192
}

function isAiThinkingModeEnabled(settings = {}) {
  return (
    getProviderCodeBySettings(settings) === 'deepseek' &&
    normalizeString(
      settings.thinkingType || settings.deepSeekThinkingType
    ).trim() === 'enabled'
  )
}

function getAiThinkingTokenReserve(settings = {}) {
  if (!isAiThinkingModeEnabled(settings)) {
    return 0
  }

  const maxTokens = getConfiguredMaxTokens(settings)
  const reasoningEffort = normalizeString(
    settings.reasoningEffort || settings.deepSeekReasoningEffort
  )
    .trim()
    .toLowerCase()

  let reserveRatio = AI_THINKING_TOKEN_RESERVE_RATIO
  let reserveFloor = AI_THINKING_TOKEN_RESERVE_MIN
  if (reasoningEffort === 'max') {
    reserveRatio = AI_THINKING_MAX_EFFORT_TOKEN_RESERVE_RATIO
    reserveFloor = AI_THINKING_MAX_EFFORT_TOKEN_RESERVE_MIN
  }

  const reservedTokens = Math.max(
    reserveFloor,
    Math.floor(maxTokens * reserveRatio)
  )
  const maxReasonableReserve =
    maxTokens - AI_RESPONSE_JSON_TOKEN_RESERVE - MIN_AI_REQUEST_TEXT_LENGTH
  if (maxReasonableReserve <= 0) {
    return 0
  }
  return Math.min(reservedTokens, maxReasonableReserve)
}

function getTranslationChunkTextLimit(settings = {}) {
  const maxTokens = getConfiguredMaxTokens(settings)
  const reservedTokens =
    AI_RESPONSE_JSON_TOKEN_RESERVE + getAiThinkingTokenReserve(settings)
  const usableOutputTokens = Math.max(
    MIN_AI_REQUEST_TEXT_LENGTH,
    maxTokens - reservedTokens
  )
  const outputTextLimit = Math.floor(
    usableOutputTokens * AI_OUTPUT_TEXT_TOKEN_RATIO
  )
  return Math.max(
    MIN_AI_REQUEST_TEXT_LENGTH,
    Math.min(MAX_AI_REQUEST_TEXT_LENGTH, outputTextLimit)
  )
}

function getRichTextSegmentTextLimit(settings = {}) {
  const chunkTextLimit = getTranslationChunkTextLimit(settings)
  const segmentTextLimit = Math.floor(
    chunkTextLimit * RICH_TEXT_SEGMENT_TEXT_RATIO
  )
  return Math.max(
    MIN_RICH_TEXT_SEGMENT_TEXT_LENGTH,
    Math.min(MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH, segmentTextLimit)
  )
}

function pushRichTextSegments(segments, path, text, maxTextLength) {
  const parts = splitLongText(text, maxTextLength)
  let offset = 0
  parts.forEach(partText => {
    if (!hasTranslatableSegmentText(partText)) {
      offset += partText.length
      return
    }
    const startIndex = offset
    const endIndex = offset + partText.length
    offset = endIndex
    const segment = {
      index: `s${segments.length + 1}`,
      path,
      text: partText
    }
    if (parts.length > 1) {
      segment.contextBefore = text.slice(
        Math.max(0, startIndex - RICH_TEXT_SEGMENT_CONTEXT_LENGTH),
        startIndex
      )
      segment.contextAfter = text.slice(
        endIndex,
        endIndex + RICH_TEXT_SEGMENT_CONTEXT_LENGTH
      )
    }
    segments.push({
      ...segment
    })
  })
}

function collectRichTextSegments(
  node,
  path = [],
  segments = [],
  maxTextLength = MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH
) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return segments
  }

  if (node.type === 'text') {
    if (hasTranslatableSegmentText(node.text)) {
      pushRichTextSegments(
        segments,
        path.concat('text'),
        node.text,
        maxTextLength
      )
    }
    return segments
  }

  if (node.type === 'element' && node.translatableAttrs) {
    Object.keys(node.translatableAttrs).forEach(attrName => {
      const text = node.translatableAttrs[attrName]
      if (hasTranslatableSegmentText(text)) {
        pushRichTextSegments(
          segments,
          path.concat(['translatableAttrs', attrName]),
          text,
          maxTextLength
        )
      }
    })
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((childNode, index) => {
      collectRichTextSegments(
        childNode,
        path.concat(['children', index]),
        segments,
        maxTextLength
      )
    })
  }

  return segments
}

function buildIndexedRichTextValue(segments) {
  return {
    type: RICH_TEXT_INDEXED_VALUE_TYPE,
    segments: segments.map(segment => {
      const item = {
        index: segment.index,
        text: segment.text
      }
      if (segment.contextBefore) {
        item.contextBefore = segment.contextBefore
      }
      if (segment.contextAfter) {
        item.contextAfter = segment.contextAfter
      }
      return item
    })
  }
}

function getAiPromptValue(entry) {
  if (entry.aiValue) {
    return entry.aiValue
  }
  return entry.value
}

function getAiPromptCurrentValue(entry) {
  if (entry.valueType === 'richTextDocument') {
    return entry.aiCurrentValue
  }
  return entry.currentValue
}

function prepareAiInput(input, options = {}) {
  const richTextSegmentTextLength =
    options.richTextSegmentTextLength || MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH
  const entries = input.entries.map((entry, index) => {
    const indexedEntry = {
      ...entry,
      aiIndex: String(index + 1)
    }
    if (indexedEntry.valueType !== 'richTextDocument') {
      return indexedEntry
    }

    const richTextSegments = collectRichTextSegments(
      indexedEntry.value,
      [],
      [],
      richTextSegmentTextLength
    )
    let currentRichTextSegments = []
    if (
      indexedEntry.currentValue &&
      typeof indexedEntry.currentValue === 'object' &&
      !Array.isArray(indexedEntry.currentValue)
    ) {
      currentRichTextSegments = collectRichTextSegments(
        indexedEntry.currentValue,
        [],
        [],
        richTextSegmentTextLength
      )
    }
    let aiCurrentValue = undefined
    if (currentRichTextSegments.length > 0) {
      aiCurrentValue = buildIndexedRichTextValue(currentRichTextSegments)
    }
    return {
      ...indexedEntry,
      richTextSegments,
      aiValue: buildIndexedRichTextValue(richTextSegments),
      aiCurrentValue
    }
  })

  return {
    ...input,
    entries
  }
}

function isPreparedAiEntry(entry) {
  if (!entry || !entry.aiIndex) {
    return false
  }
  if (entry.valueType !== 'richTextDocument') {
    return true
  }
  return (
    Array.isArray(entry.richTextSegments) &&
    entry.aiValue &&
    entry.aiValue.type === RICH_TEXT_INDEXED_VALUE_TYPE
  )
}

function ensurePreparedAiInput(input, options = {}) {
  if (
    input &&
    Array.isArray(input.entries) &&
    input.entries.every(entry => isPreparedAiEntry(entry))
  ) {
    return input
  }
  return prepareAiInput(input, options)
}

function getAiEntryTextLength(entry) {
  const value = getAiPromptValue(entry)
  if (
    value &&
    value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    Array.isArray(value.segments)
  ) {
    return value.segments.reduce((total, segment) => {
      return total + normalizeString(segment.text).length + 16
    }, 0)
  }
  return normalizeString(value).length + 64
}

function splitRichTextAiEntry(entry, maxTextLength) {
  const value = getAiPromptValue(entry)
  if (
    !value ||
    value.type !== RICH_TEXT_INDEXED_VALUE_TYPE ||
    !Array.isArray(value.segments) ||
    value.segments.length === 0
  ) {
    return [entry]
  }

  const slices = []
  let currentSegments = []
  let currentLength = 0

  function pushCurrentSlice() {
    if (currentSegments.length === 0) {
      return
    }
    slices.push({
      ...entry,
      aiValue: {
        type: RICH_TEXT_INDEXED_VALUE_TYPE,
        segments: currentSegments
      }
    })
    currentSegments = []
    currentLength = 0
  }

  value.segments.forEach(segment => {
    const segmentLength = normalizeString(segment.text).length + 16
    if (
      currentSegments.length > 0 &&
      currentLength + segmentLength > maxTextLength
    ) {
      pushCurrentSlice()
    }
    currentSegments.push(segment)
    currentLength += segmentLength
  })
  pushCurrentSlice()

  return slices
}

function splitAiInput(input, options = {}) {
  const maxRequestTextLength =
    options.maxRequestTextLength || MAX_AI_REQUEST_TEXT_LENGTH
  const richTextSegmentTextLength =
    options.richTextSegmentTextLength || MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH
  const chunks = []
  let currentEntries = []
  let currentLength = 0

  function pushCurrentChunk() {
    if (currentEntries.length === 0) {
      return
    }
    chunks.push({
      ...input,
      entries: currentEntries
    })
    currentEntries = []
    currentLength = 0
  }

  input.entries.forEach(entry => {
    const slices = splitRichTextAiEntry(entry, richTextSegmentTextLength)
    slices.forEach(slice => {
      const sliceLength = getAiEntryTextLength(slice)
      const hasSameEntryInCurrentChunk = currentEntries.some(currentEntry => {
        return currentEntry.id === slice.id
      })
      if (
        currentEntries.length > 0 &&
        (hasSameEntryInCurrentChunk ||
          currentLength + sliceLength > maxRequestTextLength)
      ) {
        pushCurrentChunk()
      }
      currentEntries.push(slice)
      currentLength += sliceLength
    })
  })
  pushCurrentChunk()

  if (chunks.length === 0) {
    return [{ ...input, entries: [] }]
  }
  return chunks
}

function getTermTargetLanguageCodes(input) {
  const languageCodes = []
  if (input.targetLanguageCode) {
    const targetLanguageCode = normalizeLanguageCode(input.targetLanguageCode)
    if (targetLanguageCode) {
      languageCodes.push(targetLanguageCode)
    }
  }
  if (Array.isArray(input.targetLanguageCodes)) {
    input.targetLanguageCodes.forEach(value => {
      const languageCode = normalizeLanguageCode(value)
      if (languageCode && !languageCodes.includes(languageCode)) {
        languageCodes.push(languageCode)
      }
    })
  }
  return languageCodes
}

function getStableTermTargetLanguageCodes(input) {
  return getTermTargetLanguageCodes(input).slice().sort()
}

function getTermTargetLanguageCodeLogValue(input) {
  return getStableTermTargetLanguageCodes(input).join(',')
}

function buildOfficialTermGlossaryCacheHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function buildTranslationChunkInputHash(chunkInput) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        sourceLanguageCode: chunkInput?.sourceLanguageCode || '',
        targetLanguageCode: chunkInput?.targetLanguageCode || '',
        targetLanguageCodes: chunkInput?.targetLanguageCodes || [],
        entries: chunkInput?.entries || [],
        officialTermGlossaryMarkdown:
          chunkInput?.officialTermGlossaryMarkdown || '',
        translationMemoPrompt: chunkInput?.translationMemoPrompt || '',
        prompt: chunkInput?.prompt || ''
      })
    )
    .digest('hex')
}

function getOfficialTermGlossaryScopeKey(input) {
  const explicitScopeKey = String(input.properNounScopeKey || '').trim()
  if (explicitScopeKey) {
    return explicitScopeKey
  }
  const sourceSnapshotId = String(input.sourceSnapshotId || '').trim()
  if (sourceSnapshotId) {
    return `sourceSnapshot:${sourceSnapshotId}`
  }
  const contentId = String(input.contentId || input.postId || '').trim()
  if (contentId) {
    return `content:${contentId}`
  }
  return ''
}

function buildOfficialTermGlossaryCacheKey(input, targetLanguageCodes) {
  const packages = buildTermExtractionPackages(input).map(termPackage => {
    return {
      packageType: termPackage.packageType,
      title: termPackage.title,
      text: termPackage.text
    }
  })
  return buildOfficialTermGlossaryCacheHash({
    scopeKey: getOfficialTermGlossaryScopeKey(input),
    sourceLanguageCode: input.sourceLanguageCode || '',
    targetLanguageCodes: targetLanguageCodes.slice().sort(),
    autoOrganizeOfficialTermGlossary:
      input.autoOrganizeOfficialTermGlossary !== false,
    searchOfficialTermTranslations:
      input.searchOfficialTermTranslations === true,
    packages
  })
}

function getOfficialTermGlossaryCache(taskCache, cacheKey) {
  if (!(taskCache instanceof Map)) {
    return null
  }
  return taskCache.get(cacheKey) || null
}

function setOfficialTermGlossaryCache(taskCache, cacheKey, promise) {
  if (!(taskCache instanceof Map)) {
    return promise
  }

  taskCache.set(cacheKey, promise)
  promise.catch(() => {
    const cachedPromise = taskCache.get(cacheKey)
    if (cachedPromise === promise) {
      taskCache.delete(cacheKey)
    }
  })
  return promise
}

function getEntryTermExtractionLabel(entry, index) {
  const labelList = [
    entry.groupLabel,
    entry.label,
    entry.recordLabel,
    entry.fieldName,
    entry.id
  ]
    .map(value => normalizeString(value).trim())
    .filter(Boolean)
  if (labelList.length > 0) {
    return labelList.join(' / ')
  }
  return `条目 ${index + 1}`
}

function decodeHtmlEntitiesForTermExtraction(text) {
  return normalizeString(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (matchText, codeText) => {
      const codePoint = Number(codeText)
      if (
        !Number.isFinite(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return matchText
      }
      return String.fromCodePoint(codePoint)
    })
    .replace(/&#x([0-9a-f]+);/gi, (matchText, codeText) => {
      const codePoint = Number.parseInt(codeText, 16)
      if (
        !Number.isFinite(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff
      ) {
        return matchText
      }
      return String.fromCodePoint(codePoint)
    })
}

function stripHtmlForTermExtraction(value) {
  return decodeHtmlEntitiesForTermExtraction(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/\s*(p|div|section|article|blockquote|li|tr|h[1-6])\s*>/gi,
      '\n'
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildTermExtractionTextFromRichTextSegments(segments) {
  return segments
    .map(segment => stripHtmlForTermExtraction(segment.text))
    .filter(Boolean)
    .join('\n')
}

function getEntryTermExtractionText(entry) {
  const value = getAiPromptValue(entry)
  if (
    value &&
    value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    Array.isArray(value.segments)
  ) {
    return buildTermExtractionTextFromRichTextSegments(value.segments)
  }
  if (typeof value === 'string') {
    return stripHtmlForTermExtraction(value)
  }
  if (value && typeof value === 'object') {
    const segments = collectRichTextSegments(value)
    if (segments.length > 0) {
      return buildTermExtractionTextFromRichTextSegments(segments)
    }
    return stripHtmlForTermExtraction(JSON.stringify(value))
  }
  return ''
}

function isArticleContentTermEntry(entry) {
  if (entry.fieldName !== 'content') {
    return false
  }
  if (entry.scope === 'post') {
    return true
  }
  if (entry.collectionName === 'posts') {
    return true
  }
  if (!entry.collectionName && !entry.scope) {
    return true
  }
  return false
}

function pushTermExtractionPackage(packages, packageData) {
  const text = normalizeString(packageData.text).trim()
  if (!text) {
    return
  }
  packages.push({
    packageType: packageData.packageType || 'overview',
    title: packageData.title || '翻译内容',
    text
  })
}

function pushOverviewTermPackages(packages, overviewItems) {
  let currentTextList = []
  let currentLength = 0

  function flushCurrentPackage() {
    if (currentTextList.length === 0) {
      return
    }
    pushTermExtractionPackage(packages, {
      packageType: 'overview',
      title: '标题、摘要与关联内容',
      text: currentTextList.join('\n\n')
    })
    currentTextList = []
    currentLength = 0
  }

  overviewItems.forEach(item => {
    const blockText = [`【${item.label}】`, item.text].join('\n')
    if (blockText.length > MAX_TERM_EXTRACTION_PACKAGE_TEXT_LENGTH) {
      flushCurrentPackage()
      splitLongText(blockText, MAX_TERM_EXTRACTION_PACKAGE_TEXT_LENGTH).forEach(
        (partText, partIndex) => {
          pushTermExtractionPackage(packages, {
            packageType: 'overview',
            title: `标题、摘要与关联内容 ${partIndex + 1}`,
            text: partText
          })
        }
      )
      return
    }

    if (
      currentTextList.length > 0 &&
      currentLength + blockText.length > MAX_TERM_EXTRACTION_PACKAGE_TEXT_LENGTH
    ) {
      flushCurrentPackage()
    }
    currentTextList.push(blockText)
    currentLength += blockText.length
  })

  flushCurrentPackage()
}

function buildTermExtractionPackages(input) {
  const packages = []
  const contentPackages = []
  const overviewItems = []
  input.entries.forEach((entry, index) => {
    const text = getEntryTermExtractionText(entry)
    if (!text.trim()) {
      return
    }
    const label = getEntryTermExtractionLabel(entry, index)
    if (!isArticleContentTermEntry(entry)) {
      overviewItems.push({ label, text })
      return
    }

    const textSlices = splitLongText(
      text,
      MAX_TERM_EXTRACTION_TEXT_SLICE_LENGTH
    )
    textSlices.forEach((partText, partIndex) => {
      pushTermExtractionPackage(contentPackages, {
        packageType: 'articleContent',
        title: `${label} / 正文切片 ${partIndex + 1}`,
        text: partText
      })
    })
  })

  pushOverviewTermPackages(packages, overviewItems)
  return packages.concat(contentPackages)
}

function buildTermExtractionRequestData(
  input,
  termPackage,
  previousContextSummary
) {
  return JSON.stringify(
    {
      task: 'extract_proper_noun_terms',
      outputContract: {
        rootType: 'object',
        requiredFields: ['schema', 'version', 'terms', 'contextSummary'],
        schema: TERM_EXTRACTION_RESULT_SCHEMA,
        version: 1,
        terms: {
          type: 'array',
          itemType: 'object',
          requiredFields: [
            'sourceText',
            'sourceLanguageCode',
            'searchKeywords',
            'importance',
            'note'
          ],
          itemSchema: {
            sourceText:
              '原文中需要联网确认官方译名的专有名词、作品名、角色名、地名、组织名或产品名',
            sourceLanguageCode:
              '该 sourceText 表面形式所属语言 code，必须使用系统支持的语言 code；无法判断时使用空字符串',
            searchKeywords:
              '1-6 个用于数据库模糊查询同一实体的原文核心关键词数组；去掉书名号、引号、感叹号等装饰标点，包含常见简称或无标点写法；不要放普通词或过宽关键词',
            importance: '1-100 的整数，数值越高越需要联网确认官方译名',
            note: '不超过 80 个汉字的词库消歧备注，只描述该词可脱离本文单独成立的稳定身份信息，如所属作品、角色定位、组织类型、地理属性；禁止写“文中提及”“本文”“正文”“本次内容”等上下文依赖表述，不要翻译'
          }
        },
        contextSummary:
          '不超过 300 个汉字的简短上下文摘要，只说明本次已读内容涉及的主题、作品、人物关系、组织、地点和场景；不要描述名词出现在标题、正文或段落中的位置'
      },
      sourceLanguageCode: input.sourceLanguageCode || '',
      targetLanguageCodes: getStableTermTargetLanguageCodes(input),
      supportedLanguageCodes:
        properNounTranslationService.SUPPORTED_LANGUAGE_CODES.map(code => {
          return {
            code,
            label: getLanguageText(code)
          }
        }),
      packageType: termPackage.packageType,
      packageTitle: termPackage.title,
      previousContextSummary: normalizeTermContextSummary(
        previousContextSummary
      ),
      textFormat: 'plain_text_without_html',
      text: termPackage.text
    },
    null,
    2
  )
}

function buildTermExtractionMessages(
  settings,
  input,
  termPackage,
  previousContextSummary
) {
  return [
    {
      role: 'system',
      content: buildPromptLayer('系统基础层', [
        '你是多语言博客 CMS 的官方译名联网检索候选词筛选器。',
        '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON。',
        `JSON 根节点必须包含 schema、version、terms 和 contextSummary，schema 固定为 ${TERM_EXTRACTION_RESULT_SCHEMA}。`,
        `返回 JSON 格式固定为：{"schema":"${TERM_EXTRACTION_RESULT_SCHEMA}","version":1,"terms":[{"sourceText":"原文词条","sourceLanguageCode":"zh-CN","searchKeywords":["原文词条","核心简称"],"importance":90,"note":"稳定身份线索"}],"contextSummary":"用于后续消歧的上下文摘要"}。`,
        'terms 中每项必须包含 sourceText、sourceLanguageCode、searchKeywords、importance 和 note；contextSummary 必须是用于后续消歧的稳定上下文摘要。',
        'sourceLanguageCode 必须标注 sourceText 表面形式所属语言，只能使用 supportedLanguageCodes 中给出的 code；无法判断时写空字符串。',
        '只抽取后续翻译需要联网确认官方译名、正式译名或权威通行译名的原文词条。',
        '抽取阶段必须把疑似需要官方译名的专有名词交给词库或联网流程；不要把它留给正文翻译阶段自由处理。',
        '如果词条只是普通词、普通地点描述、通用设施或无稳定实体指向的短语，且不需要核对既有译名，才不要抽取。'
      ])
    },
    {
      role: 'system',
      content: buildPromptLayer('抽取规则层', [
        '优先抽取作品名称、系列名称、角色名称、真实组织、品牌产品、游戏/书籍/影视/番剧标题、现实地标、官方活动名等需要核对正式译名的词条。',
        '只要词条像作品、角色、声优/作者、游戏、书籍、影视、番剧、出版社、平台、品牌、组织、活动、联名企划、小众地点、新近内容或标题标点敏感名称，就必须抽取；禁止因为你觉得可以直译、音译或意译而跳过。',
        '博客文章标题本身不属于需要确认官方译名的标题词条；如果标题中包含可独立成立的作品名、系列名、活动名等实体，只抽取这些独立实体，不要抽取整句文章标题。',
        '必须保留原文表面形式，不要自行翻译、改写、解释或添加括号。',
        '同一实体不要因为书名号、引号、空格、全半角、感叹号、问号、句点等装饰性差异拆成多个 terms；这类差异只保留一个规范词条。',
        'searchKeywords 必须由你生成，用于数据库模糊查询同一实体；写原文核心名、常见简称、无装饰标点写法。',
        'searchKeywords 不要使用“动画”“角色”“乐园”“停车场”这类过宽普通词，也不要使用目标语言译名。',
        '不要抽取由多个已可独立识别的实体用“×”“x”“X”“&”“＋”“+”“/”连接形成的临时组合名、联名展示名或宣传短语；如果确有翻译价值，只抽取其中需要查译名的独立实体。',
        '如果一个词条只是作品名、地点名、活动名、宣传词或展示用连接符组成的临时组合，不要返回这个组合词条；只返回确实需要确认译名的独立实体。',
        '输入正文已移除 HTML 标签；不要根据标签、属性或结构推测词条。',
        '不要抽取普通形容词、通用名词、完整句子、URL、代码、纯数字、日期、文件路径或随机 ID。',
        '不要抽取可以直接按目标语言常规表达翻译的道路、楼层、房间、编号路线、普通设施、泛称地点或行政区划组合。',
        '道路、楼层、房间、编号路线、普通设施、泛称地点或行政区划组合这类不需要联网确认官方译名的词条必须排除。',
        '不要把普通地点加描述性修饰组成、没有稳定正式名称的短语当成专有名词；即使它与作品巡礼、拍照打卡或剧情场景有关，也不代表它需要联网确认官方译名。',
        '如果你不确定一个词是否存在官方译名，只要它确实像作品、角色、品牌、组织、产品、现实地标、小众地点、活动或标题，就抽取并交给后续流程确认；只有明显是普通描述性短语时才排除。',
        '只有当不同写法确实指向不同官方实体或不同作品版本时才分别返回；同一对象的标点、简称、全半角或装饰符差异不要拆分。',
        'importance 必须综合判断词条对文章主题、标题摘要、关联内容和正文理解的一致性影响，以及联网确认官方译名的必要性。',
        '每个 terms 项都必须写 note；note 只用于数据库同名词消歧，不用于生成译名。',
        'note 要短，只写可脱离本文单独成立的稳定身份线索，包括所属作品、角色定位、组织属性、产品类型、地理属性；不要解释翻译方法，不要写目标语言译名。',
        'note 不是文章摘要；不要写依赖当前文章叙述、段落位置或临时场景的句子。',
        'note 禁止写“文中提及”“本文”“正文”“本次内容”“该段”“此处”等文章位置描述；不要写只在当前文章里成立的临时场景说明。',
        '必须结合 previousContextSummary 和当前包文本重新生成 contextSummary；contextSummary 只保留对专有名词译名判断有帮助的作品、人物、组织、地点、关系和场景。',
        'contextSummary 要覆盖当前包新增信息并继承仍然重要的上文信息，删除无关细节，不要逐字复述正文，不要编造未出现的设定，也不要描述名词出现在标题、正文或段落中的位置。',
        '遇到短人名、昵称、单字名或同形异义词时，contextSummary 必须说明它隶属的作品、角色关系或讨论对象，便于后续按语境选择官方译名。',
        `最多返回 ${MAX_EXTRACTED_TERM_COUNT} 个对象。`
      ])
    },
    {
      role: 'system',
      content: buildWorkflowPromptLayer(
        settings,
        input,
        'properNounPreprocessDefaultPrompt',
        'properNounPreprocessLanguagePrompts'
      )
    },
    {
      role: 'user',
      content: buildTermExtractionRequestData(
        input,
        termPackage,
        previousContextSummary
      )
    }
  ].filter(message => {
    return Boolean(message.content)
  })
}

function buildTermExtractionRequestConfig(
  settings,
  input,
  termPackage,
  previousContextSummary
) {
  return buildJsonRequestBody(
    settings,
    buildTermExtractionMessages(
      settings,
      input,
      termPackage,
      previousContextSummary
    ),
    { stream: false }
  )
}

function getTermArrayFromExtractionResult(resultData) {
  if (Array.isArray(resultData?.terms)) {
    return resultData.terms
  }
  if (Array.isArray(resultData?.keywords)) {
    return resultData.keywords
  }
  if (Array.isArray(resultData?.requiredOutput?.terms)) {
    return resultData.requiredOutput.terms
  }
  if (Array.isArray(resultData?.outputContract?.terms)) {
    return resultData.outputContract.terms
  }
  return null
}

function getTermContextSummaryFromExtractionResult(resultData) {
  if (typeof resultData?.contextSummary !== 'string') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'AI 名词抽取结果缺少 contextSummary 字符串',
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  return normalizeTermContextSummary(resultData.contextSummary)
}

function normalizeTermImportance(value, index) {
  const importance = Number(value)
  if (
    !Number.isInteger(importance) ||
    importance < MIN_TERM_IMPORTANCE ||
    importance > MAX_TERM_IMPORTANCE
  ) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms.importance 必须是 1-100 的整数`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  return importance
}

function normalizeExtractedTermSourceLanguageCode(value) {
  const languageCode = normalizeLanguageCode(normalizeString(value, 20))
  if (!languageCode) {
    return ''
  }
  return languageCode
}

function normalizeTermSearchKeywordList(item, index) {
  if (!Array.isArray(item.searchKeywords)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms.searchKeywords 必须是数组`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const keywordList = []
  item.searchKeywords.forEach(value => {
    const keyword = properNounTranslationService.normalizeSourceText(value)
    const normalizedKeyword = properNounTranslationService
      .buildNormalizedSourceText(keyword)
      .trim()
    if (!keyword || !normalizedKeyword) {
      return
    }
    if (keywordList.includes(keyword)) {
      return
    }
    keywordList.push(keyword)
  })
  if (keywordList.length === 0) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms.searchKeywords 不能为空`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  return keywordList.slice(0, MAX_TERM_SEARCH_KEYWORD_COUNT)
}

function getExtractedTermIdentityKey(term) {
  return (
    properNounTranslationService.buildLooseSourceTextIdentity(
      term.sourceText
    ) || term.normalizedSourceText
  )
}

function hasCompositeTermSeparator(sourceText) {
  return /[×✕＆&＋+／/]|\s[xX]\s/.test(String(sourceText || ''))
}

function shouldRemoveCompositeExtractedTerm(term, termList) {
  if (!hasCompositeTermSeparator(term.sourceText)) {
    return false
  }
  const termIdentity = getExtractedTermIdentityKey(term)
  if (!termIdentity) {
    return false
  }
  let matchedPartCount = 0
  termList.forEach(candidate => {
    if (candidate === term) {
      return
    }
    const candidateIdentity = getExtractedTermIdentityKey(candidate)
    if (!candidateIdentity || candidateIdentity.length < 2) {
      return
    }
    if (termIdentity.includes(candidateIdentity)) {
      matchedPartCount += 1
    }
  })
  return matchedPartCount >= 2
}

function removeCompositeExtractedTerms(termList) {
  return termList.filter(term => {
    return !shouldRemoveCompositeExtractedTerm(term, termList)
  })
}

function normalizeExtractedTermItem(item, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms 项必须是对象`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const sourceText = properNounTranslationService.normalizeSourceText(
    item.sourceText
  )
  const normalizedSourceText = properNounTranslationService
    .buildNormalizedSourceText(sourceText)
    .trim()
  if (!sourceText || !normalizedSourceText) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms.sourceText 不能为空`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  const note = normalizeString(item.note)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_EXTRACTED_TERM_NOTE_LENGTH)
  if (!note) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果第 ${index + 1} 个 terms.note 不能为空`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  return {
    sourceText,
    normalizedSourceText,
    sourceLanguageCode: normalizeExtractedTermSourceLanguageCode(
      item.sourceLanguageCode
    ),
    searchKeywords: normalizeTermSearchKeywordList(item, index),
    importance: normalizeTermImportance(item.importance, index),
    note
  }
}

function normalizeExtractedTermList(resultData) {
  const termList = getTermArrayFromExtractionResult(resultData)
  if (!termList) {
    const fieldNames = Object.keys(resultData || {})
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 名词抽取结果缺少 terms 数组，实际字段：${fieldNames.join('，')}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const termMap = new Map()
  termList.forEach((item, index) => {
    const termItem = normalizeExtractedTermItem(item, index)
    const identityKey = getExtractedTermIdentityKey(termItem)
    const termKey = identityKey || termItem.normalizedSourceText
    const existingTerm = termMap.get(termKey)
    if (!existingTerm) {
      termMap.set(termKey, termItem)
      return
    }
    if (termItem.importance > existingTerm.importance) {
      let sourceLanguageCode = termItem.sourceLanguageCode
      if (!sourceLanguageCode) {
        sourceLanguageCode = existingTerm.sourceLanguageCode || ''
      }
      existingTerm.searchKeywords.forEach(keyword => {
        if (!termItem.searchKeywords.includes(keyword)) {
          termItem.searchKeywords.push(keyword)
        }
      })
      if (!termItem.note && existingTerm.note) {
        termItem.note = existingTerm.note
      }
      termItem.sourceLanguageCode = sourceLanguageCode
      termMap.set(termKey, termItem)
      return
    }
    termItem.searchKeywords.forEach(keyword => {
      if (!existingTerm.searchKeywords.includes(keyword)) {
        existingTerm.searchKeywords.push(keyword)
      }
    })
    if (!existingTerm.note && termItem.note) {
      existingTerm.note = termItem.note
    }
    if (!existingTerm.sourceLanguageCode && termItem.sourceLanguageCode) {
      existingTerm.sourceLanguageCode = termItem.sourceLanguageCode
    }
  })

  return removeCompositeExtractedTerms(Array.from(termMap.values()))
}

function buildSelectedExtractedTermsFromMap(termMap) {
  const termList = Array.from(termMap.values())
  let selectedTerms = termList
  if (termList.length > MAX_EXTRACTED_TERM_COUNT) {
    selectedTerms = termList
      .slice()
      .sort((leftItem, rightItem) => {
        if (rightItem.importance !== leftItem.importance) {
          return rightItem.importance - leftItem.importance
        }
        return leftItem.order - rightItem.order
      })
      .slice(0, MAX_EXTRACTED_TERM_COUNT)
  }

  return selectedTerms.map(item => {
    return {
      sourceText: item.sourceText,
      normalizedSourceText: item.normalizedSourceText,
      sourceLanguageCode: item.sourceLanguageCode || '',
      searchKeywords: item.searchKeywords || [],
      importance: item.importance,
      note: item.note
    }
  })
}

async function recordTermExtractionUsage({
  input,
  settings,
  responseResult,
  status,
  httpStatusCode,
  packageIndex,
  packageCount,
  termPackage
}) {
  if (input.skipUsageLog === true) {
    return
  }
  await aiUsageService.recordAiUsageLog({
    provider: getProviderCodeBySettings(settings),
    model: getResponseModel(responseResult, settings),
    operation: 'proper-noun.keyword.extract',
    status,
    requestId: responseResult.requestId || '',
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
    usage: responseResult.usage || {},
    rawResponse: responseResult.rawResponse,
    meta: {
      jobId: input.translationJobId || input.cacheKey || '',
      httpStatusCode,
      packageIndex,
      packageCount,
      packageType: termPackage.packageType,
      packageTitle: termPackage.title,
      textLength: termPackage.text.length
    }
  })
}

async function extractTermsFromPackage({
  input,
  settings,
  url,
  termPackage,
  previousContextSummary,
  packageIndex,
  packageCount,
  handlers
}) {
  return await runAiStepWithRetry(
    async () => {
      const requestConfig = buildTermExtractionRequestConfig(
        settings,
        input,
        termPackage,
        previousContextSummary
      )
      const responseResult = await requestProviderJson(
        settings,
        requestConfig.requestBody,
        requestConfig.requestUrl,
        handlers
      )
      const isSuccessStatus =
        responseResult.statusCode >= 200 && responseResult.statusCode < 300
      let usageStatus = 'error'
      if (isSuccessStatus && !responseResult.parseError) {
        usageStatus = 'success'
      }
      await recordTermExtractionUsage({
        input,
        settings,
        responseResult,
        status: usageStatus,
        httpStatusCode: responseResult.statusCode,
        packageIndex,
        packageCount,
        termPackage
      })

      if (responseResult.parseError) {
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${getProviderLabelBySettings(settings)} 名词抽取返回内容不是 JSON`,
          getProviderFieldBySettings(settings),
          502
        )
      }
      if (!isSuccessStatus) {
        const message =
          responseResult.rawResponse?.error?.message ||
          responseResult.rawResponse?.message ||
          `${getProviderLabelBySettings(settings)} 名词抽取请求失败：${responseResult.statusCode}`
        throw createProviderApiError(settings, message)
      }

      const resultData = parseAiContentText(
        responseResult.contentText,
        settings,
        responseResult.finishReason
      )
      const terms = normalizeExtractedTermList(resultData)
      const contextSummary =
        getTermContextSummaryFromExtractionResult(resultData)
      return {
        terms,
        contextSummary,
        aiJsonLog: translationAiJsonLogService.createAiJsonLog({
          operation: 'proper-noun.keyword.extract',
          stage: 'ProperNounKeywordExtract',
          provider: getProviderCodeBySettings(settings),
          model: getResponseModel(responseResult, settings),
          requestId: responseResult.requestId || '',
          sourceLanguageCode: input.sourceLanguageCode,
          targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
          meta: {
            packageIndex,
            packageCount,
            packageType: termPackage.packageType,
            packageTitle: termPackage.title,
            textLength: termPackage.text.length,
            normalizedTermCount: terms.length,
            contextSummaryLength: contextSummary.length
          },
          input: {
            requestBody: requestConfig.requestBody
          },
          json: {
            result: resultData,
            normalizedTerms: terms,
            previousContextSummary: normalizeTermContextSummary(
              previousContextSummary
            ),
            contextSummary
          }
        })
      }
    },
    {
      stepKey: 'proper-noun.keyword.extract',
      stepLabel: `专有名词抽取第 ${packageIndex}/${packageCount} 包`,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
      field: getProviderFieldBySettings(settings),
      onStatus: handlers?.onStatus,
      cancellation: handlers?.cancellation
    }
  )
}

async function extractProperNounKeywords({ input, settings, url, handlers }) {
  const packages = buildTermExtractionPackages(input)
  if (packages.length === 0) {
    return {
      keywordArray: [],
      officialTermContextSummary: normalizeTermContextSummary(
        input.officialTermContextSummary
      ),
      aiJsonLogs: []
    }
  }

  const termMap = new Map()
  const aiJsonLogs = []
  let termOrder = 0
  let contextSummary = normalizeTermContextSummary(
    input.officialTermContextSummary
  )
  for (let index = 0; index < packages.length; index += 1) {
    throwIfCancellationRequested(handlers)
    const termPackage = packages[index]
    if (handlers.onStatus) {
      handlers.onStatus({
        message: `正在提取专有名词第 ${index + 1}/${packages.length} 包`
      })
    }
    const packageResult = await extractTermsFromPackage({
      input,
      settings,
      url,
      termPackage,
      previousContextSummary: contextSummary,
      packageIndex: index + 1,
      packageCount: packages.length,
      handlers
    })
    contextSummary = packageResult.contextSummary
    if (packageResult.aiJsonLog) {
      aiJsonLogs.push(packageResult.aiJsonLog)
    }
    packageResult.terms.forEach(termItem => {
      const existingTerm = termMap.get(termItem.normalizedSourceText)
      if (!existingTerm) {
        termMap.set(termItem.normalizedSourceText, {
          ...termItem,
          order: termOrder
        })
        termOrder += 1
        return
      }
      if (termItem.importance > existingTerm.importance) {
        let sourceLanguageCode = termItem.sourceLanguageCode
        if (!sourceLanguageCode) {
          sourceLanguageCode = existingTerm.sourceLanguageCode || ''
        }
        termMap.set(termItem.normalizedSourceText, {
          ...existingTerm,
          sourceText: termItem.sourceText,
          sourceLanguageCode,
          importance: termItem.importance,
          note: termItem.note
        })
        return
      }
      if (!existingTerm.sourceLanguageCode && termItem.sourceLanguageCode) {
        existingTerm.sourceLanguageCode = termItem.sourceLanguageCode
      }
    })
  }
  const extractedTerms = buildSelectedExtractedTermsFromMap(termMap)
  return {
    extractedTerms,
    keywordArray: extractedTerms.map(term => term.sourceText),
    officialTermContextSummary: contextSummary,
    aiJsonLogs
  }
}

function buildMissingTermRequests(missingTerms) {
  const termRequestMap = new Map()
  missingTerms.forEach(item => {
    if (!item.sourceText || !Array.isArray(item.languageCodes)) {
      return
    }
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(item.sourceText)
    if (!normalizedSourceText) {
      return
    }
    let termRequest = termRequestMap.get(normalizedSourceText)
    if (!termRequest) {
      termRequest = {
        sourceText: item.sourceText,
        normalizedSourceText,
        sourceLanguageCode: item.sourceLanguageCode || '',
        targetLanguageCodes: [],
        note: normalizeString(item.note).slice(
          0,
          MAX_EXTRACTED_TERM_NOTE_LENGTH
        ),
        termId: ''
      }
      if (
        Array.isArray(item.matchedTermIds) &&
        item.matchedTermIds.length > 0
      ) {
        termRequest.termId = String(item.matchedTermIds[0] || '').trim()
      }
      termRequestMap.set(normalizedSourceText, termRequest)
    }
    item.languageCodes.forEach(languageCode => {
      const normalizedLanguageCode = normalizeLanguageCode(languageCode)
      if (!normalizedLanguageCode) {
        return
      }
      if (termRequest.targetLanguageCodes.includes(normalizedLanguageCode)) {
        return
      }
      termRequest.targetLanguageCodes.push(normalizedLanguageCode)
    })
  })

  return Array.from(termRequestMap.values()).filter(termRequest => {
    return termRequest.targetLanguageCodes.length > 0
  })
}

function mergeMatchedTermLinks({
  matchedTermLinks,
  savedTranslations,
  extractedTerms
}) {
  const termMap = new Map()
  extractedTerms.forEach(term => {
    if (!term.normalizedSourceText) {
      return
    }
    termMap.set(term.normalizedSourceText, term)
  })
  const linkList = matchedTermLinks.slice()
  const linkKeySet = new Set(
    linkList.map(link => {
      return `${link.normalizedSourceText}::${link.termId}`
    })
  )
  savedTranslations.forEach(translation => {
    const termId = String(translation.termId || '')
    const normalizedSourceText = String(translation.normalizedSourceText || '')
    if (!termId || !normalizedSourceText) {
      return
    }
    const linkKey = `${normalizedSourceText}::${termId}`
    if (linkKeySet.has(linkKey)) {
      return
    }
    const extractedTerm = termMap.get(normalizedSourceText)
    linkKeySet.add(linkKey)
    linkList.push({
      termId,
      sourceText:
        extractedTerm?.sourceText ||
        translation.sourceText ||
        translation.sourceTextSnapshot,
      normalizedSourceText
    })
  })
  return linkList
}

async function saveResolvedTermTranslationsAndRefreshCoverage({
  terms,
  provider,
  model,
  matchedTermIds,
  matchedTermLinks,
  currentMatchedCandidateTerms,
  extractedTerms,
  targetLanguageCodes,
  properNounScopeKey = '',
  sourceLanguageCode = '',
  usageTracker,
  allowSameSourceTranslationWithNote = false
}) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return {
      matchedTermIds,
      matchedTermLinks,
      matchedCandidateTerms: currentMatchedCandidateTerms,
      candidateCoverage: null,
      coverage: null,
      savedTranslations: []
    }
  }

  const savedTranslations =
    await properNounTranslationService.upsertAiSearchTerms({
      terms,
      provider,
      model,
      allowSameSourceTranslationWithNote
    })
  const nextMatchedTermLinks = mergeMatchedTermLinks({
    matchedTermLinks,
    savedTranslations,
    extractedTerms
  })
  const nextMatchedTermIds = getMatchedTermIdsFromLinks(nextMatchedTermLinks)
  let candidateCoverage =
    await properNounTranslationService.getTranslationCandidatesForExtractedTerms(
      {
        terms: extractedTerms,
        targetLanguageCodes
      }
    )
  candidateCoverage =
    await sourcePostProperNounRelationService.mergeArticleLinkedCandidateCoverage(
      {
        scopeKey: properNounScopeKey,
        sourceLanguageCode,
        candidateCoverage,
        targetLanguageCodes
      }
    )
  const matchedCandidateTerms = buildMatchedCandidateTerms(
    candidateCoverage.candidateTerms,
    nextMatchedTermLinks
  )
  const coverage =
    await properNounTranslationService.compareMatchedTermTranslationCoverage({
      terms: extractedTerms,
      targetLanguageCodes,
      candidateTerms: matchedCandidateTerms,
      translations: candidateCoverage.translations,
      matchedTermIds: nextMatchedTermIds,
      usageTracker
    })

  return {
    matchedTermIds: nextMatchedTermIds,
    matchedTermLinks: nextMatchedTermLinks,
    matchedCandidateTerms,
    candidateCoverage,
    coverage,
    savedTranslations
  }
}

function groupCandidateTermsByNormalizedSourceText(candidateTerms) {
  const candidateMap = new Map()
  candidateTerms.forEach(term => {
    let matchedSourceTextItems = []
    if (Array.isArray(term.matchedSourceTextItems)) {
      matchedSourceTextItems = term.matchedSourceTextItems
    }
    const normalizedSourceTextList = matchedSourceTextItems
      .map(item => String(item?.normalizedSourceText || ''))
      .filter(Boolean)
    if (normalizedSourceTextList.length === 0 && term.normalizedSourceText) {
      normalizedSourceTextList.push(String(term.normalizedSourceText))
    }
    normalizedSourceTextList.forEach(normalizedSourceText => {
      if (!candidateMap.has(normalizedSourceText)) {
        candidateMap.set(normalizedSourceText, [])
      }
      candidateMap.get(normalizedSourceText).push(term)
    })
  })
  return candidateMap
}

function shouldFilterExistingTermWithAi(sourceTextItem, candidateTerms) {
  return Array.isArray(candidateTerms) && candidateTerms.length > 0
}

function splitExistingTermCandidatesForFilter(sourceTextItems, candidateTerms) {
  const candidateMap = groupCandidateTermsByNormalizedSourceText(candidateTerms)
  const autoMatchedTermIds = []
  const autoMatchedTermLinks = []
  const filterSourceTextItems = []
  const filterCandidateTerms = []
  const filterCandidateTermIdSet = new Set()

  sourceTextItems.forEach(sourceTextItem => {
    const termList = candidateMap.get(sourceTextItem.normalizedSourceText) || []
    if (termList.length === 0) {
      return
    }
    if (!shouldFilterExistingTermWithAi(sourceTextItem, termList)) {
      const termId = String(termList[0]._id || '')
      autoMatchedTermIds.push(termId)
      autoMatchedTermLinks.push({
        termId,
        sourceText: sourceTextItem.sourceText,
        normalizedSourceText: sourceTextItem.normalizedSourceText
      })
      return
    }
    filterSourceTextItems.push(sourceTextItem)
    termList.forEach(term => {
      const termId = String(term._id || '')
      if (filterCandidateTermIdSet.has(termId)) {
        return
      }
      filterCandidateTermIdSet.add(termId)
      filterCandidateTerms.push(term)
    })
  })

  return {
    autoMatchedTermIds,
    autoMatchedTermLinks,
    filterSourceTextItems,
    filterCandidateTerms
  }
}

function buildCandidateIdentityNote(term) {
  const termNote = normalizeString(term.note).slice(
    0,
    MAX_EXTRACTED_TERM_NOTE_LENGTH
  )
  if (termNote) {
    return termNote
  }
  return ''
}

function buildExistingTermFilterRequestData({
  input,
  sourceTextItems,
  candidateTerms,
  contextSummary
}) {
  return JSON.stringify(
    {
      task: 'filter_existing_proper_noun_terms',
      outputContract: {
        rootType: 'object',
        requiredFields: ['schema', 'version', 'matchedTerms'],
        schema: TERM_EXISTING_FILTER_RESULT_SCHEMA,
        version: 1,
        matchedTerms:
          '数组，每项包含 sourceText 和 termId；只包含确认属于同一对象的抽取名词与数据库候选配对'
      },
      sourceLanguageCode: input.sourceLanguageCode || '',
      targetLanguageCodes: getStableTermTargetLanguageCodes(input),
      contentContextSummary: normalizeTermContextSummary(contextSummary),
      extractedTerms: sourceTextItems.map(item => {
        return {
          sourceText: item.sourceText,
          note: normalizeString(item.note).slice(
            0,
            MAX_EXTRACTED_TERM_NOTE_LENGTH
          )
        }
      }),
      databaseCandidates: candidateTerms.map(term => {
        const row = {
          termId: String(term._id || ''),
          sourceText: term.sourceText || ''
        }
        if (Array.isArray(term.matchedSourceTextItems)) {
          row.matchedExtractedTerms = term.matchedSourceTextItems.map(item => {
            return {
              sourceText: item.sourceText || '',
              note: normalizeString(item.note).slice(
                0,
                MAX_EXTRACTED_TERM_NOTE_LENGTH
              )
            }
          })
        }
        const note = buildCandidateIdentityNote(term)
        if (note) {
          row.note = note
        }
        return row
      })
    },
    null,
    2
  )
}

function buildExistingTermFilterMessages({
  settings,
  input,
  sourceTextItems,
  candidateTerms,
  contextSummary
}) {
  return [
    {
      role: 'system',
      content: buildPromptLayer('系统基础层', [
        '你是多语言博客 CMS 的专有名词数据库候选消歧器。',
        '本步骤禁止翻译、禁止联网、禁止补充译名，只判断数据库候选是否属于本次文章中的同一对象。',
        '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON。',
        `JSON 根节点必须包含 schema、version、matchedTerms，schema 固定为 ${TERM_EXISTING_FILTER_RESULT_SCHEMA}。`,
        'matchedTerms 中每一项必须包含 sourceText 和 termId；禁止只返回 termId。'
      ])
    },
    {
      role: 'system',
      content: buildPromptLayer('消歧规则层', [
        '数据库候选来自 AI 生成关键词的模糊查询，候选 sourceText 不一定与 extractedTerms.sourceText 完全相同。',
        '必须结合 contentContextSummary、extractedTerms.note、databaseCandidates.matchedExtractedTerms 和 databaseCandidates.note 判断。',
        '短人名、昵称、单字名、同形异义词不能只按字面匹配。',
        '包含关系、同系列、续作、平台版本、服务器区域、Online/手游/2/II 等版本词差异，默认不是同一实体；必须有 note 或上下文明确证明才可配对。',
        '带版本词、平台词、续作编号、区服词、Online、手游或数字编号的表面相近名词必须分别判断，不能因为共享核心词就互相复用词库记录。',
        '标点、书名号、感叹号、全半角或简称差异不应阻止同一实体匹配，但只能在实体身份已经确认一致时合并。',
        '临时组合名、联名展示名或宣传短语不能因为包含数据库里的作品名就整体匹配，必须确认候选本身就是 extractedTerms 中需要的实体。',
        '只有数据库候选明确指向某个 extractedTerms.sourceText 在本文中的同一作品、角色、组织、地点、产品或讨论对象时，才能把 {sourceText, termId} 放入 matchedTerms。',
        '同一个 termId 不能因为关键词相似就自动套用到多个 sourceText；每个配对都必须单独确认。',
        '如果候选备注缺失或信息不足以确认同一对象，必须剔除该候选。',
        '不要输出理由、译名、备注、候选之外的 termId 或 extractedTerms 之外的 sourceText。'
      ])
    },
    {
      role: 'system',
      content: buildWorkflowPromptLayer(
        settings,
        input,
        'properNounPreprocessDefaultPrompt',
        'properNounPreprocessLanguagePrompts'
      )
    },
    {
      role: 'user',
      content: buildExistingTermFilterRequestData({
        input,
        sourceTextItems,
        candidateTerms,
        contextSummary
      })
    }
  ].filter(message => {
    return Boolean(message.content)
  })
}

function getTermFilterMaxTokens(settings) {
  const configuredMaxTokens = Number(
    settings.maxTokens || settings.deepSeekMaxTokens || 0
  )

  if (isAiThinkingModeEnabled(settings)) {
    let thinkingMaxTokens = MAX_TERM_FILTER_THINKING_TOKENS
    const reasoningEffort = normalizeString(
      settings.reasoningEffort || settings.deepSeekReasoningEffort
    )
      .trim()
      .toLowerCase()
    if (reasoningEffort === 'max') {
      thinkingMaxTokens = MAX_TERM_FILTER_MAX_EFFORT_TOKENS
    }
    if (
      Number.isFinite(configuredMaxTokens) &&
      configuredMaxTokens > 0 &&
      configuredMaxTokens < thinkingMaxTokens
    ) {
      return configuredMaxTokens
    }
    return thinkingMaxTokens
  }

  if (
    Number.isFinite(configuredMaxTokens) &&
    configuredMaxTokens > 0 &&
    configuredMaxTokens < MAX_TERM_FILTER_TOKENS
  ) {
    return configuredMaxTokens
  }
  return MAX_TERM_FILTER_TOKENS
}

function buildExistingTermFilterRequestConfig({
  settings,
  input,
  sourceTextItems,
  candidateTerms,
  contextSummary
}) {
  return buildJsonRequestBody(
    settings,
    buildExistingTermFilterMessages({
      settings,
      input,
      sourceTextItems,
      candidateTerms,
      contextSummary
    }),
    {
      stream: false,
      maxTokens: getTermFilterMaxTokens(settings)
    }
  )
}

function findSourceTextItemForMatchedTerm(matchItem, sourceTextItems) {
  const sourceText = properNounTranslationService.normalizeSourceText(
    matchItem?.sourceText
  )
  const normalizedSourceTextFromSource =
    properNounTranslationService.buildNormalizedSourceText(sourceText)
  const normalizedSourceTextFromMatch =
    properNounTranslationService.buildNormalizedSourceText(
      matchItem?.normalizedSourceText
    )
  return sourceTextItems.find(sourceTextItem => {
    if (
      normalizedSourceTextFromSource &&
      sourceTextItem.normalizedSourceText === normalizedSourceTextFromSource
    ) {
      return true
    }
    if (
      normalizedSourceTextFromMatch &&
      sourceTextItem.normalizedSourceText === normalizedSourceTextFromMatch
    ) {
      return true
    }
    return false
  })
}

function isCandidateMatchedToSourceText(term, normalizedSourceText) {
  let matchedSourceTextItems = []
  if (Array.isArray(term.matchedSourceTextItems)) {
    matchedSourceTextItems = term.matchedSourceTextItems
  }
  if (matchedSourceTextItems.length === 0) {
    return term.normalizedSourceText === normalizedSourceText
  }
  return matchedSourceTextItems.some(item => {
    return item.normalizedSourceText === normalizedSourceText
  })
}

function normalizeMatchedExistingTermLinks({
  resultData,
  candidateTerms,
  sourceTextItems
}) {
  if (!Array.isArray(resultData?.matchedTerms)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'AI 专有名词候选消歧结果缺少 matchedTerms 数组',
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const candidateMap = new Map()
  candidateTerms.forEach(term => {
    const termId = String(term._id || '')
    if (termId) {
      candidateMap.set(termId, term)
    }
  })
  const matchedTermLinks = []
  const matchedLinkKeySet = new Set()
  resultData.matchedTerms.forEach(matchItem => {
    const termId = String(matchItem?.termId || '').trim()
    const candidateTerm = candidateMap.get(termId)
    if (!termId || !candidateTerm) {
      return
    }
    const sourceTextItem = findSourceTextItemForMatchedTerm(
      matchItem,
      sourceTextItems
    )
    if (!sourceTextItem) {
      return
    }
    if (
      !isCandidateMatchedToSourceText(
        candidateTerm,
        sourceTextItem.normalizedSourceText
      )
    ) {
      return
    }
    const linkKey = `${sourceTextItem.normalizedSourceText}::${termId}`
    if (matchedLinkKeySet.has(linkKey)) {
      return
    }
    matchedLinkKeySet.add(linkKey)
    matchedTermLinks.push({
      termId,
      sourceText: sourceTextItem.sourceText,
      normalizedSourceText: sourceTextItem.normalizedSourceText
    })
  })
  return matchedTermLinks
}

function getMatchedTermIdsFromLinks(matchedTermLinks) {
  const matchedTermIds = []
  matchedTermLinks.forEach(link => {
    const termId = String(link.termId || '')
    if (termId && !matchedTermIds.includes(termId)) {
      matchedTermIds.push(termId)
    }
  })
  return matchedTermIds
}

function buildMatchedCandidateTerms(candidateTerms, matchedTermLinks) {
  const linkMap = new Map()
  matchedTermLinks.forEach(link => {
    const termId = String(link.termId || '')
    const normalizedSourceText = String(link.normalizedSourceText || '')
    if (!termId || !normalizedSourceText) {
      return
    }
    if (!linkMap.has(termId)) {
      linkMap.set(termId, new Set())
    }
    linkMap.get(termId).add(normalizedSourceText)
  })
  return candidateTerms
    .map(term => {
      const termId = String(term._id || '')
      const normalizedSourceTextSet = linkMap.get(termId)
      if (!normalizedSourceTextSet) {
        return null
      }
      let matchedSourceTextItems = []
      if (Array.isArray(term.matchedSourceTextItems)) {
        matchedSourceTextItems = term.matchedSourceTextItems.filter(item => {
          return normalizedSourceTextSet.has(item.normalizedSourceText)
        })
      }
      if (matchedSourceTextItems.length === 0) {
        return null
      }
      return {
        ...term,
        matchedSourceTextItems
      }
    })
    .filter(Boolean)
}

function buildExistingTermCandidateLogItem(term) {
  const item = {
    termId: String(term._id || ''),
    sourceText: term.sourceText || ''
  }
  const note = buildCandidateIdentityNote(term)
  if (note) {
    item.note = note
  }
  if (Array.isArray(term.matchedSourceTextItems)) {
    item.matchedExtractedTerms = term.matchedSourceTextItems.map(sourceItem => {
      return {
        sourceText: sourceItem.sourceText || '',
        note: normalizeString(sourceItem.note).slice(
          0,
          MAX_EXTRACTED_TERM_NOTE_LENGTH
        )
      }
    })
  }
  return item
}

function buildMatchedExistingTermCandidateLogItems(
  candidateTerms,
  matchedTermIds
) {
  const matchedIdSet = new Set(matchedTermIds.map(item => String(item || '')))
  return candidateTerms
    .filter(term => matchedIdSet.has(String(term._id || '')))
    .map(term => buildExistingTermCandidateLogItem(term))
}

async function filterExistingTermCandidatesWithAi({
  input,
  settings,
  url,
  sourceTextItems,
  candidateTerms,
  contextSummary,
  handlers
}) {
  if (candidateTerms.length === 0) {
    return {
      matchedTermIds: [],
      aiJsonLog: null
    }
  }

  return await runAiStepWithRetry(
    async () => {
      const requestConfig = buildExistingTermFilterRequestConfig({
        settings,
        input,
        sourceTextItems,
        candidateTerms,
        contextSummary
      })
      const responseResult = await requestProviderJson(
        settings,
        requestConfig.requestBody,
        requestConfig.requestUrl,
        handlers
      )
      const isSuccessStatus =
        responseResult.statusCode >= 200 && responseResult.statusCode < 300
      let usageStatus = 'error'
      if (isSuccessStatus && !responseResult.parseError) {
        usageStatus = 'success'
      }
      if (input.skipUsageLog !== true) {
        await aiUsageService.recordAiUsageLog({
          provider: getProviderCodeBySettings(settings),
          model: getResponseModel(responseResult, settings),
          operation: 'proper-noun.existing-term.filter',
          status: usageStatus,
          requestId: responseResult.requestId || '',
          sourceLanguageCode: input.sourceLanguageCode,
          targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
          usage: responseResult.usage || {},
          rawResponse: responseResult.rawResponse,
          meta: {
            jobId: input.translationJobId || input.cacheKey || '',
            httpStatusCode: responseResult.statusCode,
            sourceTermCount: sourceTextItems.length,
            candidateTermCount: candidateTerms.length,
            contextSummaryLength:
              normalizeTermContextSummary(contextSummary).length
          }
        })
      }

      if (responseResult.parseError) {
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${getProviderLabelBySettings(settings)} 专有名词候选消歧返回内容不是 JSON`,
          getProviderFieldBySettings(settings),
          502
        )
      }
      if (!isSuccessStatus) {
        const message =
          responseResult.rawResponse?.error?.message ||
          responseResult.rawResponse?.message ||
          `${getProviderLabelBySettings(settings)} 专有名词候选消歧请求失败：${responseResult.statusCode}`
        throw createProviderApiError(settings, message)
      }

      const resultData = parseAiContentText(
        responseResult.contentText,
        settings,
        responseResult.finishReason
      )
      const matchedTermLinks = normalizeMatchedExistingTermLinks({
        resultData,
        candidateTerms,
        sourceTextItems
      })
      const matchedTermIds = getMatchedTermIdsFromLinks(matchedTermLinks)
      const matchedCandidateTerms = buildMatchedCandidateTerms(
        candidateTerms,
        matchedTermLinks
      )
      const databaseCandidates = candidateTerms.map(term => {
        return buildExistingTermCandidateLogItem(term)
      })
      const matchedTerms = buildMatchedExistingTermCandidateLogItems(
        candidateTerms,
        matchedTermIds
      )
      return {
        matchedTermIds,
        matchedTermLinks,
        matchedCandidateTerms,
        aiJsonLog: translationAiJsonLogService.createAiJsonLog({
          operation: 'proper-noun.existing-term.filter',
          stage: 'ProperNounExistingTermFilter',
          provider: getProviderCodeBySettings(settings),
          model: getResponseModel(responseResult, settings),
          requestId: responseResult.requestId || '',
          sourceLanguageCode: input.sourceLanguageCode,
          targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
          meta: {
            sourceTermCount: sourceTextItems.length,
            candidateTermCount: candidateTerms.length,
            matchedTermCount: matchedTermIds.length,
            contextSummaryLength:
              normalizeTermContextSummary(contextSummary).length
          },
          input: {
            requestBody: requestConfig.requestBody
          },
          json: {
            result: resultData,
            matchedTermIds,
            matchedTermLinks,
            matchedTerms,
            databaseCandidates
          }
        })
      }
    },
    {
      stepKey: 'proper-noun.existing-term.filter',
      stepLabel: '专有名词候选消歧',
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: getTermTargetLanguageCodeLogValue(input),
      field: getProviderFieldBySettings(settings),
      onStatus: handlers?.onStatus,
      cancellation: handlers?.cancellation
    }
  )
}

async function resolveExistingTermMatches({
  input,
  settings,
  url,
  sourceTextItems,
  candidateTerms,
  contextSummary,
  handlers
}) {
  const splitResult = splitExistingTermCandidatesForFilter(
    sourceTextItems,
    candidateTerms
  )
  if (splitResult.filterCandidateTerms.length === 0) {
    const matchedCandidateTerms = buildMatchedCandidateTerms(
      candidateTerms,
      splitResult.autoMatchedTermLinks
    )
    return {
      matchedTermIds: splitResult.autoMatchedTermIds,
      matchedTermLinks: splitResult.autoMatchedTermLinks,
      matchedCandidateTerms,
      aiJsonLog: null
    }
  }

  if (handlers.onStatus) {
    handlers.onStatus({
      message: `正在判断 ${splitResult.filterCandidateTerms.length} 条同名专有名词候选`
    })
  }
  const filterResult = await filterExistingTermCandidatesWithAi({
    input,
    settings,
    url,
    sourceTextItems: splitResult.filterSourceTextItems,
    candidateTerms: splitResult.filterCandidateTerms,
    contextSummary,
    handlers
  })
  const matchedTermLinks = splitResult.autoMatchedTermLinks.concat(
    filterResult.matchedTermLinks
  )
  const matchedTermIds = getMatchedTermIdsFromLinks(matchedTermLinks)
  const matchedCandidateTerms = buildMatchedCandidateTerms(
    candidateTerms,
    matchedTermLinks
  )
  return {
    matchedTermIds,
    matchedTermLinks,
    matchedCandidateTerms,
    aiJsonLog: filterResult.aiJsonLog
  }
}

async function resolveOfficialTermGlossaryCacheData({
  input,
  settings,
  url,
  handlers,
  targetLanguageCodes,
  allowSameSourceTranslationWithNote = false
}) {
  const extractionResult = await extractProperNounKeywords({
    input,
    settings,
    url,
    handlers
  })
  const extractedTerms =
    properNounTranslationService.normalizeExtractedTermList(
      extractionResult.extractedTerms
    )
  const keywordArray = extractedTerms.map(term => term.sourceText)
  const officialTermContextSummary = normalizeTermContextSummary(
    extractionResult.officialTermContextSummary
  )
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    extractionResult.aiJsonLogs
  )
  const usageTracker = new Map()
  if (extractedTerms.length === 0) {
    if (handlers.onStatus) {
      handlers.onStatus({ message: '未抽取到需要检索的专有名词' })
    }
    return {
      aiJsonLogs,
      extractedTerms: [],
      keywordArray: [],
      matchedTermIds: [],
      matchedTermLinks: [],
      matchedCandidateTerms: [],
      candidateCoverage: {
        sourceTextItems: [],
        languageCodes: targetLanguageCodes,
        candidateTerms: [],
        translations: []
      },
      coverage: {
        translations: [],
        existingTerms: [],
        missingTerms: []
      },
      savedTranslations: [],
      officialTermContextSummary,
      officialTermGlossaryMarkdownMap: {},
      officialTermStats: {
        keywordCount: 0,
        candidateCount: 0,
        articleLinkedCandidateCount: 0,
        matchedTermCount: 0,
        existingCount: 0,
        missingCount: 0,
        missingRequestCount: 0,
        aiKnowledgeBaseTermCount: 0,
        aiKnowledgeBaseTranslationCount: 0,
        internetSearchTermCount: 0,
        internetSearchTranslationCount: 0,
        internetSearchRequestedTermCount: 0,
        internetSearchTargetLanguageCodes: [],
        skipInternetSearch: input.searchOfficialTermTranslations !== true,
        contextSummaryLength: officialTermContextSummary.length,
        glossaryLanguageCodes: []
      }
    }
  }

  let candidateCoverage =
    await properNounTranslationService.getTranslationCandidatesForExtractedTerms(
      {
        terms: extractedTerms,
        targetLanguageCodes
      }
    )
  candidateCoverage =
    await sourcePostProperNounRelationService.mergeArticleLinkedCandidateCoverage(
      {
        scopeKey: getOfficialTermGlossaryScopeKey(input),
        sourceLanguageCode: input.sourceLanguageCode,
        candidateCoverage,
        targetLanguageCodes
      }
    )
  const matchResult = await resolveExistingTermMatches({
    input,
    settings,
    url,
    sourceTextItems: candidateCoverage.sourceTextItems,
    candidateTerms: candidateCoverage.candidateTerms,
    contextSummary: officialTermContextSummary,
    handlers
  })
  if (matchResult.aiJsonLog) {
    aiJsonLogs.push(matchResult.aiJsonLog)
  }
  let matchedTermIds = matchResult.matchedTermIds
  let matchedTermLinks = matchResult.matchedTermLinks
  let matchedCandidateTerms = matchResult.matchedCandidateTerms
  let coverage =
    await properNounTranslationService.compareMatchedTermTranslationCoverage({
      terms: extractedTerms,
      targetLanguageCodes,
      candidateTerms: matchedCandidateTerms,
      translations: candidateCoverage.translations,
      matchedTermIds,
      usageTracker
    })

  let missingTermRequests = buildMissingTermRequests(coverage.missingTerms)
  let aiKnowledgeBaseTermCount = 0
  let aiKnowledgeBaseTranslationCount = 0
  let internetSearchTermCount = 0
  let internetSearchTranslationCount = 0
  let internetSearchRequestedTermCount = 0
  let internetSearchTargetLanguageCodes = []
  const allowInternetSearch = input.searchOfficialTermTranslations === true
  const skipInternetSearch = !allowInternetSearch
  let savedTranslations = []
  if (missingTermRequests.length > 0) {
    if (handlers.onStatus) {
      let statusMessage = `正在交给名词知识库翻译 AI 处理 ${missingTermRequests.length} 个缺失专有名词`
      if (allowInternetSearch) {
        statusMessage = `正在交给名词搜索翻译 AI 处理 ${missingTermRequests.length} 个缺失专有名词`
      }
      handlers.onStatus({
        message: statusMessage
      })
    }
    const searchRequestedTermRequests = missingTermRequests
    const searchResult =
      await internetSearchAiService.searchOfficialTermTranslations({
        termRequests: searchRequestedTermRequests,
        sourceLanguageCode: input.sourceLanguageCode,
        contextSummary: officialTermContextSummary,
        skipUsageLog: input.skipUsageLog,
        onStatus: handlers.onStatus,
        cancellation: handlers.cancellation,
        skipInternetSearch,
        allowSameSourceTranslationWithNote
      })
    aiKnowledgeBaseTermCount = searchResult.stats?.aiKnowledgeBaseTermCount || 0
    aiKnowledgeBaseTranslationCount =
      searchResult.stats?.aiKnowledgeBaseTranslationCount || 0
    internetSearchTermCount = searchResult.stats?.internetSearchTermCount || 0
    internetSearchTranslationCount =
      searchResult.stats?.internetSearchTranslationCount || 0
    internetSearchRequestedTermCount =
      searchResult.stats?.internetSearchRequestedTermCount || 0
    internetSearchTargetLanguageCodes =
      searchResult.stats?.internetSearchTargetLanguageCodes || []
    translationAiJsonLogService
      .mergeAiJsonLogs(searchResult.aiJsonLogs)
      .forEach(aiJsonLog => {
        aiJsonLogs.push(aiJsonLog)
      })
    aiJsonLogs.push(
      translationAiJsonLogService.createAiJsonLog({
        operation: 'proper-noun.official-translation.resolve',
        stage: 'ProperNounOfficialTranslationResolve',
        provider: searchResult.provider,
        model: searchResult.model,
        requestId: '',
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: targetLanguageCodes.join(','),
        meta: {
          sourceTermCount: searchRequestedTermRequests.length,
          targetLanguageCodes,
          aiKnowledgeBaseTermCount,
          aiKnowledgeBaseTranslationCount,
          internetSearchTermCount,
          internetSearchTranslationCount,
          internetSearchRequestedTermCount,
          internetSearchTargetLanguageCodes,
          skipInternetSearch,
          contextSummaryLength: officialTermContextSummary.length
        },
        input: {
          termRequests: searchRequestedTermRequests,
          contextSummary: officialTermContextSummary
        },
        json: {
          contextSummary: officialTermContextSummary,
          terms: searchResult.terms,
          stats: searchResult.stats,
          rawResponse: searchResult.rawResponse
        }
      })
    )
    const searchSaveResult =
      await saveResolvedTermTranslationsAndRefreshCoverage({
        terms: searchResult.terms,
        provider: searchResult.provider,
        model: searchResult.model,
        matchedTermIds,
        matchedTermLinks,
        currentMatchedCandidateTerms: matchedCandidateTerms,
        extractedTerms,
        targetLanguageCodes,
        properNounScopeKey: getOfficialTermGlossaryScopeKey(input),
        sourceLanguageCode: input.sourceLanguageCode,
        usageTracker,
        allowSameSourceTranslationWithNote
      })
    matchedTermIds = searchSaveResult.matchedTermIds
    matchedTermLinks = searchSaveResult.matchedTermLinks
    if (searchSaveResult.candidateCoverage) {
      candidateCoverage = searchSaveResult.candidateCoverage
    }
    if (searchSaveResult.matchedCandidateTerms) {
      matchedCandidateTerms = searchSaveResult.matchedCandidateTerms
    }
    if (searchSaveResult.coverage) {
      coverage = searchSaveResult.coverage
    }
    savedTranslations = searchSaveResult.savedTranslations || []
    missingTermRequests = buildMissingTermRequests(coverage.missingTerms)
  }

  const glossaryMarkdownMap =
    translationOfficialTermGlossaryService.buildOfficialTermGlossaryMarkdownMap(
      {
        extractedTerms,
        targetLanguageCodes,
        coverage
      }
    )
  if (handlers.onStatus) {
    handlers.onStatus({
      message: `已整理 ${keywordArray.length} 个专有名词用于本次翻译`
    })
  }

  return {
    aiJsonLogs,
    extractedTerms,
    keywordArray,
    matchedTermIds,
    matchedTermLinks,
    matchedCandidateTerms,
    candidateCoverage,
    coverage,
    savedTranslations,
    officialTermContextSummary,
    officialTermGlossaryMarkdownMap: glossaryMarkdownMap,
    officialTermStats: {
      keywordCount: keywordArray.length,
      candidateCount: candidateCoverage.candidateTerms.length,
      articleLinkedCandidateCount:
        candidateCoverage.articleLinkedCandidateCount || 0,
      matchedTermCount: matchedTermIds.length,
      existingCount: coverage.existingTerms.length,
      missingCount: coverage.missingTerms.length,
      missingRequestCount: missingTermRequests.length,
      aiKnowledgeBaseTermCount,
      aiKnowledgeBaseTranslationCount,
      internetSearchTermCount,
      internetSearchTranslationCount,
      internetSearchRequestedTermCount,
      internetSearchTargetLanguageCodes,
      skipInternetSearch,
      contextSummaryLength: officialTermContextSummary.length,
      glossaryLanguageCodes: Object.keys(glossaryMarkdownMap)
    }
  }
}

async function resolveLinkedOfficialTermGlossaryCacheData({
  input,
  handlers,
  targetLanguageCodes
}) {
  const sourcePostId =
    sourcePostProperNounRelationService.getSourcePostIdFromScopeKey(
      getOfficialTermGlossaryScopeKey(input)
    )
  const glossaryData =
    await translationOfficialTermGlossaryService.resolveLinkedOfficialTermGlossaryData(
      {
        sourcePostId,
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCodes,
        handlers
      }
    )
  const missingTermRequests = buildMissingTermRequests(
    glossaryData.coverage.missingTerms
  )
  return {
    ...glossaryData,
    officialTermStats:
      translationOfficialTermGlossaryService.buildLinkedOfficialTermStats(
        glossaryData,
        missingTermRequests.length
      )
  }
}

async function getOfficialTermGlossaryCacheData({
  input,
  handlers,
  targetLanguageCodes,
  taskCache
}) {
  const cacheKey = buildOfficialTermGlossaryCacheKey(input, targetLanguageCodes)
  const cachedPromise = getOfficialTermGlossaryCache(taskCache, cacheKey)
  if (cachedPromise) {
    const cachedData = await cachedPromise
    if (handlers.onStatus) {
      handlers.onStatus({
        message: `复用已整理的 ${cachedData.officialTermStats.keywordCount} 个专有名词词库`
      })
    }
    return {
      ...cachedData,
      aiJsonLogs: []
    }
  }

  let promise = null
  if (input.autoOrganizeOfficialTermGlossary === false) {
    promise = resolveLinkedOfficialTermGlossaryCacheData({
      input,
      handlers,
      targetLanguageCodes
    })
  } else {
    const settings =
      await aiSettingsService.getProperNounPreprocessRuntimeSettings()
    promise = resolveOfficialTermGlossaryCacheData({
      input,
      settings,
      handlers,
      targetLanguageCodes,
      allowSameSourceTranslationWithNote: true
    })
  }
  return await setOfficialTermGlossaryCache(taskCache, cacheKey, promise)
}

async function prepareOfficialTermGlossaryForAiInput({
  input,
  handlers,
  taskCache
}) {
  const targetLanguageCodes = getStableTermTargetLanguageCodes(input)
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    return input
  }
  if (targetLanguageCodes.length === 0) {
    return input
  }

  if (handlers.onStatus) {
    handlers.onStatus({ message: '正在准备专有名词翻译数据库' })
  }
  const glossaryData = await getOfficialTermGlossaryCacheData({
    input,
    handlers,
    targetLanguageCodes,
    taskCache
  })
  const glossaryMarkdown =
    translationOfficialTermGlossaryService.getCurrentOfficialTermGlossaryMarkdown(
      {
        input,
        glossaryMarkdownMap: glossaryData.officialTermGlossaryMarkdownMap
      }
    )

  return {
    ...input,
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(
      input.aiJsonLogs,
      glossaryData.aiJsonLogs
    ),
    officialTermContextSummary: glossaryData.officialTermContextSummary,
    officialTermGlossaryMarkdown: glossaryMarkdown,
    officialTermGlossaryMarkdownMap:
      glossaryData.officialTermGlossaryMarkdownMap,
    officialTermStats: glossaryData.officialTermStats
  }
}

function buildTranslationMessages(settings, input) {
  const systemPromptList = [
    buildSystemPrompt(),
    buildOutputContractPrompt(),
    buildTranslationTaskPrompt(input),
    buildTranslationQualityPrompt(),
    buildLanguageJudgementPrompt(input),
    buildNameTranslationPrompt(input),
    buildOfficialTermGlossaryPrompt(input),
    buildNonLanguagePrompt(input),
    buildSkipPolicyPrompt(input),
    buildCurrentValuePolicyPrompt(input),
    buildVerificationModePrompt(input),
    buildRichTextPolicyPrompt(input),
    buildSitePrompt(settings),
    buildTargetLanguageDefaultPrompt(settings, input),
    buildTranslationMemoPrompt(input)
  ].filter(Boolean)

  const messages = systemPromptList.map(content => ({
    role: 'system',
    content
  }))

  const userSupplementPrompt = buildUserSupplementPrompt(input)
  if (userSupplementPrompt) {
    messages.push({
      role: 'user',
      content: userSupplementPrompt
    })
  }

  messages.push({
    role: 'user',
    content: buildRequestDataPrompt(input)
  })

  return messages
}

function buildTranslationRequestConfig(settings, input, stream = false) {
  return buildJsonRequestBody(
    settings,
    buildTranslationMessages(settings, input),
    {
      stream
    }
  )
}

function createTranslationCancelledError(reason, retryable = true) {
  const message = String(reason || '').trim() || 'AI 翻译已停止'
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    message,
    'translation',
    499,
    { retryable }
  )
}

function isCancellationRequested(options = {}) {
  return options.cancellation?.isCancelled === true
}

function throwIfCancellationRequested(options = {}) {
  if (!isCancellationRequested(options)) {
    return
  }
  throw createTranslationCancelledError(
    options.cancellation?.reason,
    options.cancellation?.retryable !== false
  )
}

function getAiResponseContentPreview(content) {
  const text = String(content || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) {
    return ''
  }
  if (text.length <= MAX_AI_PARSE_ERROR_PREVIEW_LENGTH) {
    return text
  }
  return `${text.slice(0, MAX_AI_PARSE_ERROR_PREVIEW_LENGTH)}...`
}

function addJsonContentCandidate(candidateList, value) {
  const candidate = String(value || '').trim()
  if (!candidate) {
    return
  }
  if (candidateList.includes(candidate)) {
    return
  }
  candidateList.push(candidate)
}

function collectFencedJsonCandidates(content, candidateList) {
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi
  let match = fencePattern.exec(content)
  while (match) {
    addJsonContentCandidate(candidateList, match[1])
    match = fencePattern.exec(content)
  }
}

function getFirstJsonStartIndex(content) {
  const objectIndex = content.indexOf('{')
  const arrayIndex = content.indexOf('[')
  if (objectIndex < 0) {
    return arrayIndex
  }
  if (arrayIndex < 0) {
    return objectIndex
  }
  return Math.min(objectIndex, arrayIndex)
}

function extractBalancedJsonText(content) {
  const startIndex = getFirstJsonStartIndex(content)
  if (startIndex < 0) {
    return ''
  }

  const stack = []
  let inString = false
  let escaped = false

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      stack.push('}')
      continue
    }
    if (char === '[') {
      stack.push(']')
      continue
    }
    if (char === '}' || char === ']') {
      const expectedChar = stack.pop()
      if (expectedChar !== char) {
        return ''
      }
      if (stack.length === 0) {
        return content.slice(startIndex, index + 1)
      }
    }
  }

  return ''
}

function buildJsonContentCandidates(content) {
  const candidateList = []
  addJsonContentCandidate(candidateList, content)
  collectFencedJsonCandidates(content, candidateList)
  addJsonContentCandidate(candidateList, extractBalancedJsonText(content))
  return candidateList
}

function parseAiContentText(content, settings, finishReason = '') {
  if (!content || typeof content !== 'string') {
    throw createProviderApiError(
      settings,
      `${getProviderLabelBySettings(settings)} 没有返回可用内容`
    )
  }

  const candidateList = buildJsonContentCandidates(content)
  for (const candidate of candidateList) {
    try {
      return JSON.parse(candidate)
    } catch (error) {
      continue
    }
  }

  const preview = getAiResponseContentPreview(content)
  let message = `${getProviderLabelBySettings(settings)} 返回的 JSON 内容解析失败`
  const extra = { finishReason }
  if (finishReason === 'length') {
    message = `${getProviderLabelBySettings(settings)} 返回内容被最大输出 Token 截断，JSON 内容解析失败`
    extra.retryable = false
    extra.manualRetryRequired = true
  }
  if (preview) {
    message = `${message}，内容开头：${preview}`
  }
  throw createProviderApiError(settings, message, 502, extra)
}

function buildEntriesFromObjectMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }
  return Object.entries(value)
    .map(([key, entryValue]) => {
      if (/^\d+$/.test(key)) {
        return { i: key, v: entryValue }
      }
      return { n: key, v: entryValue }
    })
    .filter(item => item.v !== undefined)
}

function normalizeResultEntries(resultData) {
  if (Array.isArray(resultData)) {
    return resultData
  }

  if (!resultData || typeof resultData !== 'object') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'AI 返回的 JSON 根节点必须是对象',
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const candidateEntries = [
    resultData.entries,
    resultData.translations,
    resultData.data?.entries,
    resultData.result?.entries,
    resultData.payload?.entries
  ]
  for (const entries of candidateEntries) {
    if (Array.isArray(entries)) {
      return entries
    }
    const mappedEntries = buildEntriesFromObjectMap(entries)
    if (mappedEntries.length > 0) {
      return mappedEntries
    }
  }

  const ignoredKeys = new Set(['schema', 'version', 'meta', 'usage'])
  const mappedEntries = buildEntriesFromObjectMap(
    Object.fromEntries(
      Object.entries(resultData).filter(([key]) => !ignoredKeys.has(key))
    )
  )
  if (mappedEntries.length > 0) {
    return mappedEntries
  }

  const actualKeys = Object.keys(resultData).join(', ')
  throw new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    `AI 返回 JSON 缺少 entries，实际字段：${actualKeys || '无'}`,
    AI_TRANSLATION_ERROR_FIELD,
    502
  )
}

function mergeTranslatedRichTextNode(originalNode, translatedNode) {
  if (!originalNode || typeof originalNode !== 'object') {
    return originalNode
  }

  const result = cloneSerializableValue(originalNode)
  if (!translatedNode || typeof translatedNode !== 'object') {
    return result
  }

  if (result.type === 'text') {
    if (typeof translatedNode.text === 'string') {
      result.text = translatedNode.text
    }
    return result
  }

  if (result.type === 'element') {
    if (
      result.translatableAttrs &&
      translatedNode.translatableAttrs &&
      typeof translatedNode.translatableAttrs === 'object'
    ) {
      Object.keys(result.translatableAttrs).forEach(key => {
        if (typeof translatedNode.translatableAttrs[key] === 'string') {
          result.translatableAttrs[key] = translatedNode.translatableAttrs[key]
        }
      })
    }
  }

  if (
    Array.isArray(result.children) &&
    Array.isArray(translatedNode.children)
  ) {
    result.children = result.children.map((childNode, index) => {
      return mergeTranslatedRichTextNode(
        childNode,
        translatedNode.children[index]
      )
    })
  }

  return result
}

function setRichTextValueByPath(documentValue, path, text) {
  if (!Array.isArray(path) || path.length === 0) {
    return false
  }
  let current = documentValue
  for (let index = 0; index < path.length - 1; index += 1) {
    current = current?.[path[index]]
    if (!current || typeof current !== 'object') {
      return false
    }
  }
  const key = path[path.length - 1]
  if (typeof key === 'undefined') {
    return false
  }
  current[key] = text
  return true
}

function normalizeIndexedRichTextSegments(entry, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 返回的富文本索引结果不合法：${entry.label || entry.id}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  if (value.type !== RICH_TEXT_INDEXED_VALUE_TYPE) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 返回的富文本类型不合法：${entry.label || entry.id}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  let segmentList = value.s
  if (Array.isArray(value.segments)) {
    segmentList = value.segments
  }
  if (!Array.isArray(segmentList)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 返回的富文本 segments 不合法：${entry.label || entry.id}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  const segmentMap = new Map()
  segmentList.forEach(segment => {
    const segmentIndex = segment?.index || segment?.i
    const segmentText = segment?.text ?? segment?.x ?? segment?.v
    if (!segment || typeof segmentIndex !== 'string') {
      return
    }
    if (typeof segmentText === 'string') {
      segmentMap.set(segmentIndex, segmentText)
    }
  })
  return segmentMap
}

function getResultEntryKey(item) {
  if (!item || typeof item !== 'object') {
    return ''
  }
  if (item.i !== undefined && item.i !== null) {
    return String(item.i)
  }
  if (typeof item.id === 'string') {
    return item.id
  }
  return ''
}

function getResultEntryValue(item) {
  if (!item || typeof item !== 'object') {
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(item, 'v')) {
    return item.v
  }
  return item.value
}

function getResultEntrySkipReason(item) {
  if (!item || typeof item !== 'object') {
    return ''
  }
  return normalizeString(item.r).trim().slice(0, 300)
}

function normalizeFallbackKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function addCandidateKey(candidateList, value) {
  const key = normalizeFallbackKey(value)
  if (key && !candidateList.includes(key)) {
    candidateList.push(key)
  }
}

function getLabelLastPart(label) {
  const text = String(label || '')
  if (!text.includes(' / ')) {
    return text
  }
  const parts = text.split(' / ')
  return parts[parts.length - 1]
}

function getInputEntryCandidateKeys(entry) {
  const candidateList = []
  addCandidateKey(candidateList, entry.label)
  addCandidateKey(candidateList, getLabelLastPart(entry.label))
  addCandidateKey(candidateList, entry.fieldName)
  addCandidateKey(candidateList, entry.n)
  return candidateList
}

function getResultEntryCandidateKeys(item) {
  const candidateList = []
  addCandidateKey(candidateList, item.n)
  addCandidateKey(candidateList, item.label)
  addCandidateKey(candidateList, item.name)
  addCandidateKey(candidateList, item.fieldName)
  addCandidateKey(candidateList, getResultEntryKey(item))
  return candidateList
}

function buildUniqueCandidateMap(itemList, getCandidateKeys) {
  const candidateMap = new Map()
  const duplicatedKeySet = new Set()
  itemList.forEach(item => {
    getCandidateKeys(item).forEach(key => {
      if (duplicatedKeySet.has(key)) {
        return
      }
      if (candidateMap.has(key)) {
        candidateMap.delete(key)
        duplicatedKeySet.add(key)
        return
      }
      candidateMap.set(key, item)
    })
  })
  return candidateMap
}

function findTranslatedEntry(
  entry,
  resultMap,
  resultCandidateMap,
  inputCandidateMap
) {
  const translatedEntry =
    resultMap.get(entry.aiIndex) || resultMap.get(entry.id)
  if (translatedEntry) {
    return translatedEntry
  }

  const candidateList = getInputEntryCandidateKeys(entry)
  for (const candidateKey of candidateList) {
    if (inputCandidateMap.get(candidateKey) !== entry) {
      continue
    }
    const fallbackEntry = resultCandidateMap.get(candidateKey)
    if (fallbackEntry) {
      return fallbackEntry
    }
  }
  return null
}

function getRichTextSegmentsForTranslation(entry) {
  let richTextSegments = []
  if (Array.isArray(entry.richTextSegments)) {
    richTextSegments = entry.richTextSegments
  }
  const aiSegments = entry.aiValue?.segments
  if (
    !entry.aiValue ||
    entry.aiValue.type !== RICH_TEXT_INDEXED_VALUE_TYPE ||
    !Array.isArray(aiSegments)
  ) {
    return richTextSegments
  }

  const aiSegmentIndexSet = new Set()
  aiSegments.forEach(segment => {
    const segmentIndex = normalizeString(segment?.index).trim()
    if (segmentIndex) {
      aiSegmentIndexSet.add(segmentIndex)
    }
  })
  if (aiSegmentIndexSet.size === 0) {
    return richTextSegments
  }

  return richTextSegments.filter(segment => {
    return aiSegmentIndexSet.has(normalizeString(segment.index).trim())
  })
}

function applyIndexedRichTextTranslation(entry, value) {
  const richTextSegments = getRichTextSegmentsForTranslation(entry)
  if (richTextSegments.length === 0) {
    return cloneSerializableValue(entry.value)
  }

  const translatedSegmentMap = normalizeIndexedRichTextSegments(entry, value)
  const mergedValue = cloneSerializableValue(entry.value)
  const translatedPathMap = new Map()
  for (const segment of richTextSegments) {
    if (!translatedSegmentMap.has(segment.index)) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `AI 返回结果缺少富文本片段：${entry.label || entry.id} / ${segment.index}`,
        AI_TRANSLATION_ERROR_FIELD,
        502
      )
    }
    const pathKey = JSON.stringify(segment.path)
    if (!translatedPathMap.has(pathKey)) {
      translatedPathMap.set(pathKey, {
        path: segment.path,
        text: ''
      })
    }
    const pathItem = translatedPathMap.get(pathKey)
    pathItem.text += translatedSegmentMap.get(segment.index)
  }

  for (const pathItem of translatedPathMap.values()) {
    const isUpdated = setRichTextValueByPath(
      mergedValue,
      pathItem.path,
      pathItem.text
    )
    if (!isUpdated) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `富文本片段回填失败：${entry.label || entry.id}`,
        AI_TRANSLATION_ERROR_FIELD,
        502
      )
    }
  }

  try {
    validateRichTextDocumentNode(mergedValue, entry.id)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 返回的富文本结构不合法：${entry.label || entry.id}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }
  return mergedValue
}

function normalizeTranslatedValue(entry, value) {
  if (entry.valueType === 'richTextDocument') {
    if (value?.type === RICH_TEXT_INDEXED_VALUE_TYPE) {
      return applyIndexedRichTextTranslation(entry, value)
    }

    const mergedValue = mergeTranslatedRichTextNode(entry.value, value)
    try {
      validateRichTextDocumentNode(mergedValue, entry.id)
    } catch (error) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `AI 返回的富文本结构不合法：${entry.label || entry.id}`,
        AI_TRANSLATION_ERROR_FIELD,
        502
      )
    }
    return mergedValue
  }

  if (typeof value !== 'string') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `AI 返回的条目不是字符串：${entry.label || entry.id}`,
      AI_TRANSLATION_ERROR_FIELD,
      502
    )
  }

  return value
}

function buildTranslatedEntries(preparedInput, resultData) {
  const resultEntries = normalizeResultEntries(resultData)
  const resultMap = new Map()
  resultEntries.forEach(item => {
    const key = getResultEntryKey(item)
    if (key) {
      resultMap.set(key, item)
    }
  })
  const resultCandidateMap = buildUniqueCandidateMap(
    resultEntries,
    getResultEntryCandidateKeys
  )
  const inputCandidateMap = buildUniqueCandidateMap(
    preparedInput.entries,
    getInputEntryCandidateKeys
  )

  return preparedInput.entries.map(entry => {
    const translatedEntry = findTranslatedEntry(
      entry,
      resultMap,
      resultCandidateMap,
      inputCandidateMap
    )
    if (!translatedEntry) {
      const actualKeys = resultEntries
        .map(item => getResultEntryKey(item) || item.n || item.label || '')
        .filter(Boolean)
        .join(', ')
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `AI 返回结果缺少条目：${entry.label || entry.id}，期望 i=${entry.aiIndex}，实际返回：${actualKeys || '无'}`,
        AI_TRANSLATION_ERROR_FIELD,
        502
      )
    }
    const normalizedValue = normalizeTranslatedValue(
      entry,
      getResultEntryValue(translatedEntry)
    )
    const skipReason = getResultEntrySkipReason(translatedEntry)
    const keptOriginal =
      entry.skipAllowed === true &&
      entry.valueType !== 'richTextDocument' &&
      normalizeString(normalizedValue).trim() ===
        normalizeString(entry.value).trim()

    if (keptOriginal && !skipReason) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `AI 跳过内容缺少原因：${entry.label || entry.id}`,
        AI_TRANSLATION_ERROR_FIELD,
        502
      )
    }

    const outputEntry = {
      id: entry.id,
      scope: entry.scope,
      label: entry.label,
      groupLabel: entry.groupLabel,
      fieldName: entry.fieldName,
      valueType: entry.valueType,
      value: normalizedValue
    }
    if (keptOriginal) {
      outputEntry.aiSkipReason = skipReason
    }
    if (entry.collectionName) {
      outputEntry.collectionName = entry.collectionName
    }
    if (entry.relationField) {
      outputEntry.relationField = entry.relationField
    }
    if (entry.recordId) {
      outputEntry.recordId = entry.recordId
    }
    if (entry.recordKind) {
      outputEntry.recordKind = entry.recordKind
    }
    if (entry.sourceRecordId) {
      outputEntry.sourceRecordId = entry.sourceRecordId
    }
    if (entry.recordLabel) {
      outputEntry.recordLabel = entry.recordLabel
    }
    if (entry.optionId) {
      outputEntry.optionId = entry.optionId
    }
    if (Number.isInteger(entry.optionIndex)) {
      outputEntry.optionIndex = entry.optionIndex
    }
    if (Number.isInteger(entry.urlIndex)) {
      outputEntry.urlIndex = entry.urlIndex
    }
    if (entry.sourceId) {
      outputEntry.sourceId = entry.sourceId
    }
    if (entry.sourceSnapshotId) {
      outputEntry.sourceSnapshotId = entry.sourceSnapshotId
    }
    if (entry.currentPreviewText) {
      outputEntry.currentPreviewText = entry.currentPreviewText
    }
    if (entry.currentPreviewRawValue) {
      outputEntry.currentPreviewRawValue = entry.currentPreviewRawValue
    }
    if (entry.currentPreviewHtml) {
      outputEntry.currentPreviewHtml = entry.currentPreviewHtml
    }
    if (entry.sourcePreviewText) {
      outputEntry.sourcePreviewText = entry.sourcePreviewText
    }
    if (entry.sourcePreviewRawValue) {
      outputEntry.sourcePreviewRawValue = entry.sourcePreviewRawValue
    }
    if (entry.sourcePreviewHtml) {
      outputEntry.sourcePreviewHtml = entry.sourcePreviewHtml
    }
    if (entry.nextPreviewHtml) {
      outputEntry.nextPreviewHtml = entry.nextPreviewHtml
    }
    if (entry.relationTypeLabel) {
      outputEntry.relationTypeLabel = entry.relationTypeLabel
    }
    if (entry.assets && Object.keys(entry.assets).length > 0) {
      outputEntry.assets = entry.assets
    }

    return outputEntry
  })
}

function buildTranslatedPayload(input, post, resultData) {
  const preparedInput = ensurePreparedAiInput(input)
  const entries = buildTranslatedEntries(preparedInput, resultData)

  return {
    schema: TRANSLATION_JSON_SCHEMA,
    version: TRANSLATION_JSON_VERSION,
    meta: {
      postId: preparedInput.postId || '',
      contentId: preparedInput.contentId || preparedInput.postId || '',
      contentType: preparedInput.contentType || 'post',
      languageCode: preparedInput.targetLanguageCode,
      sourceLanguageCode: preparedInput.sourceLanguageCode,
      postType: Number(post?.type || preparedInput.postType || 1),
      snapshotVersion: Number(
        post?.snapshotVersion || preparedInput.snapshotVersion || 1
      ),
      exportedAt: new Date().toISOString(),
      generatedBy: String(preparedInput.aiProvider || 'deepseek'),
      richTextFormat: 'structured-html-dom-v1',
      richTextInstruction:
        '富文本字段使用结构化 JSON。AI 只允许翻译 text 与 translatableAttrs 中的自然语言，不允许修改 tag、attrs、children、src、href、style、data-* 等结构字段。'
    },
    entries
  }
}

function mergeUsageValue(leftValue, rightValue) {
  if (typeof rightValue === 'number' && Number.isFinite(rightValue)) {
    if (typeof leftValue === 'number' && Number.isFinite(leftValue)) {
      return leftValue + rightValue
    }
    return rightValue
  }

  if (
    rightValue &&
    typeof rightValue === 'object' &&
    !Array.isArray(rightValue)
  ) {
    const result = {}
    if (
      leftValue &&
      typeof leftValue === 'object' &&
      !Array.isArray(leftValue)
    ) {
      Object.assign(result, cloneSerializableValue(leftValue))
    }
    Object.entries(rightValue).forEach(([key, value]) => {
      result[key] = mergeUsageValue(result[key], value)
    })
    return result
  }

  if (typeof leftValue === 'undefined') {
    return cloneSerializableValue(rightValue)
  }
  return leftValue
}

function mergeUsage(leftUsage = {}, rightUsage = {}) {
  return mergeUsageValue(leftUsage, rightUsage) || {}
}

function mergeChunkResultEntry(resultMap, entry) {
  const entryKey =
    getResultEntryKey(entry) || getResultEntryCandidateKeys(entry)[0]
  if (!entryKey) {
    return
  }

  const value = getResultEntryValue(entry)
  if (
    value &&
    value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    (Array.isArray(value.segments) || Array.isArray(value.s))
  ) {
    let segmentList = value.s
    if (Array.isArray(value.segments)) {
      segmentList = value.segments
    }
    if (!resultMap.has(entryKey)) {
      resultMap.set(entryKey, {
        i: entryKey,
        v: {
          type: RICH_TEXT_INDEXED_VALUE_TYPE,
          segments: []
        }
      })
    }
    const mergedEntry = resultMap.get(entryKey)
    mergedEntry.v.segments.push(...segmentList)
    return
  }

  resultMap.set(entryKey, entry)
}

function getTranslationChunkCacheScope(input) {
  const explicitScope = normalizeString(input.cacheScopeKey)
  if (explicitScope) {
    return explicitScope
  }
  return [
    input.operation || 'translation.post',
    input.contentType || 'post',
    input.contentId || input.postId || '',
    input.targetLanguageCode || ''
  ]
    .filter(Boolean)
    .join(':')
}

function getTranslationChunkCacheOptions({ input, chunkInput, chunkIndex }) {
  const cacheKey = normalizeString(input.cacheKey)
  if (!cacheKey) {
    return null
  }
  return {
    cacheKey,
    scopeKey: getTranslationChunkCacheScope(input),
    chunkIndex,
    chunkInputHash: buildTranslationChunkInputHash(chunkInput)
  }
}

function buildTranslationChunkAiJsonLog({
  input,
  responseResult,
  responseModel,
  requestBody,
  resultData,
  chunkInput,
  chunkIndex,
  chunkTotal,
  attemptNo
}) {
  return translationAiJsonLogService.createAiJsonLog({
    operation: input.operation || 'translation.post',
    stage: 'TranslationChunk',
    provider: getProviderCodeBySettings({ provider: input.aiProvider }),
    model: responseResult.model || responseModel,
    requestId: responseResult.requestId || '',
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    meta: {
      stream: true,
      chunkIndex: chunkIndex + 1,
      chunkCount: chunkTotal,
      attemptNo,
      entryCount: chunkInput.entries.length
    },
    input: {
      requestBody
    },
    json: resultData
  })
}

function appendCachedAiJsonLog(aiJsonLogs, aiJsonLog) {
  if (!aiJsonLog) {
    return
  }
  const nextLog = cloneSerializableValue(aiJsonLog)
  nextLog.meta = {
    ...(nextLog.meta || {}),
    cacheHit: true
  }
  aiJsonLogs.push(nextLog)
}

function buildTranslationChunkCacheResponse(response) {
  const responseData = response?.data || {}
  return {
    statusCode: response?.statusCode || 200,
    data: {
      id: responseData.id || '',
      model: responseData.model || '',
      object: responseData.object || 'chat.completion.stream',
      choices: [
        {
          finish_reason: null,
          message: {
            content: '',
            reasoning_content: ''
          }
        }
      ],
      usage: responseData.usage || {},
      cacheSnapshot: true
    }
  }
}

function appendTranslationChunkState({
  state,
  response,
  resultData,
  aiJsonLog,
  cached
}) {
  if (response) {
    state.chunkResponses.push(response)
    const responseData = response.data || {}
    state.combinedUsage = mergeUsage(
      state.combinedUsage,
      responseData.usage || {}
    )
    state.responseModel = responseData.model || state.responseModel
    if (responseData.id && !state.responseId) {
      state.responseId = responseData.id
    }
  }
  if (cached) {
    appendCachedAiJsonLog(state.aiJsonLogs, aiJsonLog)
  } else if (aiJsonLog) {
    state.aiJsonLogs.push(aiJsonLog)
  }
  normalizeResultEntries(resultData).forEach(entry => {
    mergeChunkResultEntry(state.resultMap, entry)
  })
}

function buildAiUsageTextDigest(value) {
  if (typeof value !== 'string') {
    return null
  }

  const digest = {
    length: value.length,
    sizeBytes: Buffer.byteLength(value, 'utf8')
  }
  if (value.length > 0) {
    digest.sha256 = crypto.createHash('sha256').update(value).digest('hex')
  }
  return digest
}

function buildUsageMessageSummary(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null
  }

  const summary = {}
  if (message.role) {
    summary.role = String(message.role).trim()
  }
  if (typeof message.content === 'string') {
    summary.content = buildAiUsageTextDigest(message.content)
  }
  if (typeof message.reasoning_content === 'string') {
    summary.reasoningContent = buildAiUsageTextDigest(message.reasoning_content)
  }
  if (Array.isArray(message.tool_calls)) {
    summary.toolCallCount = message.tool_calls.length
  }
  return summary
}

function buildUsageChoiceSummary(choice) {
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
    return null
  }

  const summary = {}
  const index = Number(choice.index)
  if (Number.isFinite(index)) {
    summary.index = index
  }
  if (choice.finish_reason) {
    summary.finishReason = String(choice.finish_reason).trim()
  }
  const messageSummary = buildUsageMessageSummary(choice.message)
  if (messageSummary) {
    summary.message = messageSummary
  }
  return summary
}

function buildChunkUsageSummary(responseData, chunkIndex) {
  const data = responseData || {}
  const summary = {
    index: chunkIndex,
    object: data.object || '',
    id: data.id || '',
    model: data.model || '',
    usage: data.usage || {}
  }
  if (Array.isArray(data.choices)) {
    summary.choiceCount = data.choices.length
    summary.choices = data.choices
      .slice(0, 8)
      .map(buildUsageChoiceSummary)
      .filter(Boolean)
  }
  return summary
}

function buildAggregateUsageResponseData({
  chunkResponses,
  usage,
  model,
  requestId,
  error
}) {
  const responseData = {
    object: 'chat.completion.stream.batch',
    id: requestId || '',
    model: model || '',
    usage: usage || {},
    chunkCount: chunkResponses.length,
    chunks: chunkResponses.map((item, index) => {
      return buildChunkUsageSummary(item.data, index)
    })
  }
  if (error) {
    responseData.error = {
      message: error.message || 'AI 翻译失败',
      code: error.code || ERROR_CODES.AI_TRANSLATION_FAILED
    }
  }
  return responseData
}

async function recordTranslationUsage({
  post,
  input,
  responseResult,
  status,
  httpStatusCode,
  stream,
  chunkCount,
  parseError
}) {
  if (input.skipUsageLog === true) {
    return
  }

  await aiUsageService.recordAiUsageLog({
    provider: getProviderCodeBySettings({ provider: input.aiProvider }),
    model: responseResult.model || '',
    operation: input.operation || 'translation.post',
    status,
    requestId: responseResult.requestId || '',
    postId: post?._id,
    translationGroupId: post?.translationGroupId,
    sourceSnapshotId: post?.sourceSnapshotId || input.sourceSnapshotId,
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    usage: responseResult.usage || {},
    rawResponse: responseResult.rawResponse,
    meta: {
      jobId: input.translationJobId || input.cacheKey || '',
      httpStatusCode,
      stream: Boolean(stream),
      parseError: Boolean(parseError),
      entryCount: input.entries.length,
      chunkCount: chunkCount || 1
    }
  })
}

async function translatePostEntries(body = {}) {
  const input = parseInput(body)
  const post = await getTranslationPost(input)
  if (post.sourceId && mongoose.Types.ObjectId.isValid(String(post.sourceId))) {
    input.properNounScopeKey = `sourcePostImport:${String(post.sourceId)}`
  }
  const settings = await aiSettingsService.getMainTranslationRuntimeSettings()
  const officialTermGlossaryTaskCache = getOfficialTermGlossaryTaskCache(input)
  let aiInput = prepareAiInput(input)
  aiInput = await prepareOfficialTermGlossaryForAiInput({
    input: aiInput,
    handlers: {},
    taskCache: officialTermGlossaryTaskCache
  })
  aiInput.aiProvider = getProviderCodeBySettings(settings)
  const requestConfig = buildTranslationRequestConfig(settings, aiInput, false)
  const translationStepResult = await runAiStepWithRetry(
    async () => {
      const responseResult = await requestProviderJson(
        settings,
        requestConfig.requestBody,
        requestConfig.requestUrl
      )
      const isSuccessStatus =
        responseResult.statusCode >= 200 && responseResult.statusCode < 300
      let usageStatus = 'error'
      if (isSuccessStatus && !responseResult.parseError) {
        usageStatus = 'success'
      }
      await recordTranslationUsage({
        post,
        input: {
          ...input,
          aiProvider: aiInput.aiProvider
        },
        responseResult,
        status: usageStatus,
        httpStatusCode: responseResult.statusCode,
        parseError: Boolean(responseResult.parseError)
      })

      if (responseResult.parseError) {
        throw createProviderApiError(
          settings,
          `${getProviderLabelBySettings(settings)} 返回内容不是 JSON`
        )
      }

      if (!isSuccessStatus) {
        const message =
          responseResult.rawResponse?.error?.message ||
          responseResult.rawResponse?.message ||
          `${getProviderLabelBySettings(settings)} 请求失败：${responseResult.statusCode}`
        throw createProviderApiError(settings, message)
      }

      const resultData = parseAiContentText(
        responseResult.contentText,
        settings,
        responseResult.finishReason
      )
      return {
        responseResult,
        resultData
      }
    },
    {
      stepKey: 'translation.post',
      stepLabel: '整篇翻译',
      field: getProviderFieldBySettings(settings),
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode
    }
  )
  const responseResult = translationStepResult.responseResult
  const resultData = translationStepResult.resultData
  const payload = buildTranslatedPayload(aiInput, post, resultData)
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    aiInput.aiJsonLogs,
    [
      translationAiJsonLogService.createAiJsonLog({
        operation: 'translation.post',
        stage: 'PostTranslation',
        provider: aiInput.aiProvider,
        model: getResponseModel(responseResult, settings),
        requestId: responseResult.requestId || '',
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: input.targetLanguageCode,
        meta: {
          stream: false,
          entryCount: input.entries.length
        },
        input: {
          requestBody: requestConfig.requestBody
        },
        json: resultData
      })
    ]
  )

  return {
    payload,
    model: getResponseModel(responseResult, settings),
    usage: responseResult.usage || null,
    requestId: responseResult.requestId || null,
    aiJsonLogs
  }
}

async function translateStreamChunkWithRetry({
  input,
  settings,
  url,
  chunkInput,
  chunkIndex,
  chunkTotal,
  handlers,
  state
}) {
  const cacheOptions = getTranslationChunkCacheOptions({
    input,
    chunkInput,
    chunkIndex
  })
  if (cacheOptions && typeof handlers.readAiChunkCache === 'function') {
    const cachedChunk = await handlers.readAiChunkCache(cacheOptions)
    if (cachedChunk) {
      buildTranslatedEntries(chunkInput, cachedChunk.resultData)
      const cachedResponse = buildTranslationChunkCacheResponse(
        cachedChunk.response
      )
      appendTranslationChunkState({
        state,
        response: cachedResponse,
        resultData: cachedChunk.resultData,
        aiJsonLog: cachedChunk.aiJsonLog,
        cached: true
      })
      if (handlers.onStatus) {
        handlers.onStatus({
          message: `已读取第 ${chunkIndex + 1}/${chunkTotal} 批翻译缓存`
        })
      }
      return cachedChunk.resultData
    }
  }

  return await runAiStepWithRetry(
    async ({ attemptNo }) => {
      const attemptStreamState = {
        contentLength: 0,
        reasoningLength: 0
      }
      const requestConfig = buildTranslationRequestConfig(
        settings,
        chunkInput,
        true
      )
      try {
        const responseResult = await requestProviderStream(
          settings,
          requestConfig.requestBody,
          requestConfig.requestUrl,
          {
            onStatus: handlers.onStatus,
            onChunk(chunk) {
              if (chunk.contentDelta) {
                attemptStreamState.contentLength += chunk.contentDelta.length
              }
              if (chunk.reasoningDelta) {
                attemptStreamState.reasoningLength +=
                  chunk.reasoningDelta.length
              }
              if (typeof handlers.onChunk === 'function') {
                handlers.onChunk({
                  ...chunk,
                  chunkIndex: chunkIndex + 1,
                  chunkCount: chunkTotal,
                  attemptNo
                })
              }
            }
          },
          handlers
        )
        const isSuccessStatus =
          responseResult.statusCode >= 200 && responseResult.statusCode < 300
        if (!isSuccessStatus) {
          const message =
            responseResult.rawResponse?.error?.message ||
            responseResult.rawResponse?.message ||
            `${getProviderLabelBySettings(settings)} 请求失败：${responseResult.statusCode}`
          throw createProviderApiError(settings, message)
        }

        const resultData = parseAiContentText(
          responseResult.contentText,
          settings,
          responseResult.finishReason
        )
        buildTranslatedEntries(chunkInput, resultData)
        const aiJsonLog = buildTranslationChunkAiJsonLog({
          input,
          responseResult,
          responseModel: state.responseModel,
          requestBody: requestConfig.requestBody,
          resultData,
          chunkInput,
          chunkIndex,
          chunkTotal,
          attemptNo
        })
        if (cacheOptions && typeof handlers.writeAiChunkCache === 'function') {
          await handlers.writeAiChunkCache({
            ...cacheOptions,
            response: buildTranslationChunkCacheResponse({
              statusCode: responseResult.statusCode,
              data: {
                id: responseResult.requestId,
                model: responseResult.model,
                usage: responseResult.usage,
                choices: [
                  {
                    finish_reason: responseResult.finishReason || null,
                    message: {
                      content: responseResult.contentText,
                      reasoning_content: responseResult.reasoningText
                    }
                  }
                ]
              }
            }),
            resultData,
            aiJsonLog
          })
        }
        appendTranslationChunkState({
          state,
          response: {
            statusCode: responseResult.statusCode,
            data: {
              id: responseResult.requestId,
              model: responseResult.model,
              usage: responseResult.usage,
              choices: [
                {
                  finish_reason: responseResult.finishReason || null,
                  message: {
                    content: responseResult.contentText,
                    reasoning_content: responseResult.reasoningText
                  }
                }
              ]
            }
          },
          resultData,
          aiJsonLog
        })
        return resultData
      } catch (error) {
        if (
          typeof handlers.onChunkRollback === 'function' &&
          (attemptStreamState.contentLength > 0 ||
            attemptStreamState.reasoningLength > 0)
        ) {
          handlers.onChunkRollback({
            contentLength: attemptStreamState.contentLength,
            reasoningLength: attemptStreamState.reasoningLength,
            chunkIndex: chunkIndex + 1,
            chunkCount: chunkTotal,
            attemptNo,
            errorMessage: error?.message || ''
          })
        }
        throw error
      }
    },
    {
      stepKey:
        input.verificationMode === true
          ? `validation.chunk.${chunkIndex + 1}`
          : `translation.chunk.${chunkIndex + 1}`,
      stepLabel:
        input.verificationMode === true
          ? `校验第 ${chunkIndex + 1}/${chunkTotal} 批`
          : `翻译第 ${chunkIndex + 1}/${chunkTotal} 批`,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode,
      field: getProviderFieldBySettings(settings),
      onStatus: handlers?.onStatus,
      cancellation: handlers?.cancellation
    }
  )
}

function applyWorkflowOverrides(input, options = {}) {
  if (!input || !options) {
    return input
  }
  if (options.runtimeSettings && typeof options.runtimeSettings === 'object') {
    input.runtimeSettings = options.runtimeSettings
  }
  if (options.verificationMode === true) {
    input.verificationMode = true
  }
  if (typeof options.operation === 'string' && options.operation.trim()) {
    input.operation = options.operation.trim()
  }
  return input
}

async function translatePreparedEntriesStream(input, post, handlers = {}) {
  const settings =
    input.runtimeSettings ||
    (await aiSettingsService.getMainTranslationRuntimeSettings())
  const officialTermGlossaryTaskCache = getOfficialTermGlossaryTaskCache(input)
  const splitOptions = {
    maxRequestTextLength: getTranslationChunkTextLimit(settings),
    richTextSegmentTextLength: getRichTextSegmentTextLimit(settings)
  }
  let aiInput = prepareAiInput(input, splitOptions)
  aiInput = await prepareOfficialTermGlossaryForAiInput({
    input: aiInput,
    handlers,
    taskCache: officialTermGlossaryTaskCache
  })
  aiInput.aiProvider = getProviderCodeBySettings(settings)
  input.aiProvider = aiInput.aiProvider
  const inputChunks = splitAiInput(aiInput, splitOptions)
  const chunkTotal = inputChunks.length
  const chunkResponses = []
  const aiJsonLogs = translationAiJsonLogService.mergeAiJsonLogs(
    aiInput.aiJsonLogs
  )
  const resultMap = new Map()
  const state = {
    chunkResponses,
    aiJsonLogs,
    resultMap,
    combinedUsage: {},
    responseModel: getConfiguredModelBySettings(settings),
    responseId: ''
  }

  if (handlers.onStatus) {
    handlers.onStatus({
      message: `正在准备 ${chunkTotal} 个翻译批次`
    })
  }

  try {
    for (let index = 0; index < inputChunks.length; index += 1) {
      throwIfCancellationRequested(handlers)
      const chunkInput = inputChunks[index]
      if (handlers.onStatus) {
        handlers.onStatus({
          message: `正在翻译第 ${index + 1}/${chunkTotal} 批`
        })
      }

      await translateStreamChunkWithRetry({
        input,
        settings,
        chunkInput,
        chunkIndex: index,
        chunkTotal,
        handlers,
        state
      })

      if (handlers.onStatus) {
        handlers.onStatus({
          message: `已完成第 ${index + 1}/${chunkTotal} 批`
        })
      }

      throwIfCancellationRequested(handlers)
    }

    const responseData = buildAggregateUsageResponseData({
      chunkResponses,
      usage: state.combinedUsage,
      model: state.responseModel,
      requestId: state.responseId
    })
    await recordTranslationUsage({
      post,
      input: {
        ...input,
        aiProvider: aiInput.aiProvider
      },
      responseResult: {
        model: state.responseModel,
        requestId: state.responseId,
        usage: state.combinedUsage,
        rawResponse: responseData
      },
      status: 'success',
      httpStatusCode: 200,
      stream: true,
      chunkCount: inputChunks.length
    })

    const payload = buildTranslatedPayload(aiInput, post, {
      entries: Array.from(resultMap.values())
    })
    const data = {
      payload,
      model: state.responseModel,
      usage: state.combinedUsage,
      requestId: state.responseId || null,
      aiJsonLogs,
      coverImagePreviewEntries: [],
      coverImageArtifacts: [],
      coverImageWarnings: []
    }
    return data
  } catch (error) {
    const isCancelled = error?.code === ERROR_CODES.AI_TRANSLATION_CANCELLED
    let usageStatus = 'error'
    let usageHttpStatusCode = error?.statusCode || 502
    if (isCancelled) {
      usageStatus = 'cancelled'
      usageHttpStatusCode = 499
    }
    const responseData = buildAggregateUsageResponseData({
      chunkResponses,
      usage: state.combinedUsage,
      model: state.responseModel,
      requestId: state.responseId,
      error
    })
    await recordTranslationUsage({
      post,
      input: {
        ...input,
        aiProvider: aiInput.aiProvider
      },
      responseResult: {
        model: state.responseModel,
        requestId: state.responseId,
        usage: state.combinedUsage,
        rawResponse: responseData
      },
      status: usageStatus,
      httpStatusCode: usageHttpStatusCode,
      stream: true,
      chunkCount: inputChunks.length
    })
    throw error
  }
}

async function translatePostEntriesStream(
  body = {},
  handlers = {},
  options = {}
) {
  const input = parseInput(body)
  applyWorkflowOverrides(input, options)
  const post = await getTranslationPost(input)
  if (post.sourceId && mongoose.Types.ObjectId.isValid(String(post.sourceId))) {
    input.properNounScopeKey = `sourcePostImport:${String(post.sourceId)}`
  }
  const requestContext = createBrowserRequestContext()
  let data = null

  if (input.entries.length > 0) {
    data = await translatePreparedEntriesStream(input, post, handlers)
    if (!data.requestId) {
      data.requestId = requestContext.id
    }
  } else {
    if (handlers.onStatus) {
      handlers.onStatus({ message: '未选择正文条目，跳过正文直译阶段' })
    }
    data = createEmptyTranslatedResult(input, post, requestContext.id)
  }

  if (input.translateCoverImage === true) {
    if (handlers.onStatus) {
      handlers.onStatus({ message: '正在处理封面图 AI 翻译' })
    }
    const sourcePost = await getSourcePostForTranslationPost(post)
    if (!sourcePost) {
      data.coverImageWarnings = ['源文章快照不存在，不能处理封面图翻译']
    } else {
      const registry = coverImageTranslationService.createCoverImageRegistry()
      let previewEntries = []
      if (Array.isArray(data.payload?.entries)) {
        previewEntries = data.payload.entries
      }
      const coverResult =
        await coverImageTranslationService.processCoverImageTranslation({
          job: requestContext,
          registry,
          sourcePost,
          targetPost: post,
          previewEntries,
          targetTitle: input.targetTitle,
          sourceLanguageCode: input.sourceLanguageCode,
          targetLanguageCode: input.targetLanguageCode,
          skipRecognition: true,
          onStatus: handlers.onStatus,
          cancellation: handlers.cancellation
        })
      data = appendCoverImageResultToStreamData(
        data,
        coverResult,
        registry,
        input
      )
    }
  }

  if (handlers.onResult) {
    handlers.onResult(data)
  }
  return data
}

async function translateContentEntriesStream(
  body = {},
  handlers = {},
  options = {}
) {
  const input = {
    ...parseGenericInput(body),
    operation: 'translation.content'
  }
  applyWorkflowOverrides(input, options)
  const data = await translatePreparedEntriesStream(input, null, handlers)
  if (handlers.onResult) {
    handlers.onResult(data)
  }
  return data
}

async function organizeProperNounTerms(body = {}, handlers = {}) {
  const input = parseProperNounOrganizeInput(body)
  const settings =
    await aiSettingsService.getProperNounPreprocessRuntimeSettings()
  if (handlers.onStatus) {
    handlers.onStatus({ message: '正在整理文章专有名词' })
  }
  const glossaryData = await resolveOfficialTermGlossaryCacheData({
    input,
    settings,
    handlers,
    targetLanguageCodes: input.targetLanguageCodes,
    allowSameSourceTranslationWithNote: true
  })
  return {
    sourceId: input.sourceId,
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCodes: input.targetLanguageCodes,
    searchOfficialTermTranslations: input.searchOfficialTermTranslations,
    ...glossaryData
  }
}

module.exports = {
  organizeProperNounTerms,
  translatePostEntries,
  translatePostEntriesStream,
  translateContentEntriesStream,
  parseAiContentText
}
