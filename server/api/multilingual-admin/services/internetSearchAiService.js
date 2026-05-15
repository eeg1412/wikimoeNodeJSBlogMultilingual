const {
  getLanguageText,
  normalizeLanguageCode
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const aiSettingsService = require('./aiSettingsService')
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

const OPERATION_OFFICIAL_TERM_KNOWLEDGE =
  'proper-noun.official-translation.knowledge'
const OPERATION_OFFICIAL_TERM_SEARCH = 'proper-noun.official-translation.search'
const TERM_TRANSLATION_SOURCE_AI_KNOWLEDGE = 'aiKnowledgeBase'
const TERM_TRANSLATION_SOURCE_INTERNET_SEARCH = 'internetSearchAi'
const MAX_TERM_CONTEXT_SUMMARY_LENGTH = 800

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
        required: ['sourceText', 'translations', 'needsSearchLanguageCodes'],
        properties: {
          sourceText: { type: 'string' },
          translations: {
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
          noteNeedsUpdate: { type: 'boolean' },
          note: { type: 'string' }
        }
      }
    }
  }
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
    let termRequest = termRequestMap.get(normalizedSourceText)
    if (!termRequest) {
      termRequest = {
        sourceText,
        normalizedSourceText,
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

function buildTermRequestPromptRows(termRequests) {
  return termRequests.map(termRequest => {
    const row = {
      sourceText: termRequest.sourceText,
      targetLanguages: buildTargetLanguagePromptRows(
        termRequest.targetLanguageCodes
      )
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

function attachTermTranslationQualityPolicy(requestData) {
  requestData['翻译质量约束'] =
    translationPromptPolicyService.getTermTranslationQualityPolicyText()
}

function buildOfficialTermKnowledgePrompt({
  termRequests,
  sourceLanguageCode,
  contextSummary
}) {
  const normalizedContextSummary =
    normalizeOfficialTermContextSummary(contextSummary)
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
    'sourceTermRequests 旁可能包含 contentContextSummary；确认译名时必须优先按它和 note 识别对象身份，短人名、昵称、单字名或同形异义词不能只按字面普通词处理。',
    '必须优先让 needsSearchLanguageCodes 覆盖所有不确定语言，不要为了完整率补 translations。',
    '如果目标语言确实没有固定译名，但这一结论仍需要查证，也应放入 needsSearchLanguageCodes，由联网检索阶段确认后再直译或音译。',
    '必须返回每一个输入 sourceText；translations 只包含你完美确认的语言。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。',
    'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"needsSearchLanguageCodes":["zh-HK"]}]}。',
    '',
    JSON.stringify(requestData, null, 2)
  ]

  return promptLines.join('\n')
}

function buildOfficialTermSearchPrompt({
  termRequests,
  sourceLanguageCode,
  contextSummary
}) {
  const normalizedContextSummary =
    normalizeOfficialTermContextSummary(contextSummary)
  const requestData = {
    task: 'search_official_term_translations',
    sourceLanguageCode: sourceLanguageCode || '',
    sourceTermRequests: buildTermRequestPromptRows(termRequests)
  }
  attachTermTranslationQualityPolicy(requestData)
  attachTermNoteInstruction(requestData, termRequests)
  attachSearchTermNoteRevisionInstruction(requestData, termRequests)
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
    '如果目标语言使用不同文字系统，必须积极使用目标语言文字系统组织 query；不要只用源文语言关键词搜索目标语言译名。',
    '禁止把 sourceText 截短成过宽关键词检索；不得用系列母题、父级作品名、通用类型词或部分核心词替代完整 sourceText。',
    '只有首轮结果互相矛盾或无法确认对象身份时，才允许第二次检索；第二次必须针对矛盾点改进关键词。',
    'sourceTermRequests 旁可能包含 contentContextSummary；检索和筛选结果时必须优先按该上下文判断名词指向的作品、角色、组织、地点或产品。',
    '短人名、昵称、单字名或同形异义词必须结合 contentContextSummary 检索，不要只按字面普通词或日常含义给译名。',
    '你需要为每个缺失项给出目标语言中的官方译名、正式译名、权威通行译名或稳定通用译名。',
    '优先采用官方网站、发行商、出版社、平台商、百科条目或权威媒体中已存在的正式译名。',
    '如果检索结果能够证明目标语言没有官方译名、正式译名、权威通行译名或稳定通用译名，translations 中必须填写原文表面形式，不要给出非官方普通译名。',
    '如果检索证据不足以确认对象身份或译名状态，必须保留原文表面形式，不要直译、音译、意译、本地化或改写。',
    '在确认译名的同时，必须根据联网检索结果判断 sourceTermRequests[].note 是否需要修订。',
    '如果 note 对实体身份、作品归属、角色定位、组织类型、产品类型或地理属性的描述有误，或者含有“文中提及”“本文”“正文”“本次内容”等上下文依赖表述，noteNeedsUpdate 必须为 true。',
    '修订后的 note 必须是中文词库消歧备注，只写可脱离本文单独成立的稳定身份线索；不要写翻译方法，不要写目标语言译名，不要写搜索过程。',
    '如果原 note 已准确可用，noteNeedsUpdate 必须为 false，note 返回原 note。',
    '必须覆盖每一个输入 sourceText 下列出的每一个目标语言 code。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。',
    'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"noteNeedsUpdate":true,"note":"修订后的中文词库消歧备注"}]}。',
    '',
    JSON.stringify(requestData, null, 2)
  ]

  return promptLines.join('\n')
}

function buildGeminiKnowledgeRequest(settings, prompt) {
  const generationConfig = applyGeminiThinkingConfig(
    {
      responseMimeType: 'application/json',
      responseJsonSchema: officialTermKnowledgeResponseJsonSchema
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

function buildGeminiSearchRequest(settings, prompt) {
  const generationConfig = applyGeminiThinkingConfig(
    {
      responseMimeType: 'application/json',
      responseJsonSchema: officialTermSearchResponseJsonSchema
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

function parseSearchResponseText(rawText, operationLabel = 'Gemini 联网搜索') {
  const text = normalizeString(rawText, 200000)
  if (!text) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}没有返回内容`,
      'geminiInternetSearch',
      502
    )
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}返回的 JSON 解析失败`,
      'geminiInternetSearch',
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

function normalizeResultRoot(resultData, operationLabel) {
  if (!resultData || typeof resultData !== 'object') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel} JSON 根节点必须是对象`,
      'geminiInternetSearch',
      502
    )
  }
  if (!Array.isArray(resultData.terms)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `${operationLabel}结果缺少 terms 数组`,
      'geminiInternetSearch',
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

function normalizeKnowledgeTerms(resultData, termRequests) {
  normalizeResultRoot(resultData, 'Gemini 名词知识库整理')

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
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (needsSearchLanguageCodes.includes(languageCode)) {
        return
      }
      const translatedText = normalizeString(
        termItem?.translations?.[languageCode],
        300
      )
      if (translatedText) {
        translations[languageCode] = translatedText
      }
    })
    resultTermMap.set(normalizedSourceText, {
      sourceText: termRequest.sourceText,
      termId: termRequest.termId || '',
      note: termRequest.note || '',
      translations,
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

function normalizeSearchTerms(resultData, termRequests) {
  normalizeResultRoot(resultData, 'Gemini 联网搜索')

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
    termRequest.targetLanguageCodes.forEach(languageCode => {
      const translatedText = normalizeString(
        termItem?.translations?.[languageCode],
        300
      )
      if (translatedText) {
        translations[languageCode] = translatedText
      }
    })
    if (typeof termItem?.noteNeedsUpdate !== 'boolean') {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `Gemini 联网搜索结果 ${sourceText} 缺少 noteNeedsUpdate 布尔值`,
        'geminiInternetSearch',
        502
      )
    }
    const revisedNote = normalizeString(termItem?.note, 200)
    if (termItem.noteNeedsUpdate === true && !revisedNote) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `Gemini 联网搜索结果 ${sourceText} 标记需要修订备注但没有返回 note`,
        'geminiInternetSearch',
        502
      )
    }
    let termNote = termRequest.note || ''
    if (termItem.noteNeedsUpdate === true) {
      termNote = revisedNote
    }
    resultTermMap.set(normalizedSourceText, {
      sourceText: termRequest.sourceText,
      termId: termRequest.termId || '',
      note: termNote,
      shouldUpdateTermNote: termItem.noteNeedsUpdate === true,
      translations,
      translationSource: TERM_TRANSLATION_SOURCE_INTERNET_SEARCH
    })
  })

  const missingParts = []
  requestedTermMap.forEach((termRequest, normalizedSourceText) => {
    const resultTerm = resultTermMap.get(normalizedSourceText)
    if (!resultTerm) {
      missingParts.push(termRequest.sourceText)
      return
    }
    termRequest.targetLanguageCodes.forEach(languageCode => {
      if (!resultTerm.translations[languageCode]) {
        missingParts.push(`${termRequest.sourceText}/${languageCode}`)
      }
    })
  })
  if (missingParts.length > 0) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `Gemini 联网搜索结果缺少名词译名：${missingParts.join('，')}`,
      'geminiInternetSearch',
      502
    )
  }

  return Array.from(resultTermMap.values())
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
  skipUsageLog
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const prompt = buildOfficialTermKnowledgePrompt({
    termRequests,
    sourceLanguageCode,
    contextSummary
  })
  const requestBody = buildGeminiKnowledgeRequest(settings, prompt)
  const requestSummary = summarizeGeminiNativeRequestBody(
    requestBody,
    requestUrl
  )

  return await runAiStepWithRetry(
    async () => {
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
          'Gemini 名词知识库整理'
        )
        const result = normalizeKnowledgeTerms(resultData, termRequests)
        await recordUsage({
          settings,
          operation: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
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
          ...result,
          rawResponse: response,
          aiJsonLog: translationAiJsonLogService.createAiJsonLog({
            operation: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
            stage: 'ProperNounOfficialTranslationKnowledge',
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
          error?.message || 'Gemini 名词知识库整理请求失败',
          'geminiInternetSearch',
          502
        )
      }
    },
    {
      stepKey: OPERATION_OFFICIAL_TERM_KNOWLEDGE,
      stepLabel: '专有名词 AI 知识库译名整理',
      field: 'geminiInternetSearch',
      onStatus,
      cancellation
    }
  )
}

async function searchOfficialTermTranslationsWithInternet({
  settings,
  termRequests,
  sourceLanguageCode,
  contextSummary,
  requestUrl,
  cancellation,
  onStatus,
  skipUsageLog
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const prompt = buildOfficialTermSearchPrompt({
    termRequests,
    sourceLanguageCode,
    contextSummary
  })
  const requestBody = buildGeminiSearchRequest(settings, prompt)
  const requestSummary = summarizeGeminiNativeRequestBody(
    requestBody,
    requestUrl
  )

  return await runAiStepWithRetry(
    async () => {
      try {
        const response = await sendGeminiNativeGenerateContentRequest(
          settings,
          requestBody,
          requestUrl,
          { cancellation }
        )
        const responseSummary = summarizeGeminiNativeResponse(response)
        const extractedText = extractTextFromGeminiNativeResponse(response)
        const resultData = parseSearchResponseText(extractedText?.text || '')
        const groundingMetadata = summarizeGroundingMetadata(response)
        const terms = normalizeSearchTerms(resultData, termRequests).map(
          term => {
            return {
              ...term,
              searchMetadata: groundingMetadata
            }
          }
        )
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
          rawResponse: response,
          aiJsonLog: translationAiJsonLogService.createAiJsonLog({
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
              translatedTermCount: terms.length
            },
            input: {
              requestBody,
              requestSummary
            },
            json: {
              result: resultData,
              terms,
              groundingMetadata,
              responseSummary
            }
          })
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

  const settings = await aiSettingsService.getInternetSearchRuntimeSettings()
  const timeoutSeconds = Number(options.timeoutSeconds)
  if (Number.isFinite(timeoutSeconds) && timeoutSeconds > 0) {
    settings.timeoutSeconds = timeoutSeconds
  }
  if (settings.provider !== 'gemini') {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '互联网搜索服务商暂不支持',
      'internetSearchProvider',
      400
    )
  }

  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  let knowledgeResult = {
    terms: [],
    missingTermRequests: termRequests,
    rawResponse: null,
    aiJsonLog: null
  }
  if (options.skipKnowledgeBase !== true) {
    knowledgeResult = await resolveOfficialTermTranslationsFromKnowledge({
      settings,
      termRequests,
      sourceLanguageCode: options.sourceLanguageCode,
      contextSummary,
      requestUrl,
      cancellation: options.cancellation,
      onStatus: options.onStatus,
      skipUsageLog: options.skipUsageLog
    })
  }

  let searchResult = {
    terms: [],
    rawResponse: null,
    aiJsonLog: null
  }
  if (knowledgeResult.missingTermRequests.length > 0) {
    searchResult = await searchOfficialTermTranslationsWithInternet({
      settings,
      termRequests: knowledgeResult.missingTermRequests,
      sourceLanguageCode: options.sourceLanguageCode,
      contextSummary,
      requestUrl,
      cancellation: options.cancellation,
      onStatus: options.onStatus,
      skipUsageLog: options.skipUsageLog
    })
  }

  return {
    provider: settings.provider,
    model: settings.model,
    terms: knowledgeResult.terms.concat(searchResult.terms),
    stats: {
      sourceTermCount: sourceTerms.length,
      targetLanguageCodes: requestTargetLanguageCodes,
      skipKnowledgeBase: options.skipKnowledgeBase === true,
      aiKnowledgeBaseTermCount: knowledgeResult.terms.length,
      aiKnowledgeBaseTranslationCount: countTermTranslationLanguagePairs(
        knowledgeResult.terms
      ),
      internetSearchTermCount: searchResult.terms.length,
      internetSearchTranslationCount: countTermTranslationLanguagePairs(
        searchResult.terms
      ),
      internetSearchRequestedTermCount:
        knowledgeResult.missingTermRequests.length,
      internetSearchTargetLanguageCodes: getTermRequestTargetLanguageCodes(
        knowledgeResult.missingTermRequests
      )
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
