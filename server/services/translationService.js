const logger = require('log4js').getLogger('translation')
const { AITranslationLogs } = require('../mongodb/models')
const { LANGUAGE_LABELS } = require('@wikimoe-ml/common/constants')
const { AppError } = require('../utils/errors')
const { getOption } = require('../utils/options')
const env = require('../config/env')

const { callWithForcedTool } = require('./genaiClient')
const memory = require('./translationMemoryService')
const {
  prepareHtmlTranslation,
  chunkSegments,
  isParseableHtml
} = require('./htmlTranslationExtractor')

const PROMPT_VERSION = 'v1-2026-04-21'
const SEGMENTS_TOOL = 'submit_translation_segments'

// ===== 内部工具 =====

async function buildSystemInstruction() {
  const extra = await getOption('translationSystemPrompt', '')
  const base =
    '你是一名专业的多语言技术博客翻译。请严格保留 Markdown/HTML 结构、变量名、代码块与占位符，只翻译自然语言文本。' +
    '必须调用 submit_translation_segments 工具回传结果，不得输出自由文本。' +
    '每个 segmentId 必须原样复制，不得新增、删除、重命名或合并。' +
    '保持 URL、邮箱、代码、标签、占位符、转义序列完全不变。'
  if (extra && typeof extra === 'string' && extra.trim()) {
    return base + '\n\n补充说明：\n' + extra.trim()
  }
  return base
}

function buildSegmentsUserText(params) {
  const { segments, targetLanguageCode, fieldKind, context } = params
  const langLabel = LANGUAGE_LABELS[targetLanguageCode] || targetLanguageCode
  const header = [
    '请将下列 segment 翻译为' + langLabel + '（' + targetLanguageCode + '）。',
    '字段类型：' + fieldKind + '。',
    context ? '上下文：' + context : null,
    '规则：',
    '1. 必须调用 ' + SEGMENTS_TOOL + ' 工具回传翻译。',
    '2. items 数量必须等于下方 segments 数量。',
    '3. 每一项的 segmentId 必须与下方完全一致。',
    '4. translatedText 中不要加入任何 Markdown 代码块或多余引号。'
  ]
    .filter(Boolean)
    .join('\n')

  const payload = segments.map(s => ({
    segmentId: s.segmentId,
    text: s.text,
    hint: s.context || undefined
  }))
  return header + '\n\nsegments:\n' + JSON.stringify(payload, null, 2)
}

/**
 * 校验 AI 返回的 items 是否对齐：
 *  - 每个 segmentId 必须存在于请求集合
 *  - 每个请求 segmentId 必须被覆盖一次且仅一次
 *  - translatedText 必须为字符串
 * 失败时抛 AppError。
 */
function validateAndNormalizeItems(requestSegments, items) {
  if (!Array.isArray(items)) {
    throw new AppError('AI 返回 items 非数组', 502, 'AI_TOOL_INVALID_ITEMS')
  }
  const requestedIds = new Set(requestSegments.map(s => s.segmentId))
  const seen = new Set()
  const result = {}
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new AppError('AI 返回的 item 无效', 502, 'AI_TOOL_INVALID_ITEM')
    }
    const id = item.segmentId
    const txt = item.translatedText
    if (typeof id !== 'string' || !requestedIds.has(id)) {
      throw new AppError(
        'AI 返回了未知的 segmentId: ' + id,
        502,
        'AI_TOOL_UNKNOWN_SEG'
      )
    }
    if (seen.has(id)) {
      throw new AppError(
        'AI 重复返回了 segmentId: ' + id,
        502,
        'AI_TOOL_DUPLICATE_SEG'
      )
    }
    if (typeof txt !== 'string') {
      throw new AppError(
        'AI 返回的 translatedText 非字符串: ' + id,
        502,
        'AI_TOOL_INVALID_TEXT'
      )
    }
    seen.add(id)
    result[id] = txt
  }
  if (seen.size !== requestedIds.size) {
    const missing = []
    requestedIds.forEach(id => {
      if (!seen.has(id)) missing.push(id)
    })
    throw new AppError(
      'AI 未覆盖所有 segmentId，缺失: ' + missing.join(','),
      502,
      'AI_TOOL_MISSING_SEG',
      { missing }
    )
  }
  return result
}

async function writeLog(entry) {
  try {
    await AITranslationLogs.create(entry)
  } catch (err) {
    logger.warn('AI 翻译日志写入失败：' + (err && err.message))
  }
}

// ===== 对外能力 =====

/**
 * 批量翻译一组 segments（标题/摘要/实体字段/HTML 抽取段等通用入口）。
 * 流程：
 *   1. 先在 translationMemories 中查 approved 缓存
 *   2. 未命中的集中一次工具调用，必要时按字符/数量拆批
 *   3. 翻译结果 upsert 到 TM（approved=false）
 *   4. 每次 AI 调用写 aiTranslationLogs
 *
 * @param {object} params
 * @param {Array<{segmentId:string,text:string,context?:string}>} params.segments
 * @param {string} params.targetLanguageCode
 * @param {string} params.fieldKind - 用于 TM 与日志（如 'title','html_segment'）
 * @param {string} [params.context] - 额外上下文提示
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {string} [params.fieldPath]
 * @param {string} [params.operatorAdminId]
 * @returns {Promise<{ translations: Record<string,string>, stats:{memoryHits:number,aiCalls:number,aiSegments:number} }>}
 */
async function translateSegments(params) {
  const segments = Array.isArray(params.segments) ? params.segments : []
  if (!segments.length) {
    return {
      translations: {},
      stats: { memoryHits: 0, aiCalls: 0, aiSegments: 0 }
    }
  }
  const targetLanguageCode = params.targetLanguageCode
  const fieldKind = params.fieldKind
  if (!targetLanguageCode || !fieldKind) {
    throw new AppError(
      '翻译入参缺少 targetLanguageCode / fieldKind',
      400,
      'BAD_REQUEST'
    )
  }

  const translations = {}
  const stats = { memoryHits: 0, aiCalls: 0, aiSegments: 0 }

  // 1. 记忆查找
  const lookups = await memory.lookupApprovedMany(
    segments.map(s => ({ sourceText: s.text })),
    targetLanguageCode,
    fieldKind
  )
  const pendingSegments = []
  segments.forEach((seg, idx) => {
    const hit = lookups[idx]
    if (hit.hit) {
      translations[seg.segmentId] = hit.translatedText
      stats.memoryHits += 1
    } else {
      pendingSegments.push(seg)
    }
  })

  if (!pendingSegments.length) {
    return { translations, stats }
  }

  // 2. 分批调用
  const maxSegments = await getOption('translationHtmlBatchMaxSegments', 80)
  const maxChars = await getOption('translationHtmlBatchMaxChars', 6000)
  const batches = chunkSegments(pendingSegments, {
    maxSegments,
    maxChars
  })

  const systemInstruction = await buildSystemInstruction()

  for (const batch of batches) {
    const userText = buildSegmentsUserText({
      segments: batch,
      targetLanguageCode,
      fieldKind,
      context: params.context || ''
    })
    const logBase = {
      entityType: params.entityType || '',
      entityId: params.entityId || null,
      fieldPath: params.fieldPath || '',
      languageCode: targetLanguageCode,
      provider: 'google-genai',
      model: env.GEMINI_MODEL,
      promptVersion: PROMPT_VERSION,
      operatorAdminId: params.operatorAdminId || null
    }

    let callResult
    try {
      callResult = await callWithForcedTool({
        systemInstruction,
        userText,
        toolName: SEGMENTS_TOOL
      })
    } catch (err) {
      await writeLog(
        Object.assign({}, logBase, {
          requestPayload: {
            segments: batch.map(s => ({
              segmentId: s.segmentId,
              length: s.text.length
            })),
            fieldKind
          },
          responsePayload: null,
          normalizedResult: null,
          tokenUsage: null,
          success: false,
          errorMessage: err && err.message ? err.message : 'unknown'
        })
      )
      throw err
    }

    stats.aiCalls += 1
    stats.aiSegments += batch.length

    let normalizedMap
    try {
      const items =
        callResult.functionCall.args && callResult.functionCall.args.items
      normalizedMap = validateAndNormalizeItems(batch, items)
    } catch (err) {
      await writeLog(
        Object.assign({}, logBase, {
          requestPayload: {
            segments: batch.map(s => ({
              segmentId: s.segmentId,
              length: s.text.length
            })),
            fieldKind
          },
          responsePayload:
            callResult.raw && callResult.raw.functionCalls
              ? callResult.raw.functionCalls
              : null,
          normalizedResult: null,
          tokenUsage: (callResult.raw && callResult.raw.usageMetadata) || null,
          success: false,
          errorMessage: err && err.message ? err.message : 'validation failed'
        })
      )
      throw err
    }

    // 写回 translations & 更新 TM
    for (const seg of batch) {
      const t = normalizedMap[seg.segmentId]
      translations[seg.segmentId] = t
      try {
        await memory.upsert({
          sourceText: seg.text,
          targetLanguageCode,
          fieldKind,
          translatedText: t,
          model: callResult.model,
          approved: false
        })
      } catch (err) {
        logger.warn(
          '翻译记忆 upsert 失败 segmentId=' +
            seg.segmentId +
            '：' +
            (err && err.message)
        )
      }
    }

    await writeLog(
      Object.assign({}, logBase, {
        requestPayload: {
          segments: batch.map(s => ({
            segmentId: s.segmentId,
            length: s.text.length
          })),
          fieldKind
        },
        responsePayload:
          callResult.raw && callResult.raw.functionCalls
            ? callResult.raw.functionCalls
            : null,
        normalizedResult: normalizedMap,
        tokenUsage: (callResult.raw && callResult.raw.usageMetadata) || null,
        success: true,
        errorMessage: ''
      })
    )
  }

  return { translations, stats }
}

/**
 * 单字段翻译（例如 title / excerpt / alt）。
 *
 * @param {object} params
 * @param {string} params.sourceText
 * @param {string} params.targetLanguageCode
 * @param {string} params.fieldKind
 * @param {string} [params.context]
 * @returns {Promise<{ translatedText:string, stats:object, fromMemory:boolean }>}
 */
async function translateField(params) {
  const sourceText = params.sourceText
  if (!sourceText || !String(sourceText).trim()) {
    return {
      translatedText: '',
      stats: { memoryHits: 0, aiCalls: 0, aiSegments: 0 },
      fromMemory: false
    }
  }
  const segments = [
    {
      segmentId: 'seg-field',
      text: String(sourceText),
      context: params.context || ''
    }
  ]
  const res = await translateSegments({
    segments,
    targetLanguageCode: params.targetLanguageCode,
    fieldKind: params.fieldKind,
    context: params.context,
    entityType: params.entityType,
    entityId: params.entityId,
    fieldPath: params.fieldPath,
    operatorAdminId: params.operatorAdminId
  })
  return {
    translatedText: res.translations['seg-field'] || '',
    stats: res.stats,
    fromMemory: res.stats.memoryHits === 1 && res.stats.aiCalls === 0
  }
}

/**
 * HTML 正文翻译：DOM 抽取 → 批量调用 → 回填 → 结果 HTML 必须仍可解析。
 *
 * @param {object} params
 * @param {string} params.html
 * @param {string} params.targetLanguageCode
 * @param {string} [params.fieldKind]
 * @param {string} [params.context]
 * @returns {Promise<{ translatedHtml:string, stats:object, segmentCount:number }>}
 */
async function translateHtml(params) {
  const html = params.html
  if (!html || !String(html).trim()) {
    return {
      translatedHtml: html || '',
      stats: { memoryHits: 0, aiCalls: 0, aiSegments: 0 },
      segmentCount: 0
    }
  }
  const prepared = prepareHtmlTranslation(html)
  if (prepared.isEmpty) {
    return {
      translatedHtml: html,
      stats: { memoryHits: 0, aiCalls: 0, aiSegments: 0 },
      segmentCount: 0
    }
  }
  const fieldKind = params.fieldKind || 'html_segment'
  const res = await translateSegments({
    segments: prepared.segments,
    targetLanguageCode: params.targetLanguageCode,
    fieldKind,
    context: params.context,
    entityType: params.entityType,
    entityId: params.entityId,
    fieldPath: params.fieldPath,
    operatorAdminId: params.operatorAdminId
  })
  const translatedHtml = prepared.applyTranslations(res.translations)

  // 回填后的 HTML 必须仍然可解析（plan 8.1 要求）
  if (!isParseableHtml(translatedHtml)) {
    throw new AppError(
      '翻译回填后的 HTML 解析失败',
      502,
      'TRANSLATION_HTML_PARSE_FAILED'
    )
  }

  return {
    translatedHtml,
    stats: res.stats,
    segmentCount: prepared.segments.length
  }
}

module.exports = {
  translateSegments,
  translateField,
  translateHtml,
  PROMPT_VERSION
}
