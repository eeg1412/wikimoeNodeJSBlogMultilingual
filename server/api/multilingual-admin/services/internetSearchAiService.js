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
  buildGeminiNativeGenerateContentUrl,
  buildTextPart,
  extractTextFromGeminiNativeResponse,
  sendGeminiNativeGenerateContentRequest,
  summarizeGeminiNativeRequestBody,
  summarizeGeminiNativeResponse
} = require('./geminiNativeApiService')
const { recordGeminiUsageLog } = require('./geminiUsageLogService')

const OPERATION_OFFICIAL_TERM_KNOWLEDGE =
  'proper-noun.official-translation.knowledge'
const OPERATION_OFFICIAL_TERM_SEARCH = 'proper-noun.official-translation.search'
const TERM_TRANSLATION_SOURCE_AI_KNOWLEDGE = 'aiKnowledgeBase'
const TERM_TRANSLATION_SOURCE_INTERNET_SEARCH = 'internetSearchAi'

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
        required: ['sourceText', 'translations'],
        properties: {
          sourceText: { type: 'string' },
          translations: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
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
        targetLanguageCodes: []
      }
      termRequestMap.set(normalizedSourceText, termRequest)
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
    return {
      sourceText: termRequest.sourceText,
      targetLanguages: buildTargetLanguagePromptRows(
        termRequest.targetLanguageCodes
      )
    }
  })
}

function buildOfficialTermKnowledgePrompt({
  termRequests,
  sourceLanguageCode
}) {
  return [
    '你是多语言博客 CMS 的专有名词译名整理助手。',
    '本步骤禁止联网检索，也没有任何搜索工具可用；只能使用你模型内置的可靠知识。',
    '请为每个 sourceText 在指定目标语言中给出官方译名、正式译名、权威通行译名或稳定通用译名。',
    '如果你已经可靠知道译名，必须直接写入 translations，不要把该语言放入 needsSearchLanguageCodes。',
    '像“江户时代”“新干线”这类历史时期、公共交通、地名、常见组织、常见作品名等通用常识词，只要你能确定目标语言里的稳定通用译名，就应使用内置知识完成。',
    '只有当你无法可靠确认某个 sourceText 在某个目标语言 code 下的正式或通行译名时，才把该 language code 放入 needsSearchLanguageCodes。',
    '不要为了追求“官方来源”而把你已经确定的常识译名标记为需要搜索。',
    '如果目标语言确实没有固定译名，但可以可靠直译或音译，也应直接给出并保持一致。',
    '必须返回每一个输入 sourceText；translations 可以只包含你确定的语言。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。',
    'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"},"needsSearchLanguageCodes":["zh-HK"]}]}。',
    '',
    JSON.stringify(
      {
        task: 'resolve_official_term_translations_from_model_knowledge',
        sourceLanguageCode: sourceLanguageCode || '',
        sourceTermRequests: buildTermRequestPromptRows(termRequests)
      },
      null,
      2
    )
  ].join('\n')
}

function buildOfficialTermSearchPrompt({ termRequests, sourceLanguageCode }) {
  return [
    '你是多语言博客 CMS 的互联网检索助手。',
    '本步骤只处理前一步无法通过模型内置知识可靠确认的缺失译名。',
    '只允许为 sourceTermRequests 中列出的 sourceText 和目标语言 code 使用 Google Search，不要检索请求之外的语言或名词。',
    '你需要为每个缺失项给出目标语言中的官方译名、正式译名、权威通行译名或稳定通用译名。',
    '优先采用官方网站、发行商、出版社、平台商、百科条目或权威媒体中已存在的正式译名。',
    '如果目标语言确实找不到官方译名，必须给出适合该目标语言的直译或音译。',
    '必须覆盖每一个输入 sourceText 下列出的每一个目标语言 code。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。',
    'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"}}]}。',
    '',
    JSON.stringify(
      {
        task: 'search_official_term_translations',
        sourceLanguageCode: sourceLanguageCode || '',
        sourceTermRequests: buildTermRequestPromptRows(termRequests)
      },
      null,
      2
    )
  ].join('\n')
}

function buildGeminiKnowledgeRequest(settings, prompt) {
  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [buildTextPart(prompt)]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: officialTermKnowledgeResponseJsonSchema
    }
  }
}

function buildGeminiSearchRequest(settings, prompt) {
  return {
    model: settings.model,
    contents: [
      {
        role: 'user',
        parts: [buildTextPart(prompt)]
      }
    ],
    tools: [{ google_search: {} }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: officialTermSearchResponseJsonSchema
    }
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
    resultTermMap.set(normalizedSourceText, {
      sourceText: termRequest.sourceText,
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
  requestUrl,
  cancellation,
  skipUsageLog
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const prompt = buildOfficialTermKnowledgePrompt({
    termRequests,
    sourceLanguageCode
  })
  const requestBody = buildGeminiKnowledgeRequest(settings, prompt)
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
      requestSummary,
      responseSummary,
      skipUsageLog
    })
    return {
      ...result,
      rawResponse: response
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
}

async function searchOfficialTermTranslationsWithInternet({
  settings,
  termRequests,
  sourceLanguageCode,
  requestUrl,
  cancellation,
  skipUsageLog
}) {
  const targetLanguageCodes = getTermRequestTargetLanguageCodes(termRequests)
  const prompt = buildOfficialTermSearchPrompt({
    termRequests,
    sourceLanguageCode
  })
  const requestBody = buildGeminiSearchRequest(settings, prompt)
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
    const resultData = parseSearchResponseText(extractedText?.text || '')
    const groundingMetadata = summarizeGroundingMetadata(response)
    const terms = normalizeSearchTerms(resultData, termRequests).map(term => {
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
      requestSummary,
      responseSummary,
      skipUsageLog
    })
    return {
      terms,
      rawResponse: response
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

async function searchOfficialTermTranslations(options = {}) {
  const sourceTerms = normalizeSourceTerms(options.sourceTerms)
  const targetLanguageCodes = normalizeTargetLanguageCodes(
    options.targetLanguageCodes
  )
  if (sourceTerms.length === 0 || targetLanguageCodes.length === 0) {
    return {
      provider: '',
      model: '',
      terms: []
    }
  }
  const termRequests = buildTermRequests(sourceTerms, targetLanguageCodes)

  const settings = await aiSettingsService.getInternetSearchRuntimeSettings()
  if (settings.provider !== 'gemini') {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '互联网搜索服务商暂不支持',
      'internetSearchProvider',
      400
    )
  }

  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
  const knowledgeResult = await resolveOfficialTermTranslationsFromKnowledge({
    settings,
    termRequests,
    sourceLanguageCode: options.sourceLanguageCode,
    requestUrl,
    cancellation: options.cancellation,
    skipUsageLog: options.skipUsageLog
  })

  let searchResult = {
    terms: [],
    rawResponse: null
  }
  if (knowledgeResult.missingTermRequests.length > 0) {
    searchResult = await searchOfficialTermTranslationsWithInternet({
      settings,
      termRequests: knowledgeResult.missingTermRequests,
      sourceLanguageCode: options.sourceLanguageCode,
      requestUrl,
      cancellation: options.cancellation,
      skipUsageLog: options.skipUsageLog
    })
  }

  return {
    provider: settings.provider,
    model: settings.model,
    terms: knowledgeResult.terms.concat(searchResult.terms),
    stats: {
      sourceTermCount: sourceTerms.length,
      targetLanguageCodes,
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
    }
  }
}

module.exports = {
  OPERATION_OFFICIAL_TERM_KNOWLEDGE,
  OPERATION_OFFICIAL_TERM_SEARCH,
  searchOfficialTermTranslations
}
