const {
  getLanguageText,
  normalizeLanguageCode
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const aiSettingsService = require('./aiSettingsService')
const aiUsageService = require('./aiUsageService')
const properNounTranslationService = require('./properNounTranslationService')
const {
  applyGeminiThinkingConfig,
  buildGeminiNativeGenerateContentUrl,
  buildTextPart,
  extractTextFromGeminiNativeResponse,
  sendGeminiNativeGenerateContentRequest,
  summarizeGeminiNativeRequestBody,
  summarizeGeminiNativeResponse
} = require('./geminiNativeApiService')
const { recordGeminiUsageLog } = require('./geminiUsageLogService')
const { runAiStepWithRetry } = require('./aiStepRetryService')
const translationPromptPolicyService = require('./translationPromptPolicyService')
const translationAiJsonLogService = require('./translationAiJsonLogService')
const {
  buildJsonRequestBody,
  getProviderErrorField,
  getProviderLabel,
  requestProviderJson
} = require('./textAiProviderRequestService')

const OPERATION_OFFICIAL_TERM_KNOWLEDGE =
  'proper-noun.official-translation.knowledge'
const OPERATION_OFFICIAL_TERM_SEARCH = 'proper-noun.official-translation.search'
const TERM_TRANSLATION_SOURCE_AI_KNOWLEDGE = 'aiKnowledgeBase'
const TERM_TRANSLATION_SOURCE_INTERNET_SEARCH = 'internetSearchAi'
const MAX_TERM_CONTEXT_SUMMARY_LENGTH = 800
const OFFICIAL_TERM_SEARCH_REPAIR_MAX_ROUNDS = 1
const OFFICIAL_TERM_SEARCH_REPAIR_BATCH_TERM_COUNT = 100
const OFFICIAL_TERM_KNOWLEDGE_CONFIDENCE_THRESHOLD = 80

const officialTermKnowledgeResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['terms'],
  properties: {
    terms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sourceText',
          'translations',
          'translationConfidenceScores',
          'needsSearchLanguageCodes'
        ],
        properties: {
          sourceText: { type: 'string' },
          translations: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          translationConfidenceScores: {
            type: 'object',
            additionalProperties: {
              type: 'number',
              minimum: 0,
              maximum: 100
            }
          },
          translationNotes: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          needsSearchLanguageCodes: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
}

const officialTermSearchResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['terms'],
  properties: {
    terms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceText', 'translations', 'noteNeedsUpdate', 'note'],
        properties: {
          sourceText: { type: 'string' },
          translations: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          translationNotes: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          noteNeedsUpdate: { type: 'boolean' },
          note: { type: 'string' }
        }
      }
    }
  }
}

const officialTermSearchTranslationOnlyResponseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['terms'],
  properties: {
    terms: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceText', 'translations'],
        properties: {
          sourceText: { type: 'string' },
          translations: {
            type: 'object',
            additionalProperties: { type: 'string' }
          },
          translationNotes: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        }
      }
    }
  }
}

function requireTranslationNotesInTermSchema(schema) {
  let requiredFields = schema.properties.terms.items.required
  if (!requiredFields.includes('translationNotes')) {
    requiredFields = requiredFields.concat('translationNotes')
  }

  return {
    ...schema,
    properties: {
      ...schema.properties,
      terms: {
        ...schema.properties.terms,
        items: {
          ...schema.properties.terms.items,
          required: requiredFields
        }
      }
    }
  }
}

function buildOfficialTermKnowledgeResponseJsonSchema(options = {}) {
  if (options.allowSameSourceTranslationWithNote !== true) {
    return officialTermKnowledgeResponseJsonSchema
  }
  return requireTranslationNotesInTermSchema(
    officialTermKnowledgeResponseJsonSchema
  )
}

function buildOfficialTermSearchResponseJsonSchema(options = {}) {
  let responseJsonSchema = officialTermSearchResponseJsonSchema
  if (options.includeTermNoteRevision === false) {
    responseJsonSchema = officialTermSearchTranslationOnlyResponseJsonSchema
  }
  if (options.allowSameSourceTranslationWithNote !== true) {
    return responseJsonSchema
  }
  return requireTranslationNotesInTermSchema(responseJsonSchema)
}

function normalizeString(value, maxLength = 600) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
}

function normalizeOfficialTermContextSummary(value) {
  return normalizeString(value, MAX_TERM_CONTEXT_SUMMARY_LENGTH).replace(
    /\s+/g,
    ' '
  )
}

function normalizeSourceTerms(sourceTerms) {
  if (!Array.isArray(sourceTerms)) {
    return []
  }
  const termMap = new Map()
  sourceTerms.forEach(value => {
    const sourceText = properNounTranslationService.normalizeSourceText(value)
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(sourceText)
    if (!sourceText || termMap.has(normalizedSourceText)) {
      return
    }
    termMap.set(normalizedSourceText, sourceText)
  })
  return Array.from(termMap.values())
}

function normalizeTargetLanguageCodes(targetLanguageCodes) {
  const normalizedList = []
  if (Array.isArray(targetLanguageCodes)) {
    targetLanguageCodes.forEach(value => {
      const languageCode = normalizeLanguageCode(normalizeString(value, 20))
      if (languageCode && !normalizedList.includes(languageCode)) {
        normalizedList.push(languageCode)
      }
    })
  }
  return normalizedList
}

function normalizeOptionalTermSourceLanguageCode(value) {
  const languageCode = normalizeLanguageCode(normalizeString(value, 20))
  if (!languageCode) {
    return ''
  }
  return languageCode
}

function buildTargetLanguagePromptRows(targetLanguageCodes) {
  return targetLanguageCodes.map(languageCode => {
    return {
      code: languageCode,
      label: getLanguageText(languageCode)
    }
  })
}

function normalizeTermRequestList(termRequests) {
  if (!Array.isArray(termRequests)) {
    return []
  }
  const termRequestMap = new Map()
  termRequests.forEach(item => {
    const sourceText = properNounTranslationService.normalizeSourceText(
      item?.sourceText
    )
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(sourceText)
    if (!sourceText || !normalizedSourceText) {
      return
    }
    const targetLanguageCodes = normalizeTargetLanguageCodes(
      item?.targetLanguageCodes
    )
    if (targetLanguageCodes.length === 0) {
      return
    }
    const sourceLanguageCode = normalizeOptionalTermSourceLanguageCode(
      item?.sourceLanguageCode
    )
    let termRequest = termRequestMap.get(normalizedSourceText)
    if (!termRequest) {
      termRequest = {
        sourceText,
        normalizedSourceText,
        sourceLanguageCode,
        targetLanguageCodes: [],
        termId: normalizeString(item?.termId, 80),
        note: normalizeString(item?.note, 200)
      }
      termRequestMap.set(normalizedSourceText, termRequest)
    } else {
      if (!termRequest.termId) {
        termRequest.termId = normalizeString(item?.termId, 80)
      }
      if (!termRequest.note) {
        termRequest.note = normalizeString(item?.note, 200)
      }
      if (!termRequest.sourceLanguageCode && sourceLanguageCode) {
        termRequest.sourceLanguageCode = sourceLanguageCode
      }
    }
    targetLanguageCodes.forEach(languageCode => {
      if (!termRequest.targetLanguageCodes.includes(languageCode)) {
        termRequest.targetLanguageCodes.push(languageCode)
      }
    })
  })
  return Array.from(termRequestMap.values())
}

function buildTermRequests(sourceTerms, targetLanguageCodes) {
  return normalizeTermRequestList(
    sourceTerms.map(sourceText => {
      return {
        sourceText,
        targetLanguageCodes
      }
    })
  )
}

function getTermRequestTargetLanguageCodes(termRequests) {
  const languageCodes = []
  termRequests.forEach(termRequest => {
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (!languageCodes.includes(languageCode)) {
        languageCodes.push(languageCode)
      }
    })
  })
  return languageCodes
}

function countTermTranslationLanguagePairs(terms) {
  let count = 0
  terms.forEach(term => {
    if (!term?.translations || typeof term.translations !== 'object') {
      return
    }
    count += Object.keys(term.translations).length
  })
  return count
}

function normalizeResultTranslationNotes(termItem, targetLanguageCodes) {
  const translationNotes = {}
  const sourceTranslationNotes = termItem?.translationNotes
  if (
    sourceTranslationNotes &&
    typeof sourceTranslationNotes === 'object' &&
    !Array.isArray(sourceTranslationNotes)
  ) {
    targetLanguageCodes.forEach(languageCode => {
      const note = normalizeString(sourceTranslationNotes[languageCode], 2000)
      if (note) {
        translationNotes[languageCode] = note
      }
    })
  }

  const sharedTranslationNote = normalizeString(termItem?.translationNote, 2000)
  if (sharedTranslationNote) {
    targetLanguageCodes.forEach(languageCode => {
      if (!translationNotes[languageCode]) {
        translationNotes[languageCode] = sharedTranslationNote
      }
    })
  }

  return translationNotes
}

function normalizeResultTranslationConfidenceScores(
  termItem,
  targetLanguageCodes
) {
  const confidenceScores = {}
  const sourceConfidenceScores = termItem?.translationConfidenceScores
  if (
    !sourceConfidenceScores ||
    typeof sourceConfidenceScores !== 'object' ||
    Array.isArray(sourceConfidenceScores)
  ) {
    return confidenceScores
  }
  targetLanguageCodes.forEach(languageCode => {
    const confidenceScore = Number(sourceConfidenceScores[languageCode])
    if (
      Number.isFinite(confidenceScore) &&
      confidenceScore >= 0 &&
      confidenceScore <= 100
    ) {
      confidenceScores[languageCode] = confidenceScore
    }
  })
  return confidenceScores
}

function shouldSkipSameSourceTranslation({
  sourceText,
  translatedText,
  note,
  allowSameSourceTranslationWithNote
}) {
  if (
    !properNounTranslationService.isSameSourceAndTranslatedText(
      sourceText,
      translatedText
    )
  ) {
    return false
  }
  if (allowSameSourceTranslationWithNote !== true) {
    return true
  }
  return !normalizeString(note, 2000)
}

function buildTermRequestPromptRows(termRequests) {
  return termRequests.map(termRequest => {
    const row = {
      sourceText: termRequest.sourceText,
      targetLanguages: buildTargetLanguagePromptRows(
        termRequest.targetLanguageCodes
      )
    }
    const sourceLanguageCode = normalizeOptionalTermSourceLanguageCode(
      termRequest.sourceLanguageCode
    )
    if (sourceLanguageCode) {
      row.sourceLanguage = {
        code: sourceLanguageCode,
        label: getLanguageText(sourceLanguageCode)
      }
    }
    const note = normalizeString(termRequest.note, 200)
    if (note) {
      row.note = note
    }
    return row
  })
}

function hasTermRequestNote(termRequests) {
  return termRequests.some(termRequest => {
    return Boolean(normalizeString(termRequest.note, 200))
  })
}

function attachTermNoteInstruction(requestData, termRequests) {
  if (!hasTermRequestNote(termRequests)) {
    return
  }
  requestData['名词备注使用要求'] =
    'sourceTermRequests[].note 是名词抽取 AI 为对应 sourceText 生成的实体识别上下文。整理或检索官方译名时，必须先用 note 确认名词指向。'
}

function attachSearchTermNoteRevisionInstruction(requestData, termRequests) {
  if (!hasTermRequestNote(termRequests)) {
    return
  }
  requestData['联网检索后的备注修订要求'] =
    '使用可用联网检索工具确认对象身份后，需要判断 sourceTermRequests[].note 是否存在实体误判、过宽、过窄、依赖正文临时语境或包含译名的问题。需要修订时返回 noteNeedsUpdate=true，并在 note 写入新的中文词库消歧备注；不需要修订时返回 noteNeedsUpdate=false，并在 note 保持原备注。'
}

function attachSearchQueryPolicy(requestData) {
  requestData['联网检索次数与关键词要求'] =
    '每个 sourceText 的每种目标语言应尽可能只使用 1 次联网检索，最多不得超过 2 次。第一次查询必须同时包含 sourceText、稳定身份线索和目标语言译名意图；查询语言必须优先贴近目标语言的当地写法和当地内容生态，不要只用源文语言关键词检索目标语言结果。只有首轮结果互相矛盾或无法确认对象身份时，才允许第二次查询。禁止用过宽的普通词、截断后的短词或只包含系列母题的关键词反复检索。'
}

function attachSkipNoteRevisionInstruction(
  requestData,
  allowSameSourceTranslationWithNote = false
) {
  if (allowSameSourceTranslationWithNote === true) {
    requestData['备注处理要求'] =
      'sourceTermRequests[].note 只用于识别对象和避免检索串词；本步骤不生成或修订词条备注。只有译名与原名文本完全一致时，必须在 translationNotes[languageCode] 返回译名备注。'
    return
  }
  requestData['备注处理要求'] =
    'sourceTermRequests[].note 只用于识别对象和避免检索串词；本步骤不生成、修订或返回任何备注字段。'
}

function attachTermTranslationQualityPolicy(requestData) {
  requestData['翻译质量约束'] =
    translationPromptPolicyService.getTermTranslationQualityPolicyText()
}

function buildWorkflowPromptLines(
  settings,
  targetLanguageCodes,
  defaultFieldName,
  languageFieldName
) {
  const promptLines = []
  const defaultPrompt = normalizeString(settings?.[defaultFieldName], 12000)
  if (defaultPrompt) {
    promptLines.push('以下是管理员为当前流程配置的默认提示词。', defaultPrompt)
  }

  const languagePromptMap =
    settings?.[languageFieldName] &&
    typeof settings[languageFieldName] === 'object' &&
    !Array.isArray(settings[languageFieldName])
      ? settings[languageFieldName]
      : {}
  normalizeTargetLanguageCodes(targetLanguageCodes).forEach(languageCode => {
    const targetLanguagePrompt = normalizeString(
      languagePromptMap[languageCode],
      12000
    )
    if (!targetLanguagePrompt) {
      return
    }
    promptLines.push(
      `以下是目标语言 ${getLanguageText(languageCode)}（${languageCode}）的流程补充提示词。`,
      targetLanguagePrompt
    )
  })

  return promptLines
}

function buildOfficialTermKnowledgePrompt({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  allowSameSourceTranslationWithNote = false
}) {
  const normalizedContextSummary =
    normalizeOfficialTermContextSummary(contextSummary)
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const requestData = {
    task: 'resolve_official_term_translations_from_model_knowledge',
    sourceLanguageCode: sourceLanguageCode || '',
    sourceTermRequests: buildTermRequestPromptRows(termRequests)
  }
  attachTermTranslationQualityPolicy(requestData)
  attachTermNoteInstruction(requestData, termRequests)
  if (normalizedContextSummary) {
    requestData.contentContextSummary = normalizedContextSummary
  }

  const promptLines = [
    '你是多语言博客 CMS 的专有名词译名整理助手。',
    '本步骤禁止联网检索，也没有任何搜索工具可用；只能使用你模型内置的可靠知识。',
    ...translationPromptPolicyService.getGeminiTermKnowledgePromptLines(),
    '如果 sourceTermRequests[].sourceLanguage 存在，它表示 sourceText 表面形式所属原文语言；确认实体和官方译名时必须参考它。',
    'sourceTermRequests 旁可能包含 contentContextSummary；确认译名时必须优先按它和 note 识别对象身份，短人名、昵称、单字名或同形异义词不能只按字面普通词处理。',
    '必须优先让 needsSearchLanguageCodes 覆盖所有不确定语言，不要为了完整率补 translations。',
    '如果目标语言确实没有固定译名，但这一结论仍需要查证，也应放入 needsSearchLanguageCodes，由联网检索阶段确认后再直译或音译。',
    'translationConfidenceScores 是每种目标语言译名可信度字段，取值范围为 0 到 100；每个 sourceText 的每个目标语言 code 都必须单独返回对应数值。',
    '必须返回每一个输入 sourceText；translations 只包含你完美确认的语言。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。'
  ]

  if (allowSameSourceTranslationWithNote === true) {
    promptLines.push(
      '特别重要：如果 translations 中某个目标语言的译名与 sourceText 文本完全一致，必须同时在 translationNotes[languageCode] 写中文译名备注，明确说明为什么该目标语言应保留原名。',
      '再次强调：译名和原名完全一致但没有 translationNotes[languageCode]，后台会把该语言视为未翻译；如果不能确定保留原名是否正确，必须放入 needsSearchLanguageCodes。',
      'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"translationConfidenceScores":{"zh-CN":96,"zh-HK":42},"translationNotes":{"zh-CN":"译名与原名一致时的原因"},"needsSearchLanguageCodes":["zh-HK"]}]}。'
    )
  } else {
    promptLines.push(
      '本步骤属于正文 AI 翻译前的自动名词整理，禁止把与 sourceText 完全一致的文本写入 translations；遇到必须保留原名或目标语言没有固定译名的情况，必须放入 needsSearchLanguageCodes，不要写 translationNotes。',
      'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"translationConfidenceScores":{"zh-CN":96,"zh-HK":42},"needsSearchLanguageCodes":["zh-HK"]}]}。'
    )
  }

  promptLines.push(
    ...buildWorkflowPromptLines(
      settings,
      targetLanguageCodes,
      'properNounKnowledgeDefaultPrompt',
      'properNounKnowledgeLanguagePrompts'
    )
  )

  promptLines.push('', JSON.stringify(requestData, null, 2))

  return promptLines.join('\n')
}

function buildOfficialTermSearchPrompt({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  includeTermNoteRevision = true,
  allowSameSourceTranslationWithNote = false,
  repairAttemptNo = 0
}) {
  const normalizedContextSummary =
    normalizeOfficialTermContextSummary(contextSummary)
  const isRepairRequest = Number(repairAttemptNo || 0) > 0
  let taskName = 'search_official_term_translations'
  if (isRepairRequest) {
    taskName = 'repair_missing_official_term_translations'
  }
  const requestData = {
    task: taskName,
    sourceLanguageCode: sourceLanguageCode || '',
    sourceTermRequests: buildTermRequestPromptRows(termRequests)
  }
  if (isRepairRequest) {
    requestData.repairAttemptNo = Number(repairAttemptNo || 0)
  }
  attachTermTranslationQualityPolicy(requestData)
  attachTermNoteInstruction(requestData, termRequests)
  if (includeTermNoteRevision) {
    attachSearchTermNoteRevisionInstruction(requestData, termRequests)
  } else {
    attachSkipNoteRevisionInstruction(
      requestData,
      allowSameSourceTranslationWithNote
    )
  }
  attachSearchQueryPolicy(requestData)
  if (normalizedContextSummary) {
    requestData.contentContextSummary = normalizedContextSummary
  }

  const promptLines = [
    '你是多语言博客 CMS 的互联网检索助手。',
    '本步骤只处理前一步无法通过模型内置知识可靠确认的缺失译名。',
    '只允许为 sourceTermRequests 中列出的 sourceText 和目标语言 code 使用可用联网检索工具，不要检索请求之外的语言或名词。',
    '每个 sourceText 的每种目标语言应尽可能只检索一次，最多不能超过两次；不要用大量低质量 query 试探。',
    '检索关键词必须高效：同时包含 sourceText、note 或 contentContextSummary 中的稳定身份线索，以及目标语言译名意图。',
    '为某个目标语言确认译名时，query 必须优先使用该目标语言的当地写法、当地语境词和当地站点常用表达；源文词只作为实体定位线索，不得成为唯一检索语言。',
    '如果 sourceTermRequests[].sourceLanguage 存在，它表示 sourceText 表面形式所属原文语言；检索和筛选结果时必须参考它。',
    '如果目标语言使用不同文字系统，必须积极使用目标语言文字系统组织 query；不要只用源文语言关键词搜索目标语言译名。',
    '禁止把 sourceText 截短成过宽关键词检索；不得用系列母题、父级作品名、通用类型词或部分核心词替代完整 sourceText。',
    '只有首轮结果互相矛盾或无法确认对象身份时，才允许第二次检索；第二次必须针对矛盾点改进关键词。',
    'sourceTermRequests 旁可能包含 contentContextSummary；检索和筛选结果时必须优先按该上下文判断名词指向的作品、角色、组织、地点或产品。',
    '短人名、昵称、单字名或同形异义词必须结合 contentContextSummary 检索，不要只按字面普通词或日常含义给译名。',
    '你需要为每个缺失项给出目标语言中的官方译名、正式译名、权威通行译名或稳定通用译名。',
    '优先采用官方网站、发行商、出版社、平台商、百科条目或权威媒体中已存在的正式译名。',
    '必须覆盖每一个输入 sourceText 下列出的每一个目标语言 code。'
  ]

  if (isRepairRequest) {
    promptLines.push(
      '这是缺失译名定向补齐请求，不是全量重做。',
      '上一轮已经通过校验的译名已经被后台保留；本轮只允许处理当前 sourceTermRequests 中列出的缺失 sourceText 和目标语言 code。',
      '禁止返回 sourceTermRequests 之外的 sourceText；禁止返回未请求的目标语言 code。',
      '如果上一轮遗漏是因为译名与原名完全一致，本轮必须补齐 translationNotes[languageCode]。'
    )
  }

  if (allowSameSourceTranslationWithNote === true) {
    promptLines.push(
      '如果检索结果能够证明目标语言没有官方译名、正式译名、权威通行译名或稳定通用译名，translations 中必须填写原文表面形式，不要给出非官方普通译名。',
      '如果检索后仍无法确定某个目标语言的译名，就不要为该语言写入 translations，保持该语言译名缺失。',
      '特别重要：只要某个 translations[languageCode] 与 sourceText 文本完全一致，就必须同时写 translationNotes[languageCode]，用中文说明检索证据为何支持保留原名。',
      '再次强调：译名和原名完全一致但没有 translationNotes[languageCode]，后台会跳过该语言译名，按没有翻译处理。'
    )
  } else {
    promptLines.push(
      '本步骤属于正文 AI 翻译前的自动名词整理，禁止把与 sourceText 完全一致的文本写入 translations。',
      '如果检索结果证明目标语言没有官方译名、正式译名、权威通行译名或稳定通用译名，或者证据不足以确认对象身份或译名状态，不要写入 translations；后台会按该语言未取得译名处理。',
      '禁止返回 translationNotes。'
    )
  }

  if (includeTermNoteRevision) {
    promptLines.push(
      '在确认译名的同时，必须根据联网检索结果判断 sourceTermRequests[].note 是否需要修订。',
      '如果 note 对实体身份、作品归属、角色定位、组织类型、产品类型或地理属性的描述有误，或者含有“文中提及”“本文”“正文”“本次内容”等上下文依赖表述，noteNeedsUpdate 必须为 true。',
      '修订后的 note 必须是中文词库消歧备注，只写可脱离本文单独成立的稳定身份线索；不要写翻译方法，不要写目标语言译名，不要写搜索过程。',
      '如果原 note 已准确可用，noteNeedsUpdate 必须为 false，note 返回原 note。',
      '只返回合法 JSON，不要使用 Markdown，不要解释。'
    )
    if (allowSameSourceTranslationWithNote === true) {
      promptLines.push(
        'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"translationNotes":{"zh-CN":"译名与原名一致时的原因"},"noteNeedsUpdate":true,"note":"修订后的中文词库消歧备注"}]}。'
      )
    } else {
      promptLines.push(
        'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"noteNeedsUpdate":true,"note":"修订后的中文词库消歧备注"}]}。'
      )
    }
  } else {
    if (allowSameSourceTranslationWithNote === true) {
      promptLines.push(
        'sourceTermRequests[].note 只用于判断名词指向，严禁在响应中返回 note、noteNeedsUpdate 或其它词条备注字段；只有译名与原名完全一致时，必须返回 translationNotes[languageCode] 作为译名备注。',
        '只返回合法 JSON，不要使用 Markdown，不要解释。',
        'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"translationNotes":{"zh-CN":"译名与原名一致时的原因"}}]}。'
      )
    } else {
      promptLines.push(
        'sourceTermRequests[].note 只用于判断名词指向，严禁在响应中返回 note、noteNeedsUpdate、translationNotes 或其它备注字段。',
        '只返回合法 JSON，不要使用 Markdown，不要解释。',
        'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"}}]}。'
      )
    }
  }

  promptLines.push(
    ...buildWorkflowPromptLines(
      settings,
      getTermRequestTargetLanguageCodes(termRequests),
      'internetSearchDefaultPrompt',
      'internetSearchLanguagePrompts'
    )
  )

  promptLines.push('', JSON.stringify(requestData, null, 2))

  return promptLines.join('\n')
}

function buildGeminiKnowledgeRequest(settings, prompt, options = {}) {
  const generationConfig = applyGeminiThinkingConfig(
    {
      responseMimeType: 'application/json',
      responseJsonSchema: buildOfficialTermKnowledgeResponseJsonSchema(options)
    },
    settings
  )

  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [buildTextPart(prompt)]
      }
    ],
    generationConfig
  }
}

function buildGeminiSearchRequest(settings, prompt, options = {}) {
  const responseJsonSchema = buildOfficialTermSearchResponseJsonSchema(options)
  const generationConfig = applyGeminiThinkingConfig(
    {
      responseMimeType: 'application/json',
      responseJsonSchema
    },
    settings
  )

  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [buildTextPart(prompt)]
      }
    ],
    tools: [{ google_search: {} }],
    generationConfig
  }
}

function buildKnowledgeMessages(prompt) {
  return [
    {
      role: 'user',
      content: prompt
    }
  ]
}

function buildProviderRequestSummary(settings, requestUrl) {
  return {
    provider: settings.provider,
    model: settings.model || settings.deepSeekModel || '',
    requestUrl: requestUrl ? String(requestUrl) : ''
  }
}

function buildProviderResponseSummary(responseResult = {}) {
  return {
    statusCode: responseResult.statusCode || 0,
    model: responseResult.model || '',
    requestId: responseResult.requestId || '',
    finishReason: responseResult.finishReason || ''
  }
}

function parseSearchResponseText(
  rawText,
  operationLabel = 'AI 联网搜索',
  errorField = 'geminiInternetSearch'
) {
  const text = normalizeString(rawText, 200000)
  if (!text) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}没有返回内容`,
      errorField,
      502
    )
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}返回的 JSON 解析失败`,
      errorField,
      502
    )
  }
}

function summarizeGroundingMetadata(response) {
  const groundingMetadata = response?.candidates?.[0]?.groundingMetadata
  if (!groundingMetadata || typeof groundingMetadata !== 'object') {
    return {}
  }
  const chunks = Array.isArray(groundingMetadata.groundingChunks)
    ? groundingMetadata.groundingChunks
    : []
  return {
    webSearchQueries: Array.isArray(groundingMetadata.webSearchQueries)
      ? groundingMetadata.webSearchQueries.slice(0, 20)
      : [],
    groundingChunks: chunks.slice(0, 20).map(chunk => {
      return {
        title: normalizeString(chunk?.web?.title, 200),
        uri: normalizeString(chunk?.web?.uri, 600)
      }
    })
  }
}

function normalizeResultRoot(
  resultData,
  operationLabel,
  errorField = 'geminiInternetSearch'
) {
  if (!resultData || typeof resultData !== 'object') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel} JSON 根节点必须是对象`,
      errorField,
      502
    )
  }
  if (!Array.isArray(resultData.terms)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}结果缺少 terms 数组`,
      errorField,
      502
    )
  }
}

function buildRequestedTermMap(termRequests) {
  const requestedTermMap = new Map()
  termRequests.forEach(termRequest => {
    requestedTermMap.set(termRequest.normalizedSourceText, termRequest)
  })
  return requestedTermMap
}

function normalizeKnowledgeTerms(resultData, termRequests, options = {}) {
  const operationLabel = options.operationLabel || 'AI 名词知识库整理'
  const errorField = options.errorField || 'geminiInternetSearch'
  normalizeResultRoot(resultData, operationLabel, errorField)
  const allowSameSourceTranslationWithNote =
    options.allowSameSourceTranslationWithNote === true

  const requestedTermMap = buildRequestedTermMap(termRequests)
  const resultTermMap = new Map()

  resultData.terms.forEach(termItem => {
    const sourceText = properNounTranslationService.normalizeSourceText(
      termItem?.sourceText
    )
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(sourceText)
    const termRequest = requestedTermMap.get(normalizedSourceText)
    if (!sourceText || !termRequest) {
      return
    }
    const needsSearchLanguageCodes = normalizeTargetLanguageCodes(
      termItem?.needsSearchLanguageCodes
    )
    const translations = {}
    const translationNotes = {}
    const resultTranslationNotes = normalizeResultTranslationNotes(
      termItem,
      termRequest.targetLanguageCodes
    )
    const translationConfidenceScores =
      normalizeResultTranslationConfidenceScores(
        termItem,
        termRequest.targetLanguageCodes
      )
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (needsSearchLanguageCodes.includes(languageCode)) {
        return
      }
      const translatedText = normalizeString(
        termItem?.translations?.[languageCode],
        300
      )
      if (translatedText) {
        const confidenceScore = translationConfidenceScores[languageCode]
        if (
          !Number.isFinite(confidenceScore) ||
          confidenceScore < OFFICIAL_TERM_KNOWLEDGE_CONFIDENCE_THRESHOLD
        ) {
          return
        }
        const translationNote = normalizeString(
          resultTranslationNotes[languageCode],
          2000
        )
        if (
          shouldSkipSameSourceTranslation({
            sourceText: termRequest.sourceText,
            translatedText,
            note: translationNote,
            allowSameSourceTranslationWithNote
          })
        ) {
          return
        }
        translations[languageCode] = translatedText
        if (allowSameSourceTranslationWithNote === true && translationNote) {
          translationNotes[languageCode] = translationNote
        }
      }
    })
    resultTermMap.set(normalizedSourceText, {
      sourceText: termRequest.sourceText,
      sourceLanguageCode: termRequest.sourceLanguageCode || '',
      termId: termRequest.termId || '',
      note: termRequest.note || '',
      translations,
      translationNotes,
      translationSource: TERM_TRANSLATION_SOURCE_AI_KNOWLEDGE
    })
  })

  const terms = []
  const missingTermRequests = []
  requestedTermMap.forEach((termRequest, normalizedSourceText) => {
    const resultTerm = resultTermMap.get(normalizedSourceText)
    const translations = resultTerm?.translations || {}
    const missingLanguageCodes = []
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (!translations[languageCode]) {
        missingLanguageCodes.push(languageCode)
      }
    })
    if (Object.keys(translations).length > 0) {
      terms.push(resultTerm)
    }
    if (missingLanguageCodes.length > 0) {
      missingTermRequests.push({
        sourceText: termRequest.sourceText,
        sourceLanguageCode: termRequest.sourceLanguageCode || '',
        termId: termRequest.termId || '',
        note: termRequest.note || '',
        targetLanguageCodes: missingLanguageCodes
      })
    }
  })

  return {
    terms,
    missingTermRequests: normalizeTermRequestList(missingTermRequests)
  }
}

function buildMissingTermParts(missingTermRequests) {
  const missingParts = []
  missingTermRequests.forEach(termRequest => {
    termRequest.targetLanguageCodes.forEach(languageCode => {
      missingParts.push(`${termRequest.sourceText}/${languageCode}`)
    })
  })
  return missingParts
}

function shouldTreatSearchTranslationAsMissing({
  resultTerm,
  languageCode,
  allowSameSourceTranslationWithNote
}) {
  if (resultTerm?.translations?.[languageCode]) {
    return false
  }

  let skippedLanguageCodes = []
  if (Array.isArray(resultTerm?.skippedSameWithoutNoteLanguageCodes)) {
    skippedLanguageCodes = resultTerm.skippedSameWithoutNoteLanguageCodes
  }
  if (!skippedLanguageCodes.includes(languageCode)) {
    return true
  }

  if (allowSameSourceTranslationWithNote === true) {
    return true
  }
  return false
}

function collectSearchMissingTermRequests(
  termRequests,
  resultTermMap,
  options = {}
) {
  const allowSameSourceTranslationWithNote =
    options.allowSameSourceTranslationWithNote === true
  const missingTermRequests = []
  termRequests.forEach(termRequest => {
    const resultTerm = resultTermMap.get(termRequest.normalizedSourceText)
    const missingLanguageCodes = []
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (!resultTerm) {
        missingLanguageCodes.push(languageCode)
        return
      }
      const shouldMissing = shouldTreatSearchTranslationAsMissing({
        resultTerm,
        languageCode,
        allowSameSourceTranslationWithNote
      })
      if (shouldMissing) {
        missingLanguageCodes.push(languageCode)
      }
    })
    if (missingLanguageCodes.length === 0) {
      return
    }
    missingTermRequests.push({
      sourceText: termRequest.sourceText,
      sourceLanguageCode: termRequest.sourceLanguageCode || '',
      termId: termRequest.termId || '',
      note: resultTerm?.note || termRequest.note || '',
      targetLanguageCodes: missingLanguageCodes
    })
  })
  return normalizeTermRequestList(missingTermRequests)
}

function throwMissingSearchTranslationsError(
  missingParts,
  operationLabel = 'AI 联网搜索',
  errorField = 'geminiInternetSearch'
) {
  if (!Array.isArray(missingParts) || missingParts.length === 0) {
    return
  }
  throw new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    `${operationLabel}结果缺少名词译名：${missingParts.join('，')}`,
    errorField,
    502
  )
}

function normalizeSearchTermsWithMissing(
  resultData,
  termRequests,
  options = {}
) {
  const operationLabel = options.operationLabel || 'AI 联网搜索'
  const errorField = options.errorField || 'geminiInternetSearch'
  normalizeResultRoot(resultData, operationLabel, errorField)
  const includeTermNoteRevision = options.includeTermNoteRevision !== false
  const allowSameSourceTranslationWithNote =
    options.allowSameSourceTranslationWithNote === true

  const requestedTermMap = buildRequestedTermMap(termRequests)

  const resultTermMap = new Map()
  resultData.terms.forEach(termItem => {
    const sourceText = properNounTranslationService.normalizeSourceText(
      termItem?.sourceText
    )
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(sourceText)
    const termRequest = requestedTermMap.get(normalizedSourceText)
    if (!sourceText || !termRequest) {
      return
    }
    const translations = {}
    const translationNotes = {}
    const skippedSameWithoutNoteLanguageCodes = []
    const resultTranslationNotes = normalizeResultTranslationNotes(
      termItem,
      termRequest.targetLanguageCodes
    )
    termRequest.targetLanguageCodes.forEach(languageCode => {
      const translatedText = normalizeString(
        termItem?.translations?.[languageCode],
        300
      )
      if (translatedText) {
        const translationNote = normalizeString(
          resultTranslationNotes[languageCode],
          2000
        )
        if (
          shouldSkipSameSourceTranslation({
            sourceText: termRequest.sourceText,
            translatedText,
            note: translationNote,
            allowSameSourceTranslationWithNote
          })
        ) {
          skippedSameWithoutNoteLanguageCodes.push(languageCode)
          return
        }
        translations[languageCode] = translatedText
        if (allowSameSourceTranslationWithNote === true && translationNote) {
          translationNotes[languageCode] = translationNote
        }
      }
    })
    let termNote = termRequest.note || ''
    let shouldUpdateTermNote = false
    if (includeTermNoteRevision) {
      if (typeof termItem?.noteNeedsUpdate !== 'boolean') {
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${operationLabel}结果 ${sourceText} 缺少 noteNeedsUpdate 布尔值`,
          errorField,
          502
        )
      }
      const revisedNote = normalizeString(termItem?.note, 200)
      if (termItem.noteNeedsUpdate === true && !revisedNote) {
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${operationLabel}结果 ${sourceText} 标记需要修订备注但没有返回 note`,
          errorField,
          502
        )
      }
      if (termItem.noteNeedsUpdate === true) {
        termNote = revisedNote
        shouldUpdateTermNote = true
      }
    }
    resultTermMap.set(normalizedSourceText, {
      sourceText: termRequest.sourceText,
      sourceLanguageCode: termRequest.sourceLanguageCode || '',
      termId: termRequest.termId || '',
      note: termNote,
      shouldUpdateTermNote,
      translations,
      translationNotes,
      skippedSameWithoutNoteLanguageCodes,
      translationSource: TERM_TRANSLATION_SOURCE_INTERNET_SEARCH
    })
  })

  const normalizedTermRequests = Array.from(requestedTermMap.values())
  const missingTermRequests = collectSearchMissingTermRequests(
    normalizedTermRequests,
    resultTermMap,
    {
      allowSameSourceTranslationWithNote
    }
  )
  const missingParts = buildMissingTermParts(missingTermRequests)

  return {
    terms: Array.from(resultTermMap.values()),
    termMap: resultTermMap,
    missingTermRequests,
    missingParts
  }
}

function normalizeSearchTerms(resultData, termRequests, options = {}) {
  const operationLabel = options.operationLabel || 'AI 联网搜索'
  const errorField = options.errorField || 'geminiInternetSearch'
  const normalizedResult = normalizeSearchTermsWithMissing(
    resultData,
    termRequests,
    options
  )
  throwMissingSearchTranslationsError(
    normalizedResult.missingParts,
    operationLabel,
    errorField
  )
  return normalizedResult.terms
}

function cloneSearchResultTerm(term) {
  const translations = {}
  if (term?.translations && typeof term.translations === 'object') {
    Object.keys(term.translations).forEach(languageCode => {
      translations[languageCode] = term.translations[languageCode]
    })
  }

  const translationNotes = {}
  if (term?.translationNotes && typeof term.translationNotes === 'object') {
    Object.keys(term.translationNotes).forEach(languageCode => {
      translationNotes[languageCode] = term.translationNotes[languageCode]
    })
  }

  const skippedSameWithoutNoteLanguageCodes = []
  if (Array.isArray(term?.skippedSameWithoutNoteLanguageCodes)) {
    term.skippedSameWithoutNoteLanguageCodes.forEach(languageCode => {
      if (!skippedSameWithoutNoteLanguageCodes.includes(languageCode)) {
        skippedSameWithoutNoteLanguageCodes.push(languageCode)
      }
    })
  }

  return {
    ...term,
    translations,
    translationNotes,
    skippedSameWithoutNoteLanguageCodes
  }
}

function mergeSearchMetadata(currentMetadata, nextMetadata) {
  const mergedMetadata = {}
  if (currentMetadata && typeof currentMetadata === 'object') {
    Object.assign(mergedMetadata, currentMetadata)
  }

  if (!nextMetadata || typeof nextMetadata !== 'object') {
    return mergedMetadata
  }

  const mergedQueries = []
  if (Array.isArray(currentMetadata?.webSearchQueries)) {
    currentMetadata.webSearchQueries.forEach(query => {
      const text = normalizeString(query, 300)
      if (text && !mergedQueries.includes(text)) {
        mergedQueries.push(text)
      }
    })
  }
  if (Array.isArray(nextMetadata.webSearchQueries)) {
    nextMetadata.webSearchQueries.forEach(query => {
      const text = normalizeString(query, 300)
      if (text && !mergedQueries.includes(text)) {
        mergedQueries.push(text)
      }
    })
  }
  if (mergedQueries.length > 0) {
    mergedMetadata.webSearchQueries = mergedQueries.slice(0, 20)
  }

  const mergedChunks = []
  if (Array.isArray(currentMetadata?.groundingChunks)) {
    currentMetadata.groundingChunks.forEach(chunk => {
      const uri = normalizeString(chunk?.uri, 600)
      if (!uri) {
        return
      }
      if (mergedChunks.some(item => item.uri === uri)) {
        return
      }
      mergedChunks.push({
        title: normalizeString(chunk?.title, 200),
        uri
      })
    })
  }
  if (Array.isArray(nextMetadata.groundingChunks)) {
    nextMetadata.groundingChunks.forEach(chunk => {
      const uri = normalizeString(chunk?.uri, 600)
      if (!uri) {
        return
      }
      if (mergedChunks.some(item => item.uri === uri)) {
        return
      }
      mergedChunks.push({
        title: normalizeString(chunk?.title, 200),
        uri
      })
    })
  }
  if (mergedChunks.length > 0) {
    mergedMetadata.groundingChunks = mergedChunks.slice(0, 20)
  }

  return mergedMetadata
}

function mergeSearchTermIntoMap(termMap, term) {
  const sourceText = properNounTranslationService.normalizeSourceText(
    term?.sourceText
  )
  const normalizedSourceText =
    properNounTranslationService.buildNormalizedSourceText(sourceText)
  if (!sourceText || !normalizedSourceText) {
    return
  }

  let currentTerm = termMap.get(normalizedSourceText)
  if (!currentTerm) {
    termMap.set(normalizedSourceText, cloneSearchResultTerm(term))
    return
  }

  Object.keys(term.translations || {}).forEach(languageCode => {
    currentTerm.translations[languageCode] = term.translations[languageCode]
  })

  Object.keys(term.translationNotes || {}).forEach(languageCode => {
    currentTerm.translationNotes[languageCode] =
      term.translationNotes[languageCode]
  })

  if (term.shouldUpdateTermNote === true) {
    currentTerm.note = term.note || currentTerm.note || ''
    currentTerm.shouldUpdateTermNote = true
  }
  if (!currentTerm.note && term.note) {
    currentTerm.note = term.note
  }

  currentTerm.searchMetadata = mergeSearchMetadata(
    currentTerm.searchMetadata,
    term.searchMetadata
  )

  if (Array.isArray(term.skippedSameWithoutNoteLanguageCodes)) {
    term.skippedSameWithoutNoteLanguageCodes.forEach(languageCode => {
      if (
        !currentTerm.skippedSameWithoutNoteLanguageCodes.includes(languageCode)
      ) {
        currentTerm.skippedSameWithoutNoteLanguageCodes.push(languageCode)
      }
    })
  }
}

function mergeSearchTermsIntoMap(termMap, terms) {
  terms.forEach(term => {
    mergeSearchTermIntoMap(termMap, term)
  })
}

function splitTermRequestBatches(termRequests, batchTermCount) {
  const batches = []
  const normalizedBatchTermCount = Number(batchTermCount)
  let size = OFFICIAL_TERM_SEARCH_REPAIR_BATCH_TERM_COUNT
  if (
    Number.isInteger(normalizedBatchTermCount) &&
    normalizedBatchTermCount > 0
  ) {
    size = normalizedBatchTermCount
  }
  for (let index = 0; index < termRequests.length; index += size) {
    batches.push(termRequests.slice(index, index + size))
  }
  return batches
}

function notifySearchStatus(onStatus, message, payload = {}) {
  if (typeof onStatus !== 'function') {
    return
  }
  onStatus({
    message,
    ...payload
  })
}

function buildSearchRawResponse(primaryResult, repairResults) {
  if (!Array.isArray(repairResults) || repairResults.length === 0) {
    return primaryResult.rawResponse
  }
  return {
    primary: primaryResult.rawResponse,
    repairs: repairResults.map(result => {
      return result.rawResponse
    })
  }
}

function buildSearchResponseSummary(primaryResult, repairResults) {
  if (!Array.isArray(repairResults) || repairResults.length === 0) {
    return primaryResult.responseSummary
  }
  return {
    primary: primaryResult.responseSummary,
    repairs: repairResults.map(result => {
      return result.responseSummary
    })
  }
}

async function recordUsage(options = {}) {
  if (options.skipUsageLog === true) {
    return
  }
  const meta = {
    termCount: options.termCount || 0,
    targetLanguageCodes: options.targetLanguageCodes || [],
    requestSummary: options.requestSummary || null,
    responseSummary: options.responseSummary || null
  }
  if (Array.isArray(options.termRequests)) {
    meta.termRequests = options.termRequests.map(termRequest => {
      return {
        sourceText: termRequest.sourceText,
        targetLanguageCodes: termRequest.targetLanguageCodes
      }
    })
  }
  const contextSummary = normalizeOfficialTermContextSummary(
    options.contextSummary
  )
  if (contextSummary) {
    meta.contextSummary = contextSummary
  }
  if (options.failureCode || options.failureReason) {
    meta.failure = {
      code: options.failureCode || '',
      reason: options.failureReason || ''
    }
  }

  if (options.settings?.provider !== 'gemini') {
    const responseResult = options.responseResult || {}
    await aiUsageService.recordAiUsageLog({
      provider: options.settings?.provider || 'unknown',
      model:
        responseResult.model ||
        options.settings?.model ||
        options.settings?.deepSeekModel ||
        '',
      operation: options.operation || OPERATION_OFFICIAL_TERM_SEARCH,
      status: options.status,
      requestId: responseResult.requestId || '',
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCode: options.targetLanguageCodes?.join(','),
      usage: responseResult.usage || {},
      rawResponse: responseResult.rawResponse || options.response || null,
      meta
    })
    return
  }

  await recordGeminiUsageLog({
    settings: options.settings,
    operation: options.operation || OPERATION_OFFICIAL_TERM_SEARCH,
    status: options.status,
    response: options.response,
    error: options.error,
    sourceLanguageCode: options.sourceLanguageCode,
    targetLanguageCode: options.targetLanguageCodes?.join(','),
    meta,
    failureCode: options.failureCode,
    failureReason: options.failureReason,
    resultType: 'json'
  })
}

async function resolveOfficialTermTranslationsFromKnowledge({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  requestUrl,
  cancellation,
  onStatus,
  skipUsageLog,
  allowSameSourceTranslationWithNote = false
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const providerLabel = getProviderLabel(settings)
  const providerErrorField = getProviderErrorField(settings)
  const operationLabel = `${providerLabel} 名词知识库整理`
  const prompt = buildOfficialTermKnowledgePrompt({
    settings,
    termRequests,
    sourceLanguageCode,
    contextSummary,
    allowSameSourceTranslationWithNote
  })
  let requestBody = null
  let requestSummary = null
  if (settings.provider === 'gemini') {
    requestBody = buildGeminiKnowledgeRequest(settings, prompt, {
      allowSameSourceTranslationWithNote
    })
    requestSummary = summarizeGeminiNativeRequestBody(requestBody, requestUrl)
  } else {
    const requestConfig = buildJsonRequestBody(
      settings,
      buildKnowledgeMessages(prompt),
      {
        responseJsonSchema: buildOfficialTermKnowledgeResponseJsonSchema({
          allowSameSourceTranslationWithNote
        })
      }
    )
    requestBody = requestConfig.requestBody
    requestUrl = requestConfig.requestUrl
    requestSummary = buildProviderRequestSummary(settings, requestUrl)
  }

  return await runAiStepWithRetry(
    async () => {
      try {
        let response = null
        let responseSummary = null
        let responseResult = null
        let extractedText = ''
        if (settings.provider === 'gemini') {
          response = await sendGeminiNativeGenerateContentRequest(
            settings,
            requestBody,
            requestUrl,
            { cancellation }
          )
          responseSummary = summarizeGeminiNativeResponse(response)
          extractedText =
            extractTextFromGeminiNativeResponse(response)?.text || ''
        } else {
          responseResult = await requestProviderJson(
            settings,
            requestBody,
            requestUrl,
            { cancellation }
          )
          response = responseResult.rawResponse
          responseSummary = buildProviderResponseSummary(responseResult)
          extractedText = responseResult.contentText || ''
        }
        const resultData = parseSearchResponseText(
          extractedText,
          operationLabel,
          providerErrorField
        )
        const result = normalizeKnowledgeTerms(resultData, termRequests, {
          operationLabel,
          errorField: providerErrorField,
          allowSameSourceTranslationWithNote
        })
        await recordUsage({
          settings,
          operation: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
          status: 'success',
          response,
          responseResult,
          sourceLanguageCode,
          targetLanguageCodes,
          termCount: termRequests.length,
          termRequests,
          contextSummary,
          requestSummary,
          responseSummary,
          skipUsageLog
        })
        return {
          ...result,
          rawResponse: response,
          aiJsonLog: translationAiJsonLogService.createAiJsonLog({
            operation: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
            stage: 'ProperNounOfficialTranslationKnowledge',
            provider: settings.provider,
            model:
              responseResult?.model ||
              response?.modelVersion ||
              response?.model ||
              settings.model ||
              settings.deepSeekModel ||
              '',
            requestId:
              responseResult?.requestId ||
              response?.responseId ||
              response?.requestId ||
              '',
            sourceLanguageCode,
            targetLanguageCode: targetLanguageCodes.join(','),
            meta: {
              sourceTermCount: termRequests.length,
              targetLanguageCodes,
              contextSummaryLength:
                normalizeOfficialTermContextSummary(contextSummary).length,
              confirmedTermCount: result.terms.length,
              needsSearchTermCount: result.missingTermRequests.length
            },
            input: {
              requestBody,
              requestSummary
            },
            json: {
              result: resultData,
              normalizedTerms: result.terms,
              missingTermRequests: result.missingTermRequests,
              responseSummary
            }
          })
        }
      } catch (error) {
        await recordUsage({
          settings,
          operation: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
          status: 'error',
          error,
          sourceLanguageCode,
          targetLanguageCodes,
          termCount: termRequests.length,
          termRequests,
          contextSummary,
          requestSummary,
          failureCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
          failureReason: error?.message || '',
          skipUsageLog
        })
        if (error && error.name === 'ApiError') {
          throw error
        }
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || `${operationLabel}请求失败`,
          providerErrorField,
          502
        )
      }
    },
    {
      stepKey: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
      stepLabel: '专有名词 AI 知识库译名整理',
      field: providerErrorField,
      onStatus,
      cancellation
    }
  )
}

async function requestOfficialTermSearchTranslations({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  requestUrl,
  cancellation,
  skipUsageLog,
  includeTermNoteRevision = true,
  allowSameSourceTranslationWithNote = false,
  repairAttemptNo = 0
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  let operationLabel = 'AI 联网搜索'
  if (Number(repairAttemptNo || 0) > 0) {
    operationLabel = 'AI 联网搜索补缺'
  }
  const prompt = buildOfficialTermSearchPrompt({
    settings,
    termRequests,
    sourceLanguageCode,
    contextSummary,
    includeTermNoteRevision,
    allowSameSourceTranslationWithNote,
    repairAttemptNo
  })
  const requestBody = buildGeminiSearchRequest(settings, prompt, {
    includeTermNoteRevision,
    allowSameSourceTranslationWithNote
  })
  const requestSummary = summarizeGeminiNativeRequestBody(
    requestBody,
    requestUrl
  )

  try {
    const response = await sendGeminiNativeGenerateContentRequest(
      settings,
      requestBody,
      requestUrl,
      { cancellation }
    )
    const responseSummary = summarizeGeminiNativeResponse(response)
    const extractedText = extractTextFromGeminiNativeResponse(response)
    const resultData = parseSearchResponseText(
      extractedText?.text || '',
      operationLabel,
      'geminiInternetSearch'
    )
    const groundingMetadata = summarizeGroundingMetadata(response)
    const normalizedResult = normalizeSearchTermsWithMissing(
      resultData,
      termRequests,
      {
        operationLabel,
        includeTermNoteRevision,
        allowSameSourceTranslationWithNote
      }
    )
    const terms = normalizedResult.terms.map(term => {
      return {
        ...term,
        searchMetadata: groundingMetadata
      }
    })
    await recordUsage({
      settings,
      operation: OPERATION_OFFICIAL_TERM_SEARCH,
      status: 'success',
      response,
      sourceLanguageCode,
      targetLanguageCodes,
      termCount: termRequests.length,
      termRequests,
      contextSummary,
      requestSummary,
      responseSummary,
      skipUsageLog
    })
    return {
      terms,
      missingTermRequests: normalizedResult.missingTermRequests,
      missingParts: normalizedResult.missingParts,
      rawResponse: response,
      resultData,
      groundingMetadata,
      responseSummary,
      requestBody,
      requestSummary,
      termRequests
    }
  } catch (error) {
    await recordUsage({
      settings,
      operation: OPERATION_OFFICIAL_TERM_SEARCH,
      status: 'error',
      error,
      sourceLanguageCode,
      targetLanguageCodes,
      termCount: termRequests.length,
      termRequests,
      contextSummary,
      requestSummary,
      failureCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
      failureReason: error?.message || '',
      skipUsageLog
    })
    if (error && error.name === 'ApiError') {
      throw error
    }
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      error?.message || 'Gemini 联网搜索请求失败',
      'geminiInternetSearch',
      502
    )
  }
}

async function searchOfficialTermTranslationsWithInternet({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  requestUrl,
  cancellation,
  onStatus,
  skipUsageLog,
  includeTermNoteRevision = true,
  allowSameSourceTranslationWithNote = false,
  allowMissingTranslations = false
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)

  return await runAiStepWithRetry(
    async () => {
      try {
        const primaryResult = await requestOfficialTermSearchTranslations({
          settings,
          requestUrl,
          termRequests,
          sourceLanguageCode,
          contextSummary,
          cancellation,
          skipUsageLog,
          includeTermNoteRevision,
          allowSameSourceTranslationWithNote
        })

        const aggregateTermMap = new Map()
        mergeSearchTermsIntoMap(aggregateTermMap, primaryResult.terms)

        let missingTermRequests = collectSearchMissingTermRequests(
          termRequests,
          aggregateTermMap,
          {
            allowSameSourceTranslationWithNote
          }
        )

        const repairResults = []
        let repairRoundNo = 1
        while (
          missingTermRequests.length > 0 &&
          repairRoundNo <= OFFICIAL_TERM_SEARCH_REPAIR_MAX_ROUNDS
        ) {
          const missingParts = buildMissingTermParts(missingTermRequests)
          notifySearchStatus(
            onStatus,
            `正在定向补齐 ${missingParts.length} 个缺失名词译名，第 ${repairRoundNo} 轮补齐，最多 ${OFFICIAL_TERM_SEARCH_REPAIR_MAX_ROUNDS} 轮`,
            {
              missingParts
            }
          )

          const repairBatches = splitTermRequestBatches(
            missingTermRequests,
            OFFICIAL_TERM_SEARCH_REPAIR_BATCH_TERM_COUNT
          )
          for (let index = 0; index < repairBatches.length; index += 1) {
            const repairBatch = repairBatches[index]
            notifySearchStatus(
              onStatus,
              `正在补齐第 ${index + 1}/${repairBatches.length} 批缺失名词译名`,
              {
                repairRoundNo,
                repairBatchIndex: index + 1,
                repairBatchCount: repairBatches.length,
                missingParts: buildMissingTermParts(repairBatch)
              }
            )
            const repairResult = await requestOfficialTermSearchTranslations({
              settings,
              requestUrl,
              termRequests: repairBatch,
              sourceLanguageCode,
              contextSummary,
              cancellation,
              skipUsageLog,
              includeTermNoteRevision,
              allowSameSourceTranslationWithNote,
              repairAttemptNo: repairRoundNo
            })
            repairResults.push(repairResult)
            mergeSearchTermsIntoMap(aggregateTermMap, repairResult.terms)
          }

          missingTermRequests = collectSearchMissingTermRequests(
            termRequests,
            aggregateTermMap,
            {
              allowSameSourceTranslationWithNote
            }
          )

          if (missingTermRequests.length > 0) {
            const remainingMissingParts =
              buildMissingTermParts(missingTermRequests)
            notifySearchStatus(
              onStatus,
              `第 ${repairRoundNo} 轮补齐后仍有 ${remainingMissingParts.length} 个名词译名缺失`,
              {
                repairRoundNo,
                missingParts: remainingMissingParts
              }
            )
          }

          repairRoundNo += 1
        }

        const finalMissingParts = buildMissingTermParts(missingTermRequests)
        // allowMissingTranslations=true 时（如名词管理里的实时联网检索），即使检索后仍有
        // 名词无法确定译名，也不报错，而是保持缺失，交由人工在名词管理里校验补充。
        if (allowMissingTranslations !== true) {
          throwMissingSearchTranslationsError(finalMissingParts)
        }

        const terms = Array.from(aggregateTermMap.values())
        const rawResponse = buildSearchRawResponse(primaryResult, repairResults)
        const responseSummary = buildSearchResponseSummary(
          primaryResult,
          repairResults
        )
        let repairRoundCount = 0
        if (repairResults.length > 0) {
          repairRoundCount = repairRoundNo - 1
        }
        const aiJsonLog = translationAiJsonLogService.createAiJsonLog({
          operation: OPERATION_OFFICIAL_TERM_SEARCH,
          stage: 'ProperNounOfficialTranslationSearch',
          provider: settings.provider,
          model: settings.model,
          requestId: '',
          sourceLanguageCode,
          targetLanguageCode: targetLanguageCodes.join(','),
          meta: {
            sourceTermCount: termRequests.length,
            targetLanguageCodes,
            contextSummaryLength:
              normalizeOfficialTermContextSummary(contextSummary).length,
            translatedTermCount: terms.length,
            primaryMissingPairCount: primaryResult.missingParts.length,
            repairRequestCount: repairResults.length,
            repairRoundCount
          },
          input: {
            primary: {
              requestBody: primaryResult.requestBody,
              requestSummary: primaryResult.requestSummary
            },
            repairs: repairResults.map(result => {
              return {
                requestBody: result.requestBody,
                requestSummary: result.requestSummary
              }
            })
          },
          json: {
            primary: {
              result: primaryResult.resultData,
              terms: primaryResult.terms,
              missingTermRequests: primaryResult.missingTermRequests,
              groundingMetadata: primaryResult.groundingMetadata,
              responseSummary: primaryResult.responseSummary
            },
            repairs: repairResults.map(result => {
              return {
                result: result.resultData,
                terms: result.terms,
                missingTermRequests: result.missingTermRequests,
                groundingMetadata: result.groundingMetadata,
                responseSummary: result.responseSummary
              }
            }),
            terms,
            responseSummary
          }
        })

        return {
          terms,
          rawResponse,
          aiJsonLog
        }
      } catch (error) {
        if (error && error.name === 'ApiError') {
          throw error
        }
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || 'Gemini 联网搜索请求失败',
          'geminiInternetSearch',
          502
        )
      }
    },
    {
      stepKey: OPERATION_OFFICIAL_TERM_SEARCH,
      stepLabel: '专有名词联网检索译名整理',
      field: 'geminiInternetSearch',
      onStatus,
      cancellation
    }
  )
}

async function searchOfficialTermTranslations(options = {}) {
  let sourceTerms = normalizeSourceTerms(options.sourceTerms)
  const targetLanguageCodes = normalizeTargetLanguageCodes(
    options.targetLanguageCodes
  )
  let termRequests = normalizeTermRequestList(options.termRequests)
  if (termRequests.length === 0) {
    termRequests = buildTermRequests(sourceTerms, targetLanguageCodes)
  }
  if (sourceTerms.length === 0) {
    sourceTerms = termRequests.map(termRequest => termRequest.sourceText)
  }
  if (termRequests.length === 0) {
    return {
      provider: '',
      model: '',
      terms: []
    }
  }
  const contextSummary = normalizeOfficialTermContextSummary(
    options.contextSummary
  )
  const requestTargetLanguageCodes =
    getTermRequestTargetLanguageCodes(termRequests)
  const includeTermNoteRevision = options.includeTermNoteRevision !== false
  const allowSameSourceTranslationWithNote =
    options.allowSameSourceTranslationWithNote === true
  const allowMissingTranslations = options.allowMissingTranslations === true
  const skipKnowledgeBase = options.skipKnowledgeBase === true
  const skipInternetSearch = options.skipInternetSearch === true

  const knowledgeSettings =
    await aiSettingsService.getProperNounKnowledgeRuntimeSettings()
  const timeoutSeconds = Number(options.timeoutSeconds)
  if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    knowledgeSettings.timeoutSeconds = timeoutSeconds
  }
  let knowledgeResult = {
    terms: [],
    missingTermRequests: termRequests,
    rawResponse: null,
    aiJsonLog: null
  }
  if (!skipKnowledgeBase) {
    knowledgeResult = await resolveOfficialTermTranslationsFromKnowledge({
      settings: knowledgeSettings,
      termRequests,
      sourceLanguageCode: options.sourceLanguageCode,
      contextSummary,
      requestUrl:
        knowledgeSettings.provider === 'gemini'
          ? buildGeminiNativeGenerateContentUrl(knowledgeSettings)
          : null,
      cancellation: options.cancellation,
      onStatus: options.onStatus,
      skipUsageLog: options.skipUsageLog,
      allowSameSourceTranslationWithNote
    })
  }

  let searchResult = {
    terms: [],
    rawResponse: null,
    aiJsonLog: null
  }
  let searchSettings = null
  let internetSearchRequestedTermCount = 0
  let internetSearchTargetLanguageCodes = []
  if (!skipInternetSearch && knowledgeResult.missingTermRequests.length > 0) {
    internetSearchRequestedTermCount =
      knowledgeResult.missingTermRequests.length
    internetSearchTargetLanguageCodes = getTermRequestTargetLanguageCodes(
      knowledgeResult.missingTermRequests
    )
    searchSettings = await aiSettingsService.getInternetSearchRuntimeSettings()
    if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
      searchSettings.timeoutSeconds = timeoutSeconds
    }
    if (searchSettings.provider !== 'gemini') {
      throw new ApiError(
        ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
        '互联网搜索服务商暂不支持',
        'internetSearchProvider',
        400
      )
    }
    searchResult = await searchOfficialTermTranslationsWithInternet({
      settings: searchSettings,
      termRequests: knowledgeResult.missingTermRequests,
      sourceLanguageCode: options.sourceLanguageCode,
      contextSummary,
      requestUrl: buildGeminiNativeGenerateContentUrl(searchSettings),
      cancellation: options.cancellation,
      onStatus: options.onStatus,
      skipUsageLog: options.skipUsageLog,
      includeTermNoteRevision,
      allowSameSourceTranslationWithNote,
      allowMissingTranslations
    })
  }

  let provider = knowledgeSettings.provider
  let model = knowledgeSettings.model || knowledgeSettings.deepSeekModel || ''
  if (searchResult.terms.length > 0) {
    provider = 'gemini'
    model = ''
    if (searchSettings && searchSettings.model) {
      model = searchSettings.model
    }
  }

  return {
    provider,
    model,
    terms: knowledgeResult.terms.concat(searchResult.terms),
    stats: {
      sourceTermCount: sourceTerms.length,
      targetLanguageCodes: requestTargetLanguageCodes,
      skipKnowledgeBase,
      skipInternetSearch,
      includeTermNoteRevision,
      allowSameSourceTranslationWithNote,
      aiKnowledgeBaseTermCount: knowledgeResult.terms.length,
      aiKnowledgeBaseTranslationCount: countTermTranslationLanguagePairs(
        knowledgeResult.terms
      ),
      internetSearchTermCount: searchResult.terms.length,
      internetSearchTranslationCount: countTermTranslationLanguagePairs(
        searchResult.terms
      ),
      internetSearchRequestedTermCount,
      internetSearchTargetLanguageCodes
    },
    rawResponse: {
      knowledge: knowledgeResult.rawResponse,
      search: searchResult.rawResponse
    },
    aiJsonLogs: translationAiJsonLogService.mergeAiJsonLogs(
      [knowledgeResult.aiJsonLog],
      [searchResult.aiJsonLog]
    )
  }
}

module.exports = {
  OPERATION_OFFICIAL_TERM_KNOWLEDGE,
  OPERATION_OFFICIAL_TERM_SEARCH,
  searchOfficialTermTranslations
}
