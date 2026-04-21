const { GoogleGenAI, Type } = require('@google/genai')
const logger = require('log4js').getLogger('translation')
const env = require('../config/env')
const { AppError } = require('../utils/errors')

// === 单例客户端 ===
let _client = null

/**
 * 获取 GoogleGenAI 单例
 * - 若配置 AI_GATEWAY_URL，则全部请求通过网关转发
 * - GEMINI_API_KEY 必须存在
 * @returns {GoogleGenAI}
 */
function getClient() {
  if (_client) return _client
  if (!env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY 未配置', 500, 'AI_CONFIG_MISSING')
  }
  const httpOptions = {}
  if (env.AI_GATEWAY_URL) {
    httpOptions.baseUrl = env.AI_GATEWAY_URL
  }
  _client = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions
  })
  return _client
}

// === 工具声明 ===

/**
 * submit_translation_segments
 * 结构化翻译批量回传。items[].segmentId 必须与服务端发出的列表完全对齐。
 */
const submitTranslationSegmentsTool = {
  name: 'submit_translation_segments',
  description:
    'Submit the translated text for every provided segment. The segmentId of each item MUST exactly match one of the segment IDs provided in the prompt. Do not invent new IDs, do not omit any ID, do not produce duplicates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description:
          'Translation results. Provide exactly one item per requested segmentId.',
        items: {
          type: Type.OBJECT,
          properties: {
            segmentId: {
              type: Type.STRING,
              description:
                'The segmentId provided by the caller. Must be copied verbatim.'
            },
            translatedText: {
              type: Type.STRING,
              description:
                'The translation of the source text. Preserve inline placeholders and whitespace semantics. Do not wrap with markdown fences.'
            }
          },
          required: ['segmentId', 'translatedText']
        }
      }
    },
    required: ['items']
  }
}

/**
 * submit_entity_translation_summary
 * 审计附言。不直接影响落库。
 */
const submitEntityTranslationSummaryTool = {
  name: 'submit_entity_translation_summary',
  description:
    'Optional audit trail for the translation call. Does NOT affect persistence.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entityType: { type: Type.STRING },
      entityId: { type: Type.STRING },
      fieldPath: { type: Type.STRING },
      notes: { type: Type.STRING }
    }
  }
}

const TOOL_DECLARATIONS = {
  submit_translation_segments: submitTranslationSegmentsTool,
  submit_entity_translation_summary: submitEntityTranslationSummaryTool
}

/**
 * 工具调用专用的 generateContent 封装。
 * 仅接受工具调用结果，不接受自由文本。
 *
 * @param {object} params
 * @param {string} [params.model]
 * @param {string} params.systemInstruction
 * @param {string} params.userText - 用户侧主提示
 * @param {string} params.toolName - 期望调用的工具名
 * @returns {Promise<{ functionCall:{name:string,args:object}|null, raw:any, model:string }>}
 */
async function callWithForcedTool(params) {
  const { systemInstruction, userText, toolName } = params
  if (!toolName || !TOOL_DECLARATIONS[toolName]) {
    throw new AppError(`未知的工具: ${toolName}`, 500, 'AI_TOOL_UNKNOWN')
  }
  const client = getClient()
  const model = params.model || env.GEMINI_MODEL

  const request = {
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }]
      }
    ],
    config: {
      systemInstruction,
      tools: [
        {
          functionDeclarations: [TOOL_DECLARATIONS[toolName]]
        }
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [toolName]
        }
      },
      thinkingConfig: {
        thinkingBudget: env.GEMINI_THINKING_BUDGET
      }
    }
  }

  let response
  try {
    response = await client.models.generateContent(request)
  } catch (err) {
    logger.error(`GenAI 调用失败: ${err && err.message}`)
    throw new AppError(
      `GenAI 调用失败: ${err && err.message}`,
      502,
      'AI_CALL_FAILED'
    )
  }

  const calls = response && response.functionCalls ? response.functionCalls : []
  const matched = calls.find(c => c && c.name === toolName)
  if (!matched) {
    throw new AppError(
      `AI 未返回预期的工具调用: ${toolName}`,
      502,
      'AI_TOOL_CALL_MISSING'
    )
  }

  return {
    functionCall: { name: matched.name, args: matched.args || {} },
    raw: response,
    model
  }
}

module.exports = {
  getClient,
  callWithForcedTool,
  TOOL_DECLARATIONS
}
