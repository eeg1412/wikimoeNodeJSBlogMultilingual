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

const OPERATION_OFFICIAL_TERM_SEARCH = 'proper-noun.official-translation.search'

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

function buildOfficialTermSearchPrompt({
  sourceTerms,
  targetLanguageCodes,
  sourceLanguageCode
}) {
  return [
    '你是多语言博客 CMS 的互联网检索助手。',
    '你需要为每个专有名词、作品名、角色名、地点名、组织名或产品名给出目标语言中的官方译名、正式译名或权威通行译名。',
    '请先根据你已知的可靠知识判断译名；如果你确定对应目标语言中的官方译名或权威通行译名，可以直接输出，不需要联网搜索。',
    '只有当你不确定某个 sourceText 在某个目标语言 code 下的官方译名、正式译名或权威通行译名时，才使用 Google Search 检索确认。',
    '优先采用官方网站、发行商、出版社、平台商、百科条目或权威媒体中已存在的正式译名。',
    '如果目标语言确实找不到官方译名，必须给出适合该目标语言的直译或音译。',
    '必须覆盖每一个输入 sourceText 和每一个目标语言 code。',
    '只返回合法 JSON，不要使用 Markdown，不要解释。',
    'JSON 格式固定为：{"terms":[{"sourceText":"原名","translations":{"zh-CN":"译名"}}]}。',
    '',
    JSON.stringify(
      {
        task: 'search_official_term_translations',
        sourceLanguageCode: sourceLanguageCode || '',
        targetLanguages: buildTargetLanguagePromptRows(targetLanguageCodes),
        sourceTerms
      },
      null,
      2
    )
  ].join('\n')
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

function parseSearchResponseText(rawText) {
  const text = normalizeString(rawText, 200000)
  if (!text) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'Gemini 联网搜索没有返回内容',
      'geminiInternetSearch',
      502
    )
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'Gemini 联网搜索返回的 JSON 解析失败',
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

function normalizeSearchTerms(resultData, sourceTerms, targetLanguageCodes) {
  if (!resultData || typeof resultData !== 'object') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'Gemini 联网搜索 JSON 根节点必须是对象',
      'geminiInternetSearch',
      502
    )
  }
  if (!Array.isArray(resultData.terms)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'Gemini 联网搜索结果缺少 terms 数组',
      'geminiInternetSearch',
      502
    )
  }

  const requestedTermMap = new Map()
  sourceTerms.forEach(sourceText => {
    requestedTermMap.set(
      properNounTranslationService.buildNormalizedSourceText(sourceText),
      sourceText
    )
  })

  const resultTermMap = new Map()
  resultData.terms.forEach(termItem => {
    const sourceText = properNounTranslationService.normalizeSourceText(
      termItem?.sourceText
    )
    const normalizedSourceText =
      properNounTranslationService.buildNormalizedSourceText(sourceText)
    if (!sourceText || !requestedTermMap.has(normalizedSourceText)) {
      return
    }
    const translations = {}
    targetLanguageCodes.forEach(languageCode => {
      const translatedText = normalizeString(
        termItem?.translations?.[languageCode],
        300
      )
      if (translatedText) {
        translations[languageCode] = translatedText
      }
    })
    resultTermMap.set(normalizedSourceText, {
      sourceText: requestedTermMap.get(normalizedSourceText),
      translations
    })
  })

  const missingParts = []
  requestedTermMap.forEach((sourceText, normalizedSourceText) => {
    const resultTerm = resultTermMap.get(normalizedSourceText)
    if (!resultTerm) {
      missingParts.push(sourceText)
      return
    }
    targetLanguageCodes.forEach(languageCode => {
      if (!resultTerm.translations[languageCode]) {
        missingParts.push(`${sourceText}/${languageCode}`)
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
  await recordGeminiUsageLog({
    settings: options.settings,
    operation: OPERATION_OFFICIAL_TERM_SEARCH,
    status: options.status,
    response: options.response,
    error: options.error,
    sourceLanguageCode: options.sourceLanguageCode,
    targetLanguageCode: options.targetLanguageCodes?.join(','),
    meta: {
      termCount: options.termCount || 0,
      targetLanguageCodes: options.targetLanguageCodes || [],
      requestSummary: options.requestSummary || null,
      responseSummary: options.responseSummary || null
    },
    failureCode: options.failureCode,
    failureReason: options.failureReason,
    resultType: 'json'
  })
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

  const settings = await aiSettingsService.getInternetSearchRuntimeSettings()
  if (settings.provider !== 'gemini') {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '互联网搜索服务商暂不支持',
      'internetSearchProvider',
      400
    )
  }

  const prompt = buildOfficialTermSearchPrompt({
    sourceTerms,
    targetLanguageCodes,
    sourceLanguageCode: options.sourceLanguageCode
  })
  const requestUrl = buildGeminiNativeGenerateContentUrl(settings)
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
      { cancellation: options.cancellation }
    )
    const responseSummary = summarizeGeminiNativeResponse(response)
    const extractedText = extractTextFromGeminiNativeResponse(response)
    const resultData = parseSearchResponseText(extractedText?.text || '')
    const groundingMetadata = summarizeGroundingMetadata(response)
    const terms = normalizeSearchTerms(
      resultData,
      sourceTerms,
      targetLanguageCodes
    ).map(term => {
      return {
        ...term,
        searchMetadata: groundingMetadata
      }
    })
    await recordUsage({
      settings,
      status: 'success',
      response,
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCodes,
      termCount: sourceTerms.length,
      requestSummary,
      responseSummary,
      skipUsageLog: options.skipUsageLog
    })
    return {
      provider: settings.provider,
      model: settings.model,
      terms,
      rawResponse: response
    }
  } catch (error) {
    await recordUsage({
      settings,
      status: 'error',
      error,
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCodes,
      termCount: sourceTerms.length,
      requestSummary,
      failureCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
      failureReason: error?.message || '',
      skipUsageLog: options.skipUsageLog
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

module.exports = {
  OPERATION_OFFICIAL_TERM_SEARCH,
  searchOfficialTermTranslations
}
