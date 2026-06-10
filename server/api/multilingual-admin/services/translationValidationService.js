const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const aiSettingsService = require('./aiSettingsService')
const textAiProviderRequestService = require('./textAiProviderRequestService')
const textTranslationWorkflowService = require('./textTranslationWorkflowService')
const aiUsageService = require('./aiUsageService')
const { runAiStepWithRetry } = require('./aiStepRetryService')
const translationAiJsonLogService = require('./translationAiJsonLogService')

const VALIDATION_WORKFLOW = 'verification'
const VALIDATION_STAGE = 'ValidateTranslation'
const VALIDATION_OPERATION = 'translation.verification'
const VALIDATION_GUIDELINE_SCHEMA = 'wikimoe.translation.validation.guideline'

// 单条原文/译文在全局速览中的文本摘要上限（字符）。
const OVERVIEW_ENTRY_TEXT_LIMIT = 600
// 单次全局速览请求允许的总览文本上限（字符）。超出则按块 map-reduce 折叠。
const OVERVIEW_BLOCK_CHAR_LIMIT = 18000
// 校验报告中单条修正前后预览文本上限（字符）。
const CORRECTION_PREVIEW_LIMIT = 160

function getJobId(job) {
  if (!job) {
    return ''
  }
  if (job._id) {
    return String(job._id)
  }
  if (job.id) {
    return String(job.id)
  }
  return ''
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value
}

function truncateText(text, limit) {
  const normalized = normalizeText(text).replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) {
    return normalized
  }
  return `${normalized.slice(0, limit)}…`
}

function collectRichTextNodeText(node, parts) {
  if (!node || typeof node !== 'object') {
    return
  }
  if (typeof node.text === 'string' && node.text.trim()) {
    parts.push(node.text)
  }
  if (
    node.translatableAttrs &&
    typeof node.translatableAttrs === 'object' &&
    !Array.isArray(node.translatableAttrs)
  ) {
    Object.values(node.translatableAttrs).forEach(attrValue => {
      if (typeof attrValue === 'string' && attrValue.trim()) {
        parts.push(attrValue)
      }
    })
  }
  if (Array.isArray(node.children)) {
    node.children.forEach(childNode =>
      collectRichTextNodeText(childNode, parts)
    )
  }
}

// 只读地把任意条目值提取成可读纯文本，仅用于全局速览与报告预览，不回写结构。
function extractReadableText(value, valueType) {
  if (valueType === 'plainText' || valueType === 'richTextLite') {
    return normalizeText(value)
  }
  if (value && typeof value === 'object') {
    const parts = []
    collectRichTextNodeText(value, parts)
    return parts.join(' ')
  }
  return normalizeText(value)
}

// 按 id 把原文条目与译文条目配对。
function buildValidationPairs(sourceEntries, targetEntries) {
  const targetMap = new Map()
  targetEntries.forEach(entry => {
    if (entry && entry.id) {
      targetMap.set(String(entry.id), entry)
    }
  })

  const pairs = []
  sourceEntries.forEach(entry => {
    if (!entry || !entry.id) {
      return
    }
    const targetEntry = targetMap.get(String(entry.id))
    if (!targetEntry) {
      return
    }
    pairs.push({
      id: String(entry.id),
      label: entry.label || entry.fieldName || entry.id,
      scope: entry.scope || '',
      fieldName: entry.fieldName || '',
      valueType: entry.valueType || 'plainText',
      sourceText: extractReadableText(entry.value, entry.valueType),
      targetText: extractReadableText(targetEntry.value, targetEntry.valueType)
    })
  })
  return pairs
}

// 把配对条目渲染成可分块的速览行，超大文本按上限截断（速览只需把握全局，不需要全文）。
function buildOverviewBlocks(pairs) {
  const lines = pairs.map(pair => {
    const sourceText = truncateText(pair.sourceText, OVERVIEW_ENTRY_TEXT_LIMIT)
    const targetText = truncateText(pair.targetText, OVERVIEW_ENTRY_TEXT_LIMIT)
    return [
      `# entryId: ${pair.id}`,
      `字段: ${pair.label}（${pair.fieldName || pair.scope || 'field'}）`,
      `原文: ${sourceText}`,
      `译文: ${targetText}`
    ].join('\n')
  })

  const blocks = []
  let current = []
  let currentLength = 0
  lines.forEach(line => {
    const lineLength = line.length + 2
    if (
      current.length > 0 &&
      currentLength + lineLength > OVERVIEW_BLOCK_CHAR_LIMIT
    ) {
      blocks.push(current.join('\n\n'))
      current = []
      currentLength = 0
    }
    current.push(line)
    currentLength += lineLength
  })
  if (current.length > 0) {
    blocks.push(current.join('\n\n'))
  }
  if (blocks.length === 0) {
    blocks.push('')
  }
  return blocks
}

function buildLanguageLine(sourceLanguageCode, targetLanguageCode) {
  const source = sourceLanguageCode || ''
  const target = targetLanguageCode || ''
  return `源语言: ${source}，目标语言: ${target}`
}

function buildGuidelineSystemPrompt() {
  return [
    '你是多语言博客的翻译质检负责人。',
    '你会先纵观一篇文章全部翻译产物的速览，找出需要全局统一的术语、整体风格基调，以及疑似存在的翻译问题。',
    '重要：速览里每一条的原文与译文都可能为了压缩上下文而被截断（以 … 结尾），这只是预览片段，不代表实际内容不完整或被裁断。',
    '禁止依据速览的截断判断译文存在“截断、缺失后半段、漏译大段内容”等完整性问题；逐条完整内容的精确校验会在后续阶段基于完整文本进行。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON，不要输出解释。',
    `返回 JSON 结构必须为：{ "schema": "${VALIDATION_GUIDELINE_SCHEMA}", "summary": "用一段简洁中文总结本次译文的整体质量、主要问题与需要重点修正的方向", "termGlossary": [{ "source": "原文术语", "target": "建议统一译法", "note": "可选说明" }], "styleNotes": "整体风格与语气基调说明", "suspectedIssues": [{ "entryId": "条目id", "issueType": "inconsistent|inaccurate|missing|tone|other", "note": "问题简述" }] }`,
    'summary 用一段简洁中文总结整体翻译质量与主要发现，供人工审核快速了解；不要在 summary 里描述因预览截断导致的“内容不完整”。',
    'termGlossary 只收录需要在全文统一的术语、专有名词或反复出现的关键表达。',
    'suspectedIssues 只列出术语前后不一致、风格语气偏差、明显语义错误或矛盾等问题，entryId 必须来自速览中出现的 entryId；不要包含由预览截断引起的内容缺失类误判。',
    '如果某一项没有内容，返回空数组或空字符串。'
  ].join('\n')
}

function buildGuidelineUserPrompt(
  sourceLanguageCode,
  targetLanguageCode,
  overviewText,
  partial
) {
  const header = partial
    ? '以下是该文章部分翻译产物的速览（全文已分块，这是其中一块）。请基于这一块产出局部校验指南。'
    : '以下是该文章全部翻译产物的速览。请基于全局产出校验指南。'
  return [
    header,
    buildLanguageLine(sourceLanguageCode, targetLanguageCode),
    '',
    overviewText
  ].join('\n')
}

function buildGuidelineMergeSystemPrompt() {
  return [
    '你是多语言博客的翻译质检负责人。',
    '你会收到同一篇文章按块产出的多份局部校验指南，需要合并成一份覆盖全局的校验指南。',
    '合并时要消除重复术语、统一冲突译法（保留更准确的一项并在 note 中说明），整合风格基调与疑似问题。',
    '各块指南来自被截断的速览片段，禁止保留或新增任何“译文截断、缺失后半段、漏译大段内容”等因预览截断而产生的完整性误判。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON，不要输出解释。',
    `返回 JSON 结构必须为：{ "schema": "${VALIDATION_GUIDELINE_SCHEMA}", "summary": "用一段简洁中文总结整体翻译质量与主要发现", "termGlossary": [{ "source": "", "target": "", "note": "" }], "styleNotes": "", "suspectedIssues": [{ "entryId": "", "issueType": "", "note": "" }] }`
  ].join('\n')
}

function normalizeGuideline(parsed) {
  const guideline = {
    schema: VALIDATION_GUIDELINE_SCHEMA,
    summary: '',
    termGlossary: [],
    styleNotes: '',
    suspectedIssues: []
  }
  if (!parsed || typeof parsed !== 'object') {
    return guideline
  }
  if (typeof parsed.summary === 'string') {
    guideline.summary = truncateText(parsed.summary, 2000)
  }
  if (Array.isArray(parsed.termGlossary)) {
    guideline.termGlossary = parsed.termGlossary
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        source: truncateText(item.source, 200),
        target: truncateText(item.target, 200),
        note: truncateText(item.note, 300)
      }))
      .filter(item => item.source || item.target)
  }
  if (typeof parsed.styleNotes === 'string') {
    guideline.styleNotes = truncateText(parsed.styleNotes, 2000)
  }
  if (Array.isArray(parsed.suspectedIssues)) {
    guideline.suspectedIssues = parsed.suspectedIssues
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        entryId: truncateText(item.entryId, 120),
        issueType: truncateText(item.issueType, 40),
        note: truncateText(item.note, 400)
      }))
      .filter(item => item.entryId || item.note)
  }
  return guideline
}

async function recordValidationUsage({
  job,
  settings,
  responseResult,
  status,
  stage,
  sourceLanguageCode,
  targetLanguageCode
}) {
  try {
    await aiUsageService.recordAiUsageLog({
      provider: textAiProviderRequestService.getProviderCode(settings),
      model:
        responseResult.model || settings.model || settings.deepSeekModel || '',
      operation: VALIDATION_OPERATION,
      status,
      requestId: responseResult.requestId || '',
      postId: job?.target?.postId,
      translationGroupId: job?.translationGroupId,
      sourceSnapshotId: job?.source?.snapshotId || job?.source?.postId,
      sourceLanguageCode: sourceLanguageCode || '',
      targetLanguageCode: targetLanguageCode || '',
      usage: responseResult.usage || {},
      rawResponse: responseResult.rawResponse,
      meta: {
        jobId: getJobId(job),
        stage,
        httpStatusCode: responseResult.statusCode
      }
    })
  } catch (error) {
    // 用量记录失败不应阻断校验主流程，但要保留错误用于排查。
    console.error('记录校验 AI 用量失败：', error && error.message)
  }
}

async function requestGuidelineFromAi({
  job,
  settings,
  messages,
  stepKey,
  stepLabel,
  cancellation,
  onStatus,
  sourceLanguageCode,
  targetLanguageCode
}) {
  const { requestBody, requestUrl } =
    textAiProviderRequestService.buildJsonRequestBody(settings, messages, {})

  const stepResult = await runAiStepWithRetry(
    async () => {
      const responseResult =
        await textAiProviderRequestService.requestProviderJson(
          settings,
          requestBody,
          requestUrl,
          { cancellation }
        )
      const isSuccessStatus =
        responseResult.statusCode >= 200 && responseResult.statusCode < 300
      const usageStatus =
        isSuccessStatus && !responseResult.parseError ? 'success' : 'error'
      await recordValidationUsage({
        job,
        settings,
        responseResult,
        status: usageStatus,
        stage: stepKey,
        sourceLanguageCode,
        targetLanguageCode
      })
      if (!isSuccessStatus || responseResult.parseError) {
        const message =
          responseResult.rawResponse?.error?.message ||
          `${textAiProviderRequestService.getProviderLabel(settings)} 校验请求失败：${responseResult.statusCode}`
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          message,
          textAiProviderRequestService.getProviderErrorField(settings),
          502,
          { retryable: true }
        )
      }
      const parsed = textTranslationWorkflowService.parseAiContentText(
        responseResult.contentText,
        settings,
        responseResult.finishReason
      )
      return { responseResult, parsed }
    },
    {
      stepKey,
      stepLabel,
      sourceLanguageCode,
      targetLanguageCode,
      cancellation,
      onStatus
    }
  )
  const guideline = normalizeGuideline(stepResult.parsed)
  const aiJsonLog = translationAiJsonLogService.createAiJsonLog({
    operation: stepKey,
    stage: 'ValidationOverview',
    provider: textAiProviderRequestService.getProviderCode(settings),
    model:
      stepResult.responseResult.model ||
      settings.model ||
      settings.deepSeekModel ||
      '',
    requestId: stepResult.responseResult.requestId || '',
    sourceLanguageCode,
    targetLanguageCode,
    meta: {
      jobId: getJobId(job),
      stepKey,
      stepLabel
    },
    input: { messages },
    json: stepResult.parsed
  })
  return { guideline, aiJsonLog }
}

// 阶段 A：全局速览（上下文压缩）。把全部翻译产物压缩成小体积总览，
// 让校验 AI 先纵观全局产出一份小体积"全局校验指南"。总览过大时按块 map-reduce 折叠。
async function buildGlobalGuideline({
  job,
  pairs,
  settings,
  handlers,
  sourceLanguageCode,
  targetLanguageCode
}) {
  const blocks = buildOverviewBlocks(pairs)
  const cancellation = handlers?.cancellation

  if (blocks.length === 1) {
    if (handlers?.onStatus) {
      handlers.onStatus({
        message: '正在进行全局翻译校验速览'
      })
    }
    const singleResult = await requestGuidelineFromAi({
      job,
      settings,
      messages: [
        { role: 'system', content: buildGuidelineSystemPrompt() },
        {
          role: 'user',
          content: buildGuidelineUserPrompt(
            sourceLanguageCode,
            targetLanguageCode,
            blocks[0],
            false
          )
        }
      ],
      stepKey: 'validation.overview',
      stepLabel: '全局校验速览',
      cancellation,
      onStatus: handlers?.onStatus,
      sourceLanguageCode,
      targetLanguageCode
    })
    return {
      guideline: singleResult.guideline,
      aiJsonLogs: [singleResult.aiJsonLog]
    }
  }

  const partialGuidelines = []
  const aiJsonLogs = []
  for (let index = 0; index < blocks.length; index += 1) {
    if (handlers?.onStatus) {
      handlers.onStatus({
        message: `正在进行全局翻译校验速览（第 ${index + 1}/${blocks.length} 块）`
      })
    }
    const partialResult = await requestGuidelineFromAi({
      job,
      settings,
      messages: [
        { role: 'system', content: buildGuidelineSystemPrompt() },
        {
          role: 'user',
          content: buildGuidelineUserPrompt(
            sourceLanguageCode,
            targetLanguageCode,
            blocks[index],
            true
          )
        }
      ],
      stepKey: `validation.overview.block.${index + 1}`,
      stepLabel: `全局校验速览第 ${index + 1}/${blocks.length} 块`,
      cancellation,
      onStatus: handlers?.onStatus,
      sourceLanguageCode,
      targetLanguageCode
    })
    partialGuidelines.push(partialResult.guideline)
    aiJsonLogs.push(partialResult.aiJsonLog)
  }

  if (handlers?.onStatus) {
    handlers.onStatus({
      message: '正在合并全局校验指南'
    })
  }
  const mergeResult = await requestGuidelineFromAi({
    job,
    settings,
    messages: [
      { role: 'system', content: buildGuidelineMergeSystemPrompt() },
      {
        role: 'user',
        content: [
          '以下是同一篇文章按块产出的多份局部校验指南，请合并成一份全局校验指南。',
          buildLanguageLine(sourceLanguageCode, targetLanguageCode),
          '',
          JSON.stringify(partialGuidelines)
        ].join('\n')
      }
    ],
    stepKey: 'validation.overview.merge',
    stepLabel: '合并全局校验指南',
    cancellation,
    onStatus: handlers?.onStatus,
    sourceLanguageCode,
    targetLanguageCode
  })
  aiJsonLogs.push(mergeResult.aiJsonLog)
  return { guideline: mergeResult.guideline, aiJsonLogs }
}

// 把全局校验指南渲染成注入精校 prompt 的文本。
function renderGuidelinePrompt(guideline) {
  if (!guideline) {
    return ''
  }
  const lines = [
    '【全局校验指南】',
    '以下指南来自对本篇全部翻译产物的全局速览，精校时必须遵守。'
  ]
  if (guideline.summary) {
    lines.push(`整体校验结论：${guideline.summary}`)
  }
  if (
    Array.isArray(guideline.termGlossary) &&
    guideline.termGlossary.length > 0
  ) {
    lines.push('术语统一表（原文 => 统一译法）：')
    guideline.termGlossary.forEach(item => {
      const note = item.note ? `（${item.note}）` : ''
      lines.push(`- ${item.source} => ${item.target}${note}`)
    })
  }
  if (guideline.styleNotes) {
    lines.push(`整体风格与语气基调：${guideline.styleNotes}`)
  }
  if (
    Array.isArray(guideline.suspectedIssues) &&
    guideline.suspectedIssues.length > 0
  ) {
    lines.push('疑似问题清单（请重点核查并修正对应条目）：')
    guideline.suspectedIssues.forEach(item => {
      lines.push(
        `- 条目 ${item.entryId} [${item.issueType || 'issue'}]：${item.note}`
      )
    })
  }
  return lines.join('\n')
}

function resolveVerificationPrompt(settings, languageCode) {
  const promptParts = []
  if (settings && typeof settings.verificationDefaultPrompt === 'string') {
    const defaultPrompt = settings.verificationDefaultPrompt.trim()
    if (defaultPrompt) {
      promptParts.push(defaultPrompt)
    }
  }
  if (
    settings &&
    settings.verificationLanguagePrompts &&
    typeof settings.verificationLanguagePrompts === 'object' &&
    typeof settings.verificationLanguagePrompts[languageCode] === 'string'
  ) {
    const languagePrompt =
      settings.verificationLanguagePrompts[languageCode].trim()
    if (languagePrompt) {
      promptParts.push(languagePrompt)
    }
  }
  return promptParts.join('\n\n')
}

// 校验精校沿用校验 AI 的连接与模型，但翻译规范（站点默认提示词、目标语言默认提示词）
// 复用主翻译配置，确保校验后的译文与主翻译保持同一套语言规范。
function buildVerificationRuntimeSettings(verificationSettings, mainSettings) {
  return {
    ...verificationSettings,
    mainTranslationDefaultPrompt: mainSettings.mainTranslationDefaultPrompt,
    mainTranslationLanguagePrompts: mainSettings.mainTranslationLanguagePrompts
  }
}

// 构造精校阶段的请求体：原文作为 v，已生成译文作为 c，校验指令与全局指南作为补充 prompt。
function buildCorrectionEntries(sourceEntries, targetEntries) {
  const targetMap = new Map()
  targetEntries.forEach(entry => {
    if (entry && entry.id) {
      targetMap.set(String(entry.id), entry)
    }
  })

  const entries = []
  sourceEntries.forEach(entry => {
    if (!entry || !entry.id) {
      return
    }
    const targetEntry = targetMap.get(String(entry.id))
    if (!targetEntry) {
      return
    }
    entries.push({
      ...entry,
      currentValue: targetEntry.value
    })
  })
  return entries
}

function buildCorrectionPrompt(verificationSettings, guideline, languageCode) {
  const promptParts = []
  const verificationPrompt = resolveVerificationPrompt(
    verificationSettings,
    languageCode
  )
  if (verificationPrompt) {
    promptParts.push(verificationPrompt)
  }
  const guidelinePrompt = renderGuidelinePrompt(guideline)
  if (guidelinePrompt) {
    promptParts.push(guidelinePrompt)
  }
  return promptParts.join('\n\n')
}

function serializeEntryValue(value, valueType) {
  if (valueType === 'plainText' || valueType === 'richTextLite') {
    return normalizeText(value)
  }
  try {
    return JSON.stringify(value)
  } catch (error) {
    return ''
  }
}

// 对比精校前后译文，生成校验报告。
function buildValidationReport({
  guideline,
  sourceEntries,
  beforeEntries,
  afterEntries,
  provider,
  model
}) {
  const sourceMap = new Map()
  sourceEntries.forEach(entry => {
    if (entry && entry.id) {
      sourceMap.set(String(entry.id), entry)
    }
  })
  const beforeMap = new Map()
  beforeEntries.forEach(entry => {
    if (entry && entry.id) {
      beforeMap.set(String(entry.id), entry)
    }
  })

  const corrections = []
  afterEntries.forEach(afterEntry => {
    if (!afterEntry || !afterEntry.id) {
      return
    }
    const id = String(afterEntry.id)
    const beforeEntry = beforeMap.get(id)
    if (!beforeEntry) {
      return
    }
    const valueType =
      afterEntry.valueType || beforeEntry.valueType || 'plainText'
    const beforeSerialized = serializeEntryValue(beforeEntry.value, valueType)
    const afterSerialized = serializeEntryValue(afterEntry.value, valueType)
    if (beforeSerialized === afterSerialized) {
      return
    }
    const sourceEntry = sourceMap.get(id)
    corrections.push({
      id,
      scope: afterEntry.scope || beforeEntry.scope || '',
      fieldName: afterEntry.fieldName || beforeEntry.fieldName || '',
      label: afterEntry.label || beforeEntry.label || id,
      sourcePreview: truncateText(
        extractReadableText(sourceEntry ? sourceEntry.value : '', valueType),
        CORRECTION_PREVIEW_LIMIT
      ),
      beforePreview: truncateText(
        extractReadableText(beforeEntry.value, valueType),
        CORRECTION_PREVIEW_LIMIT
      ),
      afterPreview: truncateText(
        extractReadableText(afterEntry.value, valueType),
        CORRECTION_PREVIEW_LIMIT
      )
    })
  })

  return {
    enabled: true,
    status: 'completed',
    provider: provider || '',
    model: model || '',
    summary: guideline.summary || '',
    guideline: {
      summary: guideline.summary || '',
      termGlossary: guideline.termGlossary,
      styleNotes: guideline.styleNotes,
      suspectedIssues: guideline.suspectedIssues
    },
    stats: {
      totalEntries: afterEntries.length,
      changedEntries: corrections.length,
      termCount: guideline.termGlossary.length,
      suspectedIssueCount: guideline.suspectedIssues.length
    },
    corrections,
    completedAt: new Date().toISOString()
  }
}

function buildSkippedValidation(reason) {
  return {
    enabled: true,
    status: 'skipped',
    reason: reason || '',
    summary: '',
    guideline: {
      summary: '',
      termGlossary: [],
      styleNotes: '',
      suspectedIssues: []
    },
    stats: {
      totalEntries: 0,
      changedEntries: 0,
      termCount: 0,
      suspectedIssueCount: 0
    },
    corrections: [],
    completedAt: new Date().toISOString()
  }
}

// 把精校 handlers 直接传给翻译内核。校验阶段的 AI 调用会通过内核的
// runAiStepWithRetry 步骤事件自动进入“查看 AI 工作流”视图。

/**
 * 校验并修正一份翻译产物。
 * @param {Object} params
 * @param {Object} params.job 翻译任务文档
 * @param {Object} params.handlers 由调用方构造的执行 handlers（含 onStatus / cancellation）
 * @param {Array} params.sourceEntries 原文条目（翻译输入）
 * @param {Object} params.payload 翻译产出 payload（含 entries）
 * @param {Object} params.target 目标定位信息 { mode: 'post'|'content', postId, contentId, contentType }
 * @returns {Promise<{ payload: Object, validation: Object, aiJsonLogs: Array }>}
 */
async function validateTranslationPayload({
  job,
  handlers,
  sourceEntries,
  payload,
  target
}) {
  const targetEntries = Array.isArray(payload?.entries) ? payload.entries : []
  const safeSourceEntries = Array.isArray(sourceEntries) ? sourceEntries : []
  const pairs = buildValidationPairs(safeSourceEntries, targetEntries)
  if (pairs.length === 0) {
    return {
      payload,
      validation: buildSkippedValidation('没有可校验的翻译条目'),
      aiJsonLogs: []
    }
  }

  const verificationSettings =
    await aiSettingsService.getVerificationRuntimeSettings()
  const mainSettings =
    await aiSettingsService.getMainTranslationRuntimeSettings()
  const provider =
    textAiProviderRequestService.getProviderCode(verificationSettings)
  const sourceLanguageCode =
    target?.sourceLanguageCode || job?.source?.languageCode
  const targetLanguageCode =
    target?.targetLanguageCode || job?.target?.languageCode

  // 阶段 A：全局速览，产出全局校验指南。
  const guidelineResult = await buildGlobalGuideline({
    job,
    pairs,
    settings: verificationSettings,
    handlers,
    sourceLanguageCode,
    targetLanguageCode
  })
  const guideline = guidelineResult.guideline
  const guidelineAiJsonLogs = Array.isArray(guidelineResult.aiJsonLogs)
    ? guidelineResult.aiJsonLogs
    : []

  // 阶段 B：分批精校，复用翻译内核保证富文本结构安全。
  const correctionEntries = buildCorrectionEntries(
    safeSourceEntries,
    targetEntries
  )
  if (correctionEntries.length === 0) {
    return {
      payload,
      validation: buildSkippedValidation('没有可精校的翻译条目'),
      aiJsonLogs: guidelineAiJsonLogs
    }
  }

  const mergedSettings = buildVerificationRuntimeSettings(
    verificationSettings,
    mainSettings
  )
  const correctionPrompt = buildCorrectionPrompt(
    verificationSettings,
    guideline,
    targetLanguageCode
  )

  const correctionBody = {
    sourceLanguageCode,
    targetLanguageCode,
    targetLanguageCodes: [targetLanguageCode],
    prompt: correctionPrompt,
    entries: correctionEntries,
    translationJobId: getJobId(job),
    cacheKey: getJobId(job),
    cacheScopeKey: target?.cacheScopeKey || 'validation',
    autoOrganizeOfficialTermGlossary: false,
    searchOfficialTermTranslations: false
  }

  const validationHandlers = handlers
  const overrideOptions = {
    runtimeSettings: mergedSettings,
    verificationMode: true,
    operation: VALIDATION_OPERATION
  }

  let correctionData = null
  if (target && target.mode === 'content') {
    correctionBody.contentId = target.contentId
    correctionBody.contentType = target.contentType || 'content'
    correctionData =
      await textTranslationWorkflowService.translateContentEntriesStream(
        correctionBody,
        validationHandlers,
        overrideOptions
      )
  } else {
    correctionBody.postId = String(target?.postId || job?.target?.postId || '')
    correctionData =
      await textTranslationWorkflowService.translatePostEntriesStream(
        correctionBody,
        validationHandlers,
        overrideOptions
      )
  }

  const correctedPayload = correctionData?.payload || payload
  const correctedEntries = Array.isArray(correctedPayload?.entries)
    ? correctedPayload.entries
    : []

  const validation = buildValidationReport({
    guideline,
    sourceEntries: safeSourceEntries,
    beforeEntries: targetEntries,
    afterEntries: correctedEntries,
    provider,
    model: correctionData?.model || ''
  })

  return {
    payload: correctedPayload,
    validation,
    aiJsonLogs: [
      ...guidelineAiJsonLogs,
      ...(Array.isArray(correctionData?.aiJsonLogs)
        ? correctionData.aiJsonLogs
        : [])
    ]
  }
}

module.exports = {
  VALIDATION_WORKFLOW,
  VALIDATION_STAGE,
  VALIDATION_OPERATION,
  validateTranslationPayload
}
