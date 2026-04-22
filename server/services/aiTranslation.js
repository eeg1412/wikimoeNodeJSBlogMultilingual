import { GoogleGenAI } from '@google/genai'
import { getSystemConfig } from '../config/globalConfig.js'
import TranslationMemory from '../mongodb/models/translationMemory.js'
import AiTranslationLog from '../mongodb/models/aiTranslationLog.js'
import {
  SUPPORTED_LANGUAGES,
  FIELD_KIND
} from '../../common/constants/index.js'
import { creatSha256Str } from '../utils/utils.js'
import log4js from 'log4js'

const logger = log4js.getLogger('system')

const LANGUAGE_NAMES = {
  en: 'English',
  jp: 'Japanese',
  tw: 'Traditional Chinese (Taiwan)'
}

/**
 * 构建翻译提示词
 */
function buildTranslatePrompt(targetLanguage, fieldKind) {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage
  const fieldDesc =
    fieldKind === FIELD_KIND.CONTENT_HTML
      ? 'rich text HTML content'
      : 'plain text'

  return `You are a professional blog content translator. Translate the provided ${fieldDesc} into ${langName}. 
Rules:
- Preserve all HTML tags and attributes exactly as-is (for rich text)
- Preserve markdown formatting if present
- Do not add explanations or extra content
- Return ONLY the translated text
- Translate naturally and accurately, maintaining the original tone and style`
}

/**
 * 调用 Google GenAI（tool calling 模式）翻译文本
 * @param {object} params
 * @param {string} params.sourceText
 * @param {string} params.targetLanguageCode
 * @param {string} params.fieldKind
 * @param {string} params.entityType
 * @param {string} params.entityId
 * @param {string} params.fieldPath
 * @returns {Promise<{ result: string, fromCache: boolean, tokenUsage: object }>}
 */
export async function translateField({
  sourceText,
  targetLanguageCode,
  fieldKind = FIELD_KIND.TEXT_FIELD,
  entityType = '',
  entityId = '',
  fieldPath = ''
}) {
  if (!sourceText || !sourceText.trim()) {
    return { result: '', fromCache: false, tokenUsage: {} }
  }

  if (!SUPPORTED_LANGUAGES.includes(targetLanguageCode)) {
    throw new Error(`不支持的目标语言: ${targetLanguageCode}`)
  }

  const sourceTextHash = creatSha256Str(sourceText)

  // 查翻译记忆
  const cached = await TranslationMemory.findOne({
    sourceTextHash,
    targetLanguageCode,
    fieldKind
  })
  if (cached && cached.approved) {
    return { result: cached.translatedText, fromCache: true, tokenUsage: {} }
  }

  const systemConfig = getSystemConfig()

  // 验证 AI 配置
  if (!systemConfig.aiApiKey) {
    throw new Error('AI API Key 未配置 (system.aiApiKey)')
  }
  if (!systemConfig.aiModel) {
    throw new Error('AI 模型名称未配置 (system.aiModel)')
  }

  // 初始化 SDK
  const genAiOptions = { apiKey: systemConfig.aiApiKey }
  if (systemConfig.aiGatewayUrl) {
    genAiOptions.httpOptions = { baseUrl: systemConfig.aiGatewayUrl }
  }

  const ai = new GoogleGenAI(genAiOptions)

  // 定义 tool calling 的工具结构（@google/genai v1.x 规范）
  const translateTool = {
    functionDeclarations: [
      {
        name: 'submit_translation',
        description: 'Submit the translated text result',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            translated_text: {
              type: 'string',
              description: 'The translated text'
            }
          },
          required: ['translated_text']
        }
      }
    ]
  }

  const systemPrompt = buildTranslatePrompt(targetLanguageCode, fieldKind)

  const requestPayload = {
    model: systemConfig.aiModel,
    contents: [{ role: 'user', parts: [{ text: sourceText }] }],
    config: {
      systemInstruction: systemPrompt,
      tools: [translateTool],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: ['submit_translation']
        }
      }
    }
  }

  let responsePayload = null
  let tokenUsage = {}
  let translatedText = ''

  try {
    const response = await ai.models.generateContent(requestPayload)

    responsePayload = response

    // 从 tool call 提取结果
    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts || []
    const functionCallPart = parts.find(p => p.functionCall != null)

    if (!functionCallPart?.functionCall) {
      throw new Error('AI 未返回有效的 tool calling 结果')
    }

    const args = functionCallPart.functionCall.args
    translatedText = args?.translated_text || ''

    tokenUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      candidateTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0
    }
  } catch (err) {
    // 记录失败日志
    await AiTranslationLog.create({
      entityType,
      entityId,
      fieldPath,
      languageCode: targetLanguageCode,
      sourceHash: sourceTextHash,
      requestPayload: {
        model: requestPayload.model,
        fieldKind,
        sourceTextPreview: sourceText.substring(0, 2000)
      },
      responsePayload: {
        error: err.message,
        raw: responsePayload
      },
      normalizedResult: {
        text: ''
      },
      provider: 'google-genai',
      model: systemConfig.aiModel || '',
      promptVersion: 'v1',
      tokenUsage: {},
      success: false,
      errorMessage: err.message
    })
    throw new Error(`AI 翻译失败: ${err.message}`)
  }

  // 记录翻译日志
  await AiTranslationLog.create({
    entityType,
    entityId,
    fieldPath,
    languageCode: targetLanguageCode,
    sourceHash: sourceTextHash,
    requestPayload: {
      model: requestPayload.model,
      fieldKind,
      sourceTextPreview: sourceText.substring(0, 2000)
    },
    responsePayload,
    normalizedResult: {
      text: translatedText
    },
    provider: 'google-genai',
    model: systemConfig.aiModel || '',
    promptVersion: 'v1',
    tokenUsage,
    success: true,
    errorMessage: ''
  })

  // 写入翻译记忆（未 approved 状态）
  await TranslationMemory.findOneAndUpdate(
    { sourceTextHash, targetLanguageCode, fieldKind },
    {
      $set: {
        sourceText: sourceText.substring(0, 2000),
        translatedText,
        approved: false,
        lastTranslatedAt: new Date()
      }
    },
    { upsert: true }
  )

  return { result: translatedText, fromCache: false, tokenUsage }
}

/**
 * 批量翻译文章字段
 * @param {object} params
 * @param {object} params.post - Post 文档
 * @param {string[]} params.fields - 要翻译的字段路径
 * @param {string} params.targetLanguageCode
 * @returns {Promise<{ updates: object, warnings: string[] }>}
 */
export async function translatePostFields({
  post,
  fields,
  targetLanguageCode
}) {
  const updates = {}
  const warnings = []

  const fieldKindMap = {
    title: FIELD_KIND.TITLE,
    excerpt: FIELD_KIND.EXCERPT,
    content: FIELD_KIND.CONTENT_HTML
  }

  for (const field of fields) {
    const sourceText = post[field]
    if (!sourceText) continue

    const kind = fieldKindMap[field] || FIELD_KIND.TEXT_FIELD
    try {
      const { result, fromCache } = await translateField({
        sourceText,
        targetLanguageCode,
        fieldKind: kind,
        entityType: 'Post',
        entityId: String(post._id),
        fieldPath: field
      })
      updates[field] = result
      if (fromCache) {
        logger.debug(`[翻译记忆] Post ${post._id} .${field} 命中缓存`)
      }
    } catch (err) {
      warnings.push(`字段 ${field} 翻译失败: ${err.message}`)
    }
  }

  return { updates, warnings }
}
