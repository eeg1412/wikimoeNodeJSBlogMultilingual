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
const translationOfficialTermGlossaryService = require('./translationOfficialTermGlossaryService')

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
// 差异分段中，未变化文本在变化点前后保留的上下文字符数。
const CORRECTION_DIFF_CONTEXT = 36
// 单个变化分段保留的最大字符数，超出则折叠尾部。
const CORRECTION_DIFF_CHANGED_LIMIT = 600
// 单侧（修正前 / 修正后）分段文本的总字符上限。
const CORRECTION_DIFF_SIDE_LIMIT = 2400
// 去除公共前后缀后，仍参与字符级 LCS 比对的中间文本上限，超出则改用按词（token）级 LCS。
const CORRECTION_DIFF_MIDDLE_LIMIT = 2000
// 按词级 LCS 比对时的 token 数上限，超出则整体视为变化（极端长文本的兜底）。
const CORRECTION_DIFF_TOKEN_LIMIT = 4000

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

// 把文本按指定段数等分（按比例切片）。源文与译文用相同段数切分，使同一段大致对应同一位置的
// 内容，避免因源文与译文长度不同而出现“某段只有译文、原文为空”的错位。
// 切点会尽量回退到最近的空白边界（块标签提取为可读文本后块之间会留有空白），避免把单词切成两半。
function splitTextIntoEqualParts(text, partCount) {
  const normalized = String(text == null ? '' : text)
  const chars = Array.from(normalized)
  if (partCount <= 1 || chars.length === 0) {
    return [normalized]
  }
  const targetSize = Math.ceil(chars.length / partCount)
  // 允许为了凑到空白边界而向前回退的最大字符数，避免回退过多产生过小分段。
  const maxBacktrack = Math.max(20, Math.floor(targetSize / 2))
  const parts = []
  let start = 0
  while (start < chars.length) {
    let end = Math.min(start + targetSize, chars.length)
    if (end < chars.length) {
      let adjusted = end
      const minEnd = end - maxBacktrack
      while (adjusted > start + 1 && adjusted > minEnd) {
        if (/\s/.test(chars[adjusted - 1])) {
          break
        }
        adjusted -= 1
      }
      // 仅当确实回退到了空白边界时才采用，否则保持原切点（避免极端长词导致分段过碎）。
      if (adjusted > start + 1 && /\s/.test(chars[adjusted - 1])) {
        end = adjusted
      }
    }
    parts.push(chars.slice(start, end).join(''))
    start = end
  }
  if (parts.length === 0) {
    parts.push('')
  }
  return parts
}

// 把配对条目渲染成可分块的速览行。长条目按比例切分为多段（源文与译文段数一致、逐段对应），
// 配合下方的分块 + 合并（map-reduce），让速览覆盖正文全文（而不是只截取开头），从而能发现
// 正文后段的术语不一致与翻译问题。
function buildOverviewBlocks(pairs) {
  const lines = []
  pairs.forEach(pair => {
    const sourceChars = Array.from(String(pair.sourceText || ''))
    const targetChars = Array.from(String(pair.targetText || ''))
    const maxLength = Math.max(sourceChars.length, targetChars.length)
    const segmentCount = Math.max(
      1,
      Math.ceil(maxLength / OVERVIEW_ENTRY_TEXT_LIMIT)
    )
    const sourceSegments = splitTextIntoEqualParts(
      pair.sourceText,
      segmentCount
    )
    const targetSegments = splitTextIntoEqualParts(
      pair.targetText,
      segmentCount
    )
    const renderSegmentCount = Math.max(
      sourceSegments.length,
      targetSegments.length
    )
    for (
      let segmentIndex = 0;
      segmentIndex < renderSegmentCount;
      segmentIndex += 1
    ) {
      const sourceText = sourceSegments[segmentIndex] || ''
      const targetText = targetSegments[segmentIndex] || ''
      const segmentLabel =
        renderSegmentCount > 1
          ? `（第 ${segmentIndex + 1}/${renderSegmentCount} 段）`
          : ''
      lines.push(
        [
          `# entryId: ${pair.id}${segmentLabel}`,
          `字段: ${pair.label}（${pair.fieldName || pair.scope || 'field'}）`,
          `原文: ${sourceText}`,
          `译文: ${targetText}`
        ].join('\n')
      )
    }
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
    '重要：超长正文会被切分成多段速览（标注“第 X/Y 段”），并可能分布在不同的速览块中；这些段落合起来覆盖全文，每一段都是该位置的真实完整片段，不是被裁断的残缺内容。',
    '禁止依据“看到的是其中一段”就判断译文存在“截断、缺失后半段、漏译大段内容”等完整性问题；逐条完整内容的精确校验会在后续阶段基于完整文本进行。',
    '判断术语前后是否一致、风格是否统一时，要综合同一 entryId 的所有段落（包括后段），不要只看开头段。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON，不要输出解释。',
    `返回 JSON 结构必须为：{ "schema": "${VALIDATION_GUIDELINE_SCHEMA}", "summary": "用一段简洁中文总结本次译文的整体质量、主要问题与需要重点修正的方向", "termGlossary": [{ "source": "原文术语", "target": "建议统一译法", "note": "可选说明" }], "styleNotes": "整体风格与语气基调说明", "suspectedIssues": [{ "entryId": "条目id", "issueType": "inconsistent|inaccurate|missing|tone|other", "note": "问题简述" }] }`,
    'summary 用一段简洁中文总结整体翻译质量与主要发现，供人工审核快速了解；不要在 summary 里描述因预览截断导致的“内容不完整”。',
    'termGlossary 只收录需要在全文统一的术语、专有名词或反复出现的关键表达。',
    '如果提供了“专有名词翻译数据库”，其中的官方统一译法必须作为权威依据：termGlossary 必须与之保持一致，禁止臆造或推翻已收录的官方译名；只有数据库未收录的术语才允许你给出新的建议译法。',
    '强约束（专有名词）：译文中凡是按“专有名词翻译数据库”译法翻译的专有名词一律视为正确，禁止把它们列入 suspectedIssues，禁止要求改回原文、改成音译/直译/意译或任何其它写法；即使你个人认为另有更好译名，也必须服从数据库。',
    '唯一例外：当“专有名词翻译数据库”自身存在内部冲突时——即同一原文或含义高度相似的多个原文条目，给出了互相矛盾或不统一的译法（译名彼此打架、含义冲突或同义却不同译）——你才可以在 suspectedIssues 指出该冲突，并在 termGlossary 给出统一后的建议译法。除此之外，不得以任何理由质疑或修正数据库中的专有名词。',
    'suspectedIssues 只列出术语前后不一致、风格语气偏差、明显语义错误或矛盾等问题，entryId 必须来自速览中出现的 entryId；不要包含由预览截断引起的内容缺失类误判。',
    '如果某一项没有内容，返回空数组或空字符串。'
  ].join('\n')
}

function buildGuidelineUserPrompt(
  sourceLanguageCode,
  targetLanguageCode,
  overviewText,
  partial,
  officialTermGlossaryMarkdown
) {
  const header = partial
    ? '以下是该文章部分翻译产物的速览（全文已分块，这是其中一块）。请基于这一块产出局部校验指南。'
    : '以下是该文章全部翻译产物的速览。请基于全局产出校验指南。'
  const lines = [
    header,
    buildLanguageLine(sourceLanguageCode, targetLanguageCode),
    ''
  ]
  lines.push(overviewText)
  const glossaryMarkdown = (officialTermGlossaryMarkdown || '').trim()
  if (glossaryMarkdown) {
    // 名词库放在用户提示末尾：一方面作为权威参照紧随待校验内容，另一方面让 AI 工作流视图
    // 按“数据库标题到消息末尾”提取词库时只取到词库本身，不会把上方的正文速览一起算进词库卡片。
    lines.push('')
    lines.push(
      '以下是该文章的专有名词翻译数据库（官方统一译法，必须以此为准，不得臆造或推翻其中译名）：'
    )
    lines.push(glossaryMarkdown)
  }
  return lines.join('\n')
}

function buildGuidelineMergeSystemPrompt() {
  return [
    '你是多语言博客的翻译质检负责人。',
    '你会收到同一篇文章按块产出的多份局部校验指南，需要合并成一份覆盖全局的校验指南。',
    '合并时要消除重复术语、统一冲突译法（保留更准确的一项并在 note 中说明），整合风格基调与疑似问题。',
    '如果提供了“专有名词翻译数据库”，其中的官方统一译法必须作为权威依据：合并后的 termGlossary 必须与之保持一致，禁止臆造或推翻已收录的官方译名。',
    '强约束（专有名词）：按“专有名词翻译数据库”译法翻译的专有名词一律视为正确，禁止保留或新增任何“质疑/推翻数据库专有名词”的 suspectedIssues；仅当数据库自身存在相似名词译法互相矛盾或不统一的内部冲突时，才允许在 suspectedIssues 指出冲突并在 termGlossary 给出统一建议。',
    '各块指南来自被截断的速览片段，禁止保留或新增任何“译文截断、缺失后半段、漏译大段内容”等因预览截断而产生的完整性误判。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON，不要输出解释。',
    `返回 JSON 结构必须为：{ "schema": "${VALIDATION_GUIDELINE_SCHEMA}", "summary": "用一段简洁中文总结整体翻译质量与主要发现", "termGlossary": [{ "source": "", "target": "", "note": "" }], "styleNotes": "", "suspectedIssues": [{ "entryId": "", "issueType": "", "note": "" }] }`
  ].join('\n')
}

function buildGuidelineMergeUserPrompt(
  sourceLanguageCode,
  targetLanguageCode,
  partialGuidelines,
  officialTermGlossaryMarkdown
) {
  const lines = [
    '以下是同一篇文章按块产出的多份局部校验指南，请合并成一份全局校验指南。',
    buildLanguageLine(sourceLanguageCode, targetLanguageCode),
    ''
  ]
  lines.push(JSON.stringify(partialGuidelines))
  const glossaryMarkdown = (officialTermGlossaryMarkdown || '').trim()
  if (glossaryMarkdown) {
    // 名词库放末尾：让 AI 工作流视图按“数据库标题到消息末尾”提取词库时只取到词库本身。
    lines.push('')
    lines.push(
      '以下是该文章的专有名词翻译数据库（官方统一译法，必须以此为准，不得臆造或推翻其中译名）：'
    )
    lines.push(glossaryMarkdown)
  }
  return lines.join('\n')
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
  targetLanguageCode,
  officialTermGlossaryProvided
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
      stepLabel,
      officialTermGlossaryProvided: officialTermGlossaryProvided === true
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
  targetLanguageCode,
  officialTermGlossaryMarkdown
}) {
  const blocks = buildOverviewBlocks(pairs)
  const cancellation = handlers?.cancellation
  const officialTermGlossaryProvided = Boolean(
    (officialTermGlossaryMarkdown || '').trim()
  )
  const glossaryStatusSuffix = officialTermGlossaryProvided
    ? '（已加载专有名词数据库）'
    : ''

  if (blocks.length === 1) {
    if (handlers?.onStatus) {
      handlers.onStatus({
        message: `正在进行全局翻译校验速览${glossaryStatusSuffix}`
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
            false,
            officialTermGlossaryMarkdown
          )
        }
      ],
      stepKey: 'validation.overview',
      stepLabel: '全局校验速览',
      cancellation,
      onStatus: handlers?.onStatus,
      sourceLanguageCode,
      targetLanguageCode,
      officialTermGlossaryProvided
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
        message: `正在进行全局翻译校验速览（第 ${index + 1}/${blocks.length} 块）${glossaryStatusSuffix}`
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
            true,
            officialTermGlossaryMarkdown
          )
        }
      ],
      stepKey: `validation.overview.block.${index + 1}`,
      stepLabel: `全局校验速览第 ${index + 1}/${blocks.length} 块`,
      cancellation,
      onStatus: handlers?.onStatus,
      sourceLanguageCode,
      targetLanguageCode,
      officialTermGlossaryProvided
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
        content: buildGuidelineMergeUserPrompt(
          sourceLanguageCode,
          targetLanguageCode,
          partialGuidelines,
          officialTermGlossaryMarkdown
        )
      }
    ],
    stepKey: 'validation.overview.merge',
    stepLabel: '合并全局校验指南',
    cancellation,
    onStatus: handlers?.onStatus,
    sourceLanguageCode,
    targetLanguageCode,
    officialTermGlossaryProvided
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

function normalizeReadableText(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim()
}

function toReadableCharList(value) {
  return Array.from(normalizeReadableText(value))
}

function mergeDiffSegments(segments) {
  const merged = []
  segments.forEach(segment => {
    if (!segment.text) {
      return
    }
    const last = merged[merged.length - 1]
    if (last && last.changed === segment.changed) {
      last.text += segment.text
      return
    }
    merged.push({ text: segment.text, changed: segment.changed })
  })
  return merged
}

function computeCommonPrefixLength(beforeChars, afterChars) {
  const max = Math.min(beforeChars.length, afterChars.length)
  let index = 0
  while (index < max && beforeChars[index] === afterChars[index]) {
    index++
  }
  return index
}

function computeCommonSuffixLength(beforeChars, afterChars, prefixLength) {
  const max = Math.min(beforeChars.length, afterChars.length) - prefixLength
  let index = 0
  while (
    index < max &&
    beforeChars[beforeChars.length - 1 - index] ===
      afterChars[afterChars.length - 1 - index]
  ) {
    index++
  }
  return index
}

// 把文本切成"词 + 空白"的 token 序列（空白单独成段），保证可无损还原。
function tokenizeReadableTextForDiff(text) {
  return String(text == null ? '' : text).match(/\s+|[^\s]+/g) || []
}

// 对中间差异文本做按词（token）级 LCS 比对：用于较长文本，避免字符级 LCS 的 O(n²) 成本，
// 同时只标注真正变化的词，而不是把整段都标成变化。
function diffMiddleByTokens(beforeChars, afterChars) {
  const beforeTokens = tokenizeReadableTextForDiff(beforeChars.join(''))
  const afterTokens = tokenizeReadableTextForDiff(afterChars.join(''))
  if (
    beforeTokens.length > CORRECTION_DIFF_TOKEN_LIMIT ||
    afterTokens.length > CORRECTION_DIFF_TOKEN_LIMIT
  ) {
    return {
      before: [{ text: beforeChars.join(''), changed: true }],
      after: [{ text: afterChars.join(''), changed: true }]
    }
  }

  const beforeLength = beforeTokens.length
  const afterLength = afterTokens.length
  const lcsTable = []
  for (let i = 0; i <= beforeLength; i++) {
    lcsTable.push(new Array(afterLength + 1).fill(0))
  }
  for (let i = beforeLength - 1; i >= 0; i--) {
    for (let j = afterLength - 1; j >= 0; j--) {
      if (beforeTokens[i] === afterTokens[j]) {
        lcsTable[i][j] = lcsTable[i + 1][j + 1] + 1
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i + 1][j], lcsTable[i][j + 1])
      }
    }
  }

  const before = []
  const after = []
  let i = 0
  let j = 0
  while (i < beforeLength && j < afterLength) {
    if (beforeTokens[i] === afterTokens[j]) {
      before.push({ text: beforeTokens[i], changed: false })
      after.push({ text: afterTokens[j], changed: false })
      i++
      j++
    } else if (lcsTable[i + 1][j] >= lcsTable[i][j + 1]) {
      before.push({ text: beforeTokens[i], changed: true })
      i++
    } else {
      after.push({ text: afterTokens[j], changed: true })
      j++
    }
  }
  while (i < beforeLength) {
    before.push({ text: beforeTokens[i], changed: true })
    i++
  }
  while (j < afterLength) {
    after.push({ text: afterTokens[j], changed: true })
    j++
  }
  return { before: mergeDiffSegments(before), after: mergeDiffSegments(after) }
}

// 对去除公共前后缀后的中间差异文本做字符级 LCS 比对。
function diffMiddleSegments(beforeChars, afterChars) {
  if (beforeChars.length === 0 && afterChars.length === 0) {
    return { before: [], after: [] }
  }
  if (beforeChars.length === 0) {
    return {
      before: [],
      after: [{ text: afterChars.join(''), changed: true }]
    }
  }
  if (afterChars.length === 0) {
    return {
      before: [{ text: beforeChars.join(''), changed: true }],
      after: []
    }
  }
  if (
    beforeChars.length > CORRECTION_DIFF_MIDDLE_LIMIT ||
    afterChars.length > CORRECTION_DIFF_MIDDLE_LIMIT
  ) {
    // 中间文本较长，改用按词级 LCS，避免把"只改了一两个词"的长段落整段标成变化。
    return diffMiddleByTokens(beforeChars, afterChars)
  }

  const beforeLength = beforeChars.length
  const afterLength = afterChars.length
  const lcsTable = []
  for (let i = 0; i <= beforeLength; i++) {
    lcsTable.push(new Array(afterLength + 1).fill(0))
  }
  for (let i = beforeLength - 1; i >= 0; i--) {
    for (let j = afterLength - 1; j >= 0; j--) {
      if (beforeChars[i] === afterChars[j]) {
        lcsTable[i][j] = lcsTable[i + 1][j + 1] + 1
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i + 1][j], lcsTable[i][j + 1])
      }
    }
  }

  const before = []
  const after = []
  let i = 0
  let j = 0
  while (i < beforeLength && j < afterLength) {
    if (beforeChars[i] === afterChars[j]) {
      before.push({ text: beforeChars[i], changed: false })
      after.push({ text: afterChars[j], changed: false })
      i++
      j++
    } else if (lcsTable[i + 1][j] >= lcsTable[i][j + 1]) {
      before.push({ text: beforeChars[i], changed: true })
      i++
    } else {
      after.push({ text: afterChars[j], changed: true })
      j++
    }
  }
  while (i < beforeLength) {
    before.push({ text: beforeChars[i], changed: true })
    i++
  }
  while (j < afterLength) {
    after.push({ text: afterChars[j], changed: true })
    j++
  }
  return { before, after }
}

// 先去除公共前后缀（可处理超长文本里只改了一处的情况），再对中间差异做 LCS 比对。
function diffReadableSegments(beforeText, afterText) {
  const beforeChars = toReadableCharList(beforeText)
  const afterChars = toReadableCharList(afterText)
  const prefixLength = computeCommonPrefixLength(beforeChars, afterChars)
  const suffixLength = computeCommonSuffixLength(
    beforeChars,
    afterChars,
    prefixLength
  )
  const beforeMiddle = beforeChars.slice(
    prefixLength,
    beforeChars.length - suffixLength
  )
  const afterMiddle = afterChars.slice(
    prefixLength,
    afterChars.length - suffixLength
  )

  const before = []
  const after = []
  const prefixText = beforeChars.slice(0, prefixLength).join('')
  if (prefixText) {
    before.push({ text: prefixText, changed: false })
    after.push({ text: prefixText, changed: false })
  }
  const middle = diffMiddleSegments(beforeMiddle, afterMiddle)
  middle.before.forEach(segment => before.push(segment))
  middle.after.forEach(segment => after.push(segment))
  const suffixText = beforeChars
    .slice(beforeChars.length - suffixLength)
    .join('')
  if (suffixText) {
    before.push({ text: suffixText, changed: false })
    after.push({ text: suffixText, changed: false })
  }

  return {
    before: mergeDiffSegments(before),
    after: mergeDiffSegments(after)
  }
}

function clampChangedSegment(segment) {
  const chars = Array.from(segment.text)
  if (chars.length <= CORRECTION_DIFF_CHANGED_LIMIT) {
    return segment
  }
  return {
    text: `${chars.slice(0, CORRECTION_DIFF_CHANGED_LIMIT).join('')}…`,
    changed: true
  }
}

// 折叠较长的未变化文本：只在变化点附近保留上下文，远端用省略号代替。
function collapseUnchangedSegment(segment, isFirst, isLast) {
  const chars = Array.from(segment.text)
  const context = CORRECTION_DIFF_CONTEXT
  const keepHead = !isFirst
  const keepTail = !isLast
  const head = chars.slice(0, context).join('')
  const tail = chars.slice(chars.length - context).join('')

  if (keepHead && keepTail) {
    if (chars.length <= context * 2 + 1) {
      return segment
    }
    return { text: `${head}…${tail}`, changed: false }
  }
  if (keepHead) {
    if (chars.length <= context + 1) {
      return segment
    }
    return { text: `${head}…`, changed: false }
  }
  if (keepTail) {
    if (chars.length <= context + 1) {
      return segment
    }
    return { text: `…${tail}`, changed: false }
  }
  if (chars.length <= context * 2 + 1) {
    return segment
  }
  return { text: `${head}…${tail}`, changed: false }
}

function collapseDiffSegments(segments) {
  const total = segments.length
  return segments
    .map((segment, index) => {
      if (segment.changed) {
        return clampChangedSegment(segment)
      }
      return collapseUnchangedSegment(segment, index === 0, index === total - 1)
    })
    .filter(segment => segment.text.length > 0)
}

function enforceDiffSideLimit(segments) {
  const result = []
  let used = 0
  for (const segment of segments) {
    if (used >= CORRECTION_DIFF_SIDE_LIMIT) {
      break
    }
    const chars = Array.from(segment.text)
    if (used + chars.length <= CORRECTION_DIFF_SIDE_LIMIT) {
      result.push(segment)
      used += chars.length
      continue
    }
    const remain = CORRECTION_DIFF_SIDE_LIMIT - used
    result.push({
      text: `${chars.slice(0, remain).join('')}…`,
      changed: segment.changed
    })
    used = CORRECTION_DIFF_SIDE_LIMIT
    break
  }
  return result
}

// 生成单条修正的差异分段及对应的纯文本预览（包含所有变化点）。
function buildCorrectionDiff(beforeText, afterText) {
  const diff = diffReadableSegments(beforeText, afterText)
  const beforeSegments = enforceDiffSideLimit(collapseDiffSegments(diff.before))
  const afterSegments = enforceDiffSideLimit(collapseDiffSegments(diff.after))
  return {
    beforeSegments,
    afterSegments,
    beforePreview: beforeSegments.map(segment => segment.text).join(''),
    afterPreview: afterSegments.map(segment => segment.text).join('')
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
    const correctionDiff = buildCorrectionDiff(
      extractReadableText(beforeEntry.value, valueType),
      extractReadableText(afterEntry.value, valueType)
    )
    corrections.push({
      id,
      scope: afterEntry.scope || beforeEntry.scope || '',
      fieldName: afterEntry.fieldName || beforeEntry.fieldName || '',
      label: afterEntry.label || beforeEntry.label || id,
      sourcePreview: truncateText(
        extractReadableText(sourceEntry ? sourceEntry.value : '', valueType),
        CORRECTION_PREVIEW_LIMIT
      ),
      beforePreview: correctionDiff.beforePreview,
      afterPreview: correctionDiff.afterPreview,
      beforeSegments: correctionDiff.beforeSegments,
      afterSegments: correctionDiff.afterSegments
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

// 取出与该文章关联的专有名词翻译数据库 markdown，供全局速览参照（仅文章模式）。
async function resolveValidationOfficialTermGlossaryMarkdown({
  job,
  target,
  sourceLanguageCode,
  targetLanguageCode
}) {
  // 通用内容翻译（非源文导入）没有绑定到源文章的专有名词数据库，跳过；
  // 但"源文生成并 AI 翻译"虽然以 content 模式校验，却有绑定到源文章的名词库，必须加载，
  // 否则校验 AI 看不到名词库会臆造译名、推翻已按名词库翻译的专有名词。
  if (
    target &&
    target.mode === 'content' &&
    target.contentType !== 'sourcePostImport'
  ) {
    return ''
  }
  const normalizedTargetLanguageCode = String(targetLanguageCode || '').trim()
  if (!normalizedTargetLanguageCode) {
    return ''
  }
  const sourcePostId = String(
    job?.source?.postId || job?.target?.postId || ''
  ).trim()
  if (!sourcePostId) {
    return ''
  }
  try {
    const glossaryData =
      await translationOfficialTermGlossaryService.resolveLinkedOfficialTermGlossaryData(
        {
          sourcePostId,
          sourceLanguageCode: sourceLanguageCode || '',
          targetLanguageCodes: [normalizedTargetLanguageCode],
          handlers: {}
        }
      )
    const glossaryMarkdownMap =
      glossaryData.officialTermGlossaryMarkdownMap || {}
    return glossaryMarkdownMap[normalizedTargetLanguageCode] || ''
  } catch (error) {
    // 词库读取失败不应阻断校验主流程，但要保留错误用于排查。
    console.error('读取校验阶段专有名词词库失败：', error && error.message)
    return ''
  }
}

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

  // 取出该文章的专有名词翻译数据库（官方统一译法），让全局速览也能参照，避免臆造词汇。
  const officialTermGlossaryMarkdown =
    await resolveValidationOfficialTermGlossaryMarkdown({
      job,
      target,
      sourceLanguageCode,
      targetLanguageCode
    })

  // 阶段 A：全局速览，产出全局校验指南。
  const guidelineResult = await buildGlobalGuideline({
    job,
    pairs,
    settings: verificationSettings,
    handlers,
    sourceLanguageCode,
    targetLanguageCode,
    officialTermGlossaryMarkdown
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
    // 透传源文章专有名词数据库范围键，让精校内核加载已绑定术语，禁止推翻按名词库翻译的专有名词。
    properNounScopeKey: target?.properNounScopeKey || '',
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
