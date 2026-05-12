const { getLanguageText } = require('../../../utils/language')

const WORKFLOW_SCHEMA = 'wikimoe.ai.translation.workflow'
const WORKFLOW_VERSION = 1
const MAX_TEXT_LENGTH = 8000
const MAX_SECTION_ITEMS = 80
const MAX_META_ITEMS = 8
const MAX_RECURSIVE_DEPTH = 6

const WORKFLOW_STEP_STATUS_TEXT_MAP = {
  pending: '待执行',
  running: '正在执行',
  retrying: '重试中',
  completed: '已完成',
  failed: '执行失败',
  stopping: '正在停止',
  skipped: '已跳过'
}

function toText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value)
}

function normalizeText(value) {
  return toText(value).replace(/\r\n?/g, '\n').trim()
}

function limitText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = normalizeText(value)
  if (!text) {
    return {
      text: '',
      length: 0,
      truncated: false
    }
  }
  if (text.length <= maxLength) {
    return {
      text,
      length: text.length,
      truncated: false
    }
  }
  return {
    text: text.slice(0, maxLength),
    length: text.length,
    truncated: true
  }
}

function formatLanguage(code) {
  const normalizedCode = normalizeText(code)
  if (!normalizedCode) {
    return ''
  }
  const languageText = getLanguageText(normalizedCode)
  if (languageText && languageText !== normalizedCode) {
    return `${languageText}（${normalizedCode}）`
  }
  return normalizedCode
}

function formatLanguageList(value) {
  let languageCodes = []
  if (Array.isArray(value)) {
    languageCodes = value
  } else {
    languageCodes = normalizeText(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return languageCodes.map(formatLanguage).filter(Boolean).join('、')
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getObjectFieldCount(value) {
  if (!isPlainObject(value)) {
    return 0
  }
  return Object.keys(value).length
}

function getFirstPresentValue(...values) {
  for (const value of values) {
    if (value === null || typeof value === 'undefined') {
      continue
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue
    }
    return value
  }
  return ''
}

function collectReadableText(value, parts, depth = 0) {
  if (parts.length >= MAX_SECTION_ITEMS || depth > MAX_RECURSIVE_DEPTH) {
    return
  }
  if (value === null || typeof value === 'undefined') {
    return
  }
  if (typeof value === 'string') {
    const text = normalizeText(value)
    if (text) {
      parts.push(text)
    }
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    parts.push(String(value))
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectReadableText(item, parts, depth + 1))
    return
  }
  if (!isPlainObject(value)) {
    return
  }
  if (Array.isArray(value.segments)) {
    value.segments.forEach(segment => {
      collectReadableText(segment?.text || segment?.t, parts, depth + 1)
    })
  }
  if (Array.isArray(value.s)) {
    value.s.forEach(segment => {
      collectReadableText(segment?.text || segment?.t, parts, depth + 1)
    })
  }
  const directKeys = [
    'text',
    'title',
    'label',
    'name',
    'content',
    'value',
    'v',
    'translatedText',
    'nextPreviewText',
    'nextPreviewRawValue',
    'previewRawValue',
    'nextValue',
    'generatedCoverUrl',
    'sourceCoverUrl',
    'currentCoverUrl',
    'reason',
    'message',
    'warningMessage',
    'errorMessage'
  ]
  directKeys.forEach(key => {
    if (typeof value[key] !== 'undefined') {
      collectReadableText(value[key], parts, depth + 1)
    }
  })
  if (isPlainObject(value.translations)) {
    Object.entries(value.translations).forEach(
      ([languageCode, translatedText]) => {
        const text = formatDisplayValue(translatedText)
        if (text) {
          parts.push(`${formatLanguage(languageCode)}：${text}`)
        }
      }
    )
  }
  const recursiveKeys = ['children', 'items', 'entries', 'terms', 'parts']
  recursiveKeys.forEach(key => {
    if (typeof value[key] !== 'undefined') {
      collectReadableText(value[key], parts, depth + 1)
    }
  })
}

function extractReadableText(value) {
  const parts = []
  collectReadableText(value, parts)
  const uniqueParts = []
  const seen = new Set()
  parts.forEach(part => {
    const text = normalizeText(part)
    if (!text || seen.has(text)) {
      return
    }
    seen.add(text)
    uniqueParts.push(text)
  })
  return limitText(uniqueParts.join('\n')).text
}

function formatDisplayValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'string') {
    return normalizeText(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    const parts = value
      .slice(0, MAX_META_ITEMS)
      .map(item => formatDisplayValue(item))
      .filter(Boolean)
    let text = parts.join('、')
    if (value.length > MAX_META_ITEMS) {
      text = `${text} 等 ${value.length} 项`
    }
    return text
  }
  if (isPlainObject(value)) {
    if (value.text || value.title || value.label || value.name) {
      return normalizeText(
        value.text || value.title || value.label || value.name
      )
    }
    const readableText = extractReadableText(value)
    if (readableText) {
      return readableText
    }
    const fieldCount = getObjectFieldCount(value)
    if (fieldCount > 0) {
      return `结构化内容，包含 ${fieldCount} 个字段`
    }
  }
  return normalizeText(value)
}

function createItem(label, value, options = {}) {
  const displayValue = formatDisplayValue(value)
  if (!displayValue) {
    return null
  }
  const item = {
    label: normalizeText(label) || '内容',
    value: displayValue
  }
  if (options.description) {
    item.description = normalizeText(options.description)
  }
  if (options.tone) {
    item.tone = normalizeText(options.tone)
  }
  if (Array.isArray(options.meta)) {
    item.meta = options.meta
      .map(metaItem => normalizeText(metaItem))
      .filter(Boolean)
      .slice(0, MAX_META_ITEMS)
  }
  return item
}

function createTextBlock(title, value, options = {}) {
  const limited = limitText(value, options.maxLength || MAX_TEXT_LENGTH)
  if (!limited.text) {
    return null
  }
  return {
    title: normalizeText(title) || '文本',
    text: limited.text,
    charLength: limited.length,
    truncated: limited.truncated,
    tone: normalizeText(options.tone) || ''
  }
}

function pushItem(items, item) {
  if (!item || items.length >= MAX_SECTION_ITEMS) {
    return
  }
  items.push(item)
}

function createSection(options = {}) {
  const items = Array.isArray(options.items)
    ? options.items.filter(Boolean)
    : []
  const textBlocks = Array.isArray(options.textBlocks)
    ? options.textBlocks.filter(Boolean)
    : []
  if (items.length === 0 && textBlocks.length === 0) {
    return null
  }
  return {
    id: normalizeText(options.id),
    title: normalizeText(options.title) || '内容',
    description: normalizeText(options.description),
    kind: normalizeText(options.kind) || 'list',
    tone: normalizeText(options.tone) || '',
    items,
    textBlocks,
    total: Number(options.total || items.length || textBlocks.length || 0)
  }
}

function getWorkflowStepStatusText(status) {
  const normalizedStatus = normalizeText(status)
  return WORKFLOW_STEP_STATUS_TEXT_MAP[normalizedStatus] || normalizedStatus
}

function shouldBuildRuntimeWorkflowSteps(job, aiJsonLogs) {
  const events = getAiWorkflowEvents(job)
  if (events.length > 0) {
    return true
  }
  return false
}
function getAiWorkflowEvents(job) {
  const events = job?.progress?.stageState?.aiWorkflow?.events
  if (!Array.isArray(events)) {
    return []
  }
  return events.filter(event => normalizeText(event?.stepKey))
}

function normalizeAiWorkflowEventStatus(status) {
  const normalizedStatus = normalizeText(status)
  if (normalizedStatus) {
    return normalizedStatus
  }
  return 'running'
}

function collectAiWorkflowEventSteps(events) {
  const stepMap = new Map()
  const stepList = []
  events.forEach(event => {
    const stepKey = normalizeText(event.stepKey)
    if (!stepKey) {
      return
    }
    let stepEntry = stepMap.get(stepKey)
    if (!stepEntry) {
      stepEntry = {
        stepKey,
        stepLabel: '',
        status: 'running',
        events: [],
        firstAt: null,
        latestAt: null,
        latestMessage: ''
      }
      stepMap.set(stepKey, stepEntry)
      stepList.push(stepEntry)
    }
    if (event.stepLabel) {
      stepEntry.stepLabel = normalizeText(event.stepLabel)
    }
    stepEntry.status = normalizeAiWorkflowEventStatus(event.status)
    stepEntry.latestMessage = normalizeText(event.message)
    if (!stepEntry.firstAt) {
      stepEntry.firstAt = event.createdAt || null
    }
    stepEntry.latestAt = event.createdAt || stepEntry.latestAt
    stepEntry.events.push(event)
  })
  return stepList
}

function getAiWorkflowEventStepDisplay(stepEntry) {
  if (stepEntry.stepLabel) {
    return {
      title: stepEntry.stepLabel,
      description: 'AI 翻译服务正在执行的真实工作流步骤。'
    }
  }
  const chunkMatch = stepEntry.stepKey.match(/^translation\.chunk\.(\d+)$/)
  if (chunkMatch) {
    return {
      title: `翻译正文第 ${chunkMatch[1]} 批`,
      description: 'DeepSeek 正在处理当前正文翻译批次。'
    }
  }
  return getOperationDisplay({ operation: stepEntry.stepKey })
}

function getLatestAiWorkflowEvent(stepEntry) {
  if (!Array.isArray(stepEntry.events) || stepEntry.events.length === 0) {
    return null
  }
  return stepEntry.events[stepEntry.events.length - 1]
}

function buildAiWorkflowEventStatusSection(stepEntry) {
  const latestEvent = getLatestAiWorkflowEvent(stepEntry) || {}
  const items = []
  pushItem(
    items,
    createItem('状态', getWorkflowStepStatusText(stepEntry.status))
  )
  pushItem(items, createItem('当前消息', latestEvent.message))
  pushItem(items, createItem('执行阶段', latestEvent.stage))
  pushItem(items, createItem('尝试次数', latestEvent.attemptNo))
  pushItem(items, createItem('最大尝试次数', latestEvent.maxAttempts))
  pushItem(items, createItem('更新时间', latestEvent.createdAt))
  return createSection({
    title: 'AI 工作流状态',
    description: '这里展示当前真实 AI 步骤的运行状态。',
    kind: 'metric',
    tone: 'input',
    items
  })
}

function buildAiWorkflowEventLogSection(stepEntry) {
  const items = []
  stepEntry.events.slice(-10).forEach((event, index) => {
    const meta = []
    if (event.status) {
      meta.push(`状态：${getWorkflowStepStatusText(event.status)}`)
    }
    if (event.attemptNo) {
      meta.push(`尝试：${event.attemptNo}/${event.maxAttempts || '-'}`)
    }
    if (event.createdAt) {
      meta.push(`时间：${event.createdAt}`)
    }
    pushItem(
      items,
      createItem(`事件 ${index + 1}`, event.message, {
        meta,
        tone: event.status === 'failed' ? 'warning' : 'output'
      })
    )
  })
  return createSection({
    title: '步骤事件',
    description: '这个 AI 步骤在执行、重试和完成时写入的事件。',
    kind: 'list',
    tone: 'output',
    items,
    total: stepEntry.events.length
  })
}

function buildAiWorkflowEventFailureSection(stepEntry) {
  const failedEvent = stepEntry.events.find(event => event.status === 'failed')
  if (!failedEvent) {
    return null
  }
  const items = []
  pushItem(
    items,
    createItem('错误码', failedEvent.errorCode, { tone: 'warning' })
  )
  pushItem(
    items,
    createItem('错误信息', failedEvent.errorMessage, { tone: 'warning' })
  )
  return createSection({
    title: '失败信息',
    description: '当前 AI 步骤失败时记录的错误摘要。',
    kind: 'metric',
    tone: 'warning',
    items
  })
}

function buildAiWorkflowEventStep(stepEntry, order) {
  const display = getAiWorkflowEventStepDisplay(stepEntry)
  const latestEvent = getLatestAiWorkflowEvent(stepEntry) || {}
  return {
    id: `runtime-step-${order}`,
    order,
    title: display.title,
    description: display.description,
    status: stepEntry.status,
    statusText: getWorkflowStepStatusText(stepEntry.status),
    kind: 'runtime',
    operation: stepEntry.stepKey,
    stage: normalizeText(latestEvent.stage),
    provider: '',
    model: '',
    requestId: '',
    createdAt: stepEntry.latestAt || stepEntry.firstAt || null,
    currentStep: normalizeText(latestEvent.message),
    badges: [
      { label: '状态', value: getWorkflowStepStatusText(stepEntry.status) }
    ],
    inputSections: [buildAiWorkflowEventStatusSection(stepEntry)].filter(
      Boolean
    ),
    outputSections: [
      buildAiWorkflowEventLogSection(stepEntry),
      buildAiWorkflowEventFailureSection(stepEntry)
    ].filter(Boolean)
  }
}

function buildRuntimeWorkflowSteps(job) {
  return collectAiWorkflowEventSteps(getAiWorkflowEvents(job)).map(
    (stepEntry, index) => {
      return buildAiWorkflowEventStep(stepEntry, index + 1)
    }
  )
}

function tryParseJsonText(text) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) {
    return null
  }
  try {
    return JSON.parse(normalizedText)
  } catch (error) {
    return null
  }
}

function findPromptJsonSuffix(text) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) {
    return null
  }
  const directParsed = tryParseJsonText(normalizedText)
  if (directParsed) {
    return {
      prefix: '',
      data: directParsed
    }
  }

  const candidates = ['\n{', '\n[']
  let bestMatch = null
  candidates.forEach(candidate => {
    let index = normalizedText.lastIndexOf(candidate)
    while (index >= 0) {
      const suffix = normalizedText.slice(index + 1)
      const parsed = tryParseJsonText(suffix)
      if (parsed) {
        bestMatch = {
          prefix: normalizedText.slice(0, index).trim(),
          data: parsed
        }
        return
      }
      index = normalizedText.lastIndexOf(candidate, index - 1)
    }
  })
  return bestMatch
}

function getRoleLabel(role, index) {
  const normalizedRole = normalizeText(role)
  if (normalizedRole === 'system') {
    return `系统规则 ${index + 1}`
  }
  if (normalizedRole === 'user') {
    return `用户输入 ${index + 1}`
  }
  if (normalizedRole === 'assistant') {
    return `AI 回复示例 ${index + 1}`
  }
  if (normalizedRole) {
    return `${normalizedRole} ${index + 1}`
  }
  return `消息 ${index + 1}`
}

function buildRequestBodyOverviewSection(requestBody) {
  if (!isPlainObject(requestBody)) {
    return null
  }
  const items = []
  pushItem(items, createItem('模型', requestBody.model))
  pushItem(items, createItem('返回格式', describeResponseFormat(requestBody)))
  pushItem(
    items,
    createItem('流式输出', requestBody.stream === true ? '是' : '否')
  )
  pushItem(items, createItem('最大输出 Token', requestBody.max_tokens))
  pushItem(items, createItem('温度', requestBody.temperature))
  pushItem(items, createItem('推理模式', describeThinking(requestBody)))
  return createSection({
    title: '本次 AI 调用设置',
    description: '这些是服务端实际提交给 AI 服务商的调用参数。',
    kind: 'metric',
    tone: 'input',
    items
  })
}

function describeResponseFormat(requestBody) {
  if (requestBody.response_format?.type) {
    return requestBody.response_format.type
  }
  if (requestBody.generationConfig?.responseMimeType) {
    return requestBody.generationConfig.responseMimeType
  }
  return ''
}

function describeThinking(requestBody) {
  if (requestBody.thinking?.type) {
    return requestBody.thinking.type
  }
  if (requestBody.reasoning_effort) {
    return requestBody.reasoning_effort
  }
  return ''
}

function getMessageListFromRequestBody(requestBody) {
  const messages = []
  if (!isPlainObject(requestBody)) {
    return messages
  }
  if (Array.isArray(requestBody.messages)) {
    requestBody.messages.forEach(message => {
      messages.push({
        role: message?.role || '',
        text: message?.content || ''
      })
    })
  }
  if (Array.isArray(requestBody.contents)) {
    requestBody.contents.forEach(contentItem => {
      const parts = Array.isArray(contentItem?.parts) ? contentItem.parts : []
      parts.forEach(part => {
        if (part?.text) {
          messages.push({
            role: contentItem?.role || 'user',
            text: part.text
          })
        }
      })
    })
  }
  return messages
}

function buildPromptDataOverviewSection(data) {
  if (!isPlainObject(data)) {
    return null
  }
  const items = []
  pushItem(items, createItem('任务', describeTask(data.task)))
  pushItem(
    items,
    createItem('源语言', describeLanguageObject(data.sourceLanguage))
  )
  pushItem(
    items,
    createItem('目标语言', describeLanguageObject(data.targetLanguage))
  )
  pushItem(items, createItem('源语言', formatLanguage(data.sourceLanguageCode)))
  pushItem(
    items,
    createItem('目标语言', formatLanguageList(data.targetLanguageCodes))
  )
  pushItem(
    items,
    createItem('目标语言', formatLanguageList(data.targetLanguageCode))
  )
  pushItem(items, createItem('正文格式', data.textFormat))
  pushItem(items, createItem('分包类型', data.packageType))
  pushItem(items, createItem('分包标题', data.packageTitle))
  pushItem(
    items,
    createItem('要求返回', describeRequiredOutput(data.requiredOutput))
  )
  return createSection({
    title: 'AI 这一步收到的任务说明',
    description: '把请求里的任务、语言和返回要求翻译成普通说明。',
    kind: 'metric',
    tone: 'input',
    items
  })
}

function describeTask(task) {
  const taskText = normalizeText(task)
  const taskMap = {
    translate_wikimoe_entries: '翻译本次选中的文章字段',
    extract_proper_noun_terms: '抽取需要确认的专有名词',
    search_official_term_translations: '联网检索专有名词正式译名',
    knowledge_official_term_translations:
      '名词搜索翻译 AI 用模型知识确认专有名词译名',
    resolve_official_term_translations_from_model_knowledge:
      '名词搜索翻译 AI 用模型知识确认专有名词译名'
  }
  return taskMap[taskText] || taskText
}

function describeLanguageObject(value) {
  if (!isPlainObject(value)) {
    return ''
  }
  if (value.label && value.code) {
    return `${value.label}（${value.code}）`
  }
  if (value.code) {
    return formatLanguage(value.code)
  }
  return ''
}

function describeRequiredOutput(value) {
  if (!isPlainObject(value)) {
    return ''
  }
  const parts = []
  if (value.schema) {
    parts.push(`schema：${value.schema}`)
  }
  if (value.version) {
    parts.push(`版本：${value.version}`)
  }
  if (Array.isArray(value.entries)) {
    parts.push('返回翻译条目列表')
  }
  if (Array.isArray(value.terms)) {
    parts.push('返回专有名词列表')
  }
  return parts.join('；')
}

function buildContextSections(data) {
  const sections = []
  const contextBlocks = [
    createTextBlock('上一步上下文摘要', data.previousContextSummary),
    createTextBlock('本次内容上下文摘要', data.contentContextSummary),
    createTextBlock('AI 需要参考的上下文', data.contextSummary),
    createTextBlock('专有名词词库', data.officialTermGlossaryMarkdown),
    createTextBlock('原文内容', data.text, { maxLength: MAX_TEXT_LENGTH })
  ].filter(Boolean)
  const contextSection = createSection({
    title: 'AI 参考的上下文',
    description: '这些内容帮助 AI 判断文章语境、名词身份和翻译范围。',
    kind: 'text',
    tone: 'input',
    textBlocks: contextBlocks
  })
  if (contextSection) {
    sections.push(contextSection)
  }
  return sections
}

function buildEntryInputItem(entry, index) {
  if (!isPlainObject(entry)) {
    return createItem(`条目 ${index + 1}`, entry)
  }
  const label =
    entry.n || entry.label || entry.fieldLabel || entry.i || `条目 ${index + 1}`
  const meta = []
  if (entry.i) {
    meta.push(`编号 ${entry.i}`)
  }
  if (entry.t) {
    meta.push(`类型 ${entry.t}`)
  }
  if (entry.k === true) {
    meta.push('允许 AI 判断无需翻译')
  }
  if (typeof entry.c !== 'undefined') {
    meta.push(`当前已有内容：${formatDisplayValue(entry.c)}`)
  }
  return createItem(
    label,
    getFirstPresentValue(entry.v, entry.value, entry.sourceValue),
    {
      meta,
      tone: 'input'
    }
  )
}

function buildTermInputItem(term, index) {
  if (!isPlainObject(term)) {
    return createItem(`名词 ${index + 1}`, term)
  }
  const label =
    term.sourceText ||
    term.normalizedSourceText ||
    term.termId ||
    `名词 ${index + 1}`
  const meta = []
  if (Array.isArray(term.targetLanguageCodes)) {
    meta.push(`目标语言：${formatLanguageList(term.targetLanguageCodes)}`)
  }
  if (Array.isArray(term.searchKeywords)) {
    meta.push(`搜索关键词：${term.searchKeywords.join('、')}`)
  }
  if (term.note) {
    meta.push(`备注：${term.note}`)
  }
  if (term.importance) {
    meta.push(`重要度：${term.importance}`)
  }
  return createItem(
    label,
    term.context || term.note || term.normalizedSourceText || label,
    {
      meta,
      tone: 'input'
    }
  )
}

function buildArraySection(title, description, list, buildItem, tone) {
  if (!Array.isArray(list) || list.length === 0) {
    return null
  }
  const items = []
  list.slice(0, MAX_SECTION_ITEMS).forEach((entry, index) => {
    pushItem(items, buildItem(entry, index))
  })
  const section = createSection({
    title,
    description,
    kind: 'list',
    tone,
    items,
    total: list.length
  })
  return section
}

function buildPromptDataSections(data) {
  const sections = []
  if (!isPlainObject(data)) {
    return sections
  }
  const overviewSection = buildPromptDataOverviewSection(data)
  if (overviewSection) {
    sections.push(overviewSection)
  }
  buildContextSections(data).forEach(section => sections.push(section))
  const entrySection = buildArraySection(
    'AI 需要处理的内容',
    '每一项都是服务端提交给 AI 翻译或判断的业务内容。',
    data.entries,
    buildEntryInputItem,
    'input'
  )
  if (entrySection) {
    sections.push(entrySection)
  }

  const termList = []
  const termSources = [
    data.sourceTermRequests,
    data.termRequests,
    data.sourceTextItems,
    data.candidateTerms
  ]
  termSources.forEach(list => {
    if (Array.isArray(list)) {
      termList.push(...list)
    }
  })
  const termSection = buildArraySection(
    'AI 需要判断的专有名词',
    '这些名词会用于候选消歧，或交给名词搜索翻译 AI 确认译名。',
    termList,
    buildTermInputItem,
    'input'
  )
  if (termSection) {
    sections.push(termSection)
  }
  return sections
}

function buildMessageInputSections(requestBody) {
  const sections = []
  const overviewSection = buildRequestBodyOverviewSection(requestBody)
  if (overviewSection) {
    sections.push(overviewSection)
  }
  const messages = getMessageListFromRequestBody(requestBody)
  messages.forEach((message, index) => {
    const label = getRoleLabel(message.role, index)
    if (normalizeText(message.role) === 'system') {
      const systemSection = buildSystemPromptSummarySection(label, message.text)
      if (systemSection) {
        sections.push(systemSection)
      }
      return
    }
    const parsedPrompt = findPromptJsonSuffix(message.text)
    if (parsedPrompt) {
      const prefixBlock = createTextBlock(
        `${label}中的文字要求`,
        sanitizePromptDisplayText(parsedPrompt.prefix)
      )
      const prefixSection = createSection({
        title: label,
        description: '这段是发送给 AI 的自然语言要求。',
        kind: 'text',
        tone: 'input',
        textBlocks: [prefixBlock]
      })
      if (prefixSection) {
        sections.push(prefixSection)
      }
      buildPromptDataSections(parsedPrompt.data).forEach(section => {
        sections.push(section)
      })
      return
    }
    const textSection = createSection({
      title: label,
      description: '这段提示词会直接影响 AI 的判断和输出。',
      kind: 'text',
      tone: 'input',
      textBlocks: [
        createTextBlock('提示词内容', sanitizePromptDisplayText(message.text))
      ]
    })
    if (textSection) {
      sections.push(textSection)
    }
  })
  return sections
}

function buildSystemPromptSummarySection(label, text) {
  const lines = normalizeText(text)
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
  const items = []
  lines.forEach(line => {
    if (items.length >= 8) {
      return
    }
    if (line.includes('{') || line.includes('}') || line.includes('[')) {
      return
    }
    if (/^JSON\s*/i.test(line)) {
      return
    }
    pushItem(
      items,
      createItem(`规则 ${items.length + 1}`, line, {
        tone: 'input'
      })
    )
  })
  if (items.length === 0) {
    pushItem(
      items,
      createItem('结构化输出要求', 'AI 被要求按服务端约定返回可解析结果。', {
        tone: 'input'
      })
    )
  }
  return createSection({
    title: label,
    description: '这一步发送给 AI 的系统规则摘要。',
    kind: 'list',
    tone: 'input',
    items,
    total: lines.length
  })
}

function buildInputSections(log) {
  const input = log?.input || {}
  const requestBody = input.requestBody || input.request || null
  const sections = buildMessageInputSections(requestBody)
  if (sections.length > 0) {
    return sections
  }
  const directSections = []
  const directContextSection = createSection({
    title: 'AI 参考的上下文',
    description: '这段上下文帮助 AI 判断名词指向。',
    kind: 'text',
    tone: 'input',
    textBlocks: [createTextBlock('上下文摘要', input.contextSummary)]
  })
  if (directContextSection) {
    directSections.push(directContextSection)
  }
  const directTermSection = buildArraySection(
    'AI 需要确认的名词',
    '这些是提交给当前 AI 步骤判断或检索的专有名词。',
    input.termRequests,
    buildTermInputItem,
    'input'
  )
  if (directTermSection) {
    directSections.push(directTermSection)
  }
  if (directSections.length > 0) {
    return directSections
  }
  const metaItems = []
  const meta = log?.meta || {}
  Object.entries(meta).forEach(([key, value]) => {
    pushItem(metaItems, createItem(getMetaLabel(key), value, { tone: 'input' }))
  })
  const metaSection = createSection({
    title: 'AI 输入摘要',
    description: '该历史记录没有保存完整请求体，这里展示服务端保存的输入摘要。',
    kind: 'metric',
    tone: 'input',
    items: metaItems
  })
  if (metaSection) {
    return [metaSection]
  }
  return []
}

function getMetaLabel(key) {
  const labelMap = {
    packageIndex: '分包序号',
    packageCount: '分包总数',
    packageTitle: '分包标题',
    textLength: '输入文本长度',
    entryCount: '条目数量',
    chunkIndex: '批次序号',
    chunkCount: '批次总数',
    targetLanguageCodes: '目标语言',
    sourceTermCount: '名词数量',
    candidateTermCount: '候选名词数量',
    contextSummaryLength: '上下文摘要长度',
    aiKnowledgeBaseTermCount: '模型知识确认名词数',
    aiKnowledgeBaseTranslationCount: '模型知识确认译名数',
    internetSearchTermCount: '联网检索确认名词数',
    internetSearchTranslationCount: '联网检索译名数',
    internetSearchRequestedTermCount: '联网检索请求名词数',
    internetSearchTargetLanguageCodes: '联网检索目标语言',
    skipKnowledgeBase: '跳过模型知识确认'
  }
  return labelMap[key] || key
}

function getOutputRoot(log) {
  if (typeof log?.output !== 'undefined') {
    return log.output
  }
  if (typeof log?.json !== 'undefined') {
    return log.json
  }
  return {}
}

function getFirstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value
    }
  }
  return []
}

function buildTranslationOutputItem(entry, index) {
  if (!isPlainObject(entry)) {
    return createItem(`输出 ${index + 1}`, entry, { tone: 'output' })
  }
  const label =
    entry.n ||
    entry.label ||
    entry.fieldLabel ||
    entry.i ||
    entry.entryKey ||
    `输出 ${index + 1}`
  const meta = []
  if (entry.i) {
    meta.push(`编号 ${entry.i}`)
  }
  if (entry.r) {
    meta.push(`原因：${entry.r}`)
  }
  if (entry.languageCode) {
    meta.push(`语言：${formatLanguage(entry.languageCode)}`)
  }
  return createItem(
    label,
    getFirstPresentValue(entry.v, entry.value, entry.nextValue, entry.text),
    {
      meta,
      tone: 'output'
    }
  )
}

function formatTranslations(translations) {
  if (!isPlainObject(translations)) {
    return ''
  }
  return Object.entries(translations)
    .map(([languageCode, translatedText]) => {
      return `${formatLanguage(languageCode)}：${formatDisplayValue(translatedText)}`
    })
    .filter(Boolean)
    .join('；')
}

function buildTermOutputItem(term, index) {
  if (!isPlainObject(term)) {
    return createItem(`名词 ${index + 1}`, term, { tone: 'output' })
  }
  const label =
    term.sourceText ||
    term.normalizedSourceText ||
    term.termId ||
    `名词 ${index + 1}`
  const meta = []
  if (term.translationSource) {
    meta.push(`来源：${term.translationSource}`)
  }
  if (Array.isArray(term.needsSearchLanguageCodes)) {
    meta.push(`还需检索：${formatLanguageList(term.needsSearchLanguageCodes)}`)
  }
  if (term.note) {
    meta.push(`备注：${term.note}`)
  }
  if (term.shouldUpdateTermNote === true) {
    meta.push('备注已由 Gemini 修订')
  }
  return createItem(
    label,
    formatTranslations(term.translations) || term.note || label,
    {
      meta,
      tone: 'output'
    }
  )
}

function buildStatsSection(root, log) {
  const stats = root.stats || log?.meta || {}
  if (!isPlainObject(stats)) {
    return null
  }
  const items = []
  Object.entries(stats).forEach(([key, value]) => {
    pushItem(items, createItem(getMetaLabel(key), value, { tone: 'neutral' }))
  })
  return createSection({
    title: '这一步的数量统计',
    description: '用数字快速判断 AI 处理了多少内容、产出了多少结果。',
    kind: 'metric',
    tone: 'neutral',
    items
  })
}

function collectGroundingData(value, output, depth = 0) {
  if (!value || depth > MAX_RECURSIVE_DEPTH) {
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectGroundingData(item, output, depth + 1))
    return
  }
  if (!isPlainObject(value)) {
    return
  }
  if (Array.isArray(value.webSearchQueries)) {
    value.webSearchQueries.forEach(query => {
      if (output.queries.length < MAX_SECTION_ITEMS) {
        output.queries.push(normalizeText(query))
      }
    })
  }
  if (Array.isArray(value.groundingChunks)) {
    value.groundingChunks.forEach(chunk => {
      if (output.chunks.length >= MAX_SECTION_ITEMS) {
        return
      }
      const web = chunk?.web || chunk
      output.chunks.push({
        title: normalizeText(web?.title),
        uri: normalizeText(web?.uri || web?.url)
      })
    })
  }
  Object.values(value).forEach(childValue => {
    collectGroundingData(childValue, output, depth + 1)
  })
}

function buildGroundingSection(root) {
  const groundingData = {
    queries: [],
    chunks: []
  }
  collectGroundingData(root, groundingData)
  const items = []
  groundingData.queries.forEach((query, index) => {
    pushItem(
      items,
      createItem(`搜索词 ${index + 1}`, query, { tone: 'output' })
    )
  })
  groundingData.chunks.forEach((chunk, index) => {
    pushItem(
      items,
      createItem(chunk.title || `网页依据 ${index + 1}`, chunk.uri, {
        tone: 'output'
      })
    )
  })
  return createSection({
    title: 'AI 检索到的网页依据',
    description: '联网检索步骤会把搜索词和网页来源整理到这里。',
    kind: 'list',
    tone: 'output',
    items,
    total: groundingData.queries.length + groundingData.chunks.length
  })
}

function buildOutputContextSection(root, result) {
  const textBlocks = [
    createTextBlock('AI 生成的上下文摘要', root.contextSummary),
    createTextBlock('AI 生成的上下文摘要', result.contextSummary),
    createTextBlock('上一轮上下文摘要', root.previousContextSummary),
    createTextBlock('上一轮上下文摘要', result.previousContextSummary)
  ].filter(Boolean)
  return createSection({
    title: 'AI 输出的上下文说明',
    description: '这些摘要会影响后续名词判断和翻译步骤。',
    kind: 'text',
    tone: 'output',
    textBlocks
  })
}

function isCoverImageRecord(value) {
  if (!isPlainObject(value)) {
    return false
  }
  const coverKeys = [
    'recognitionKey',
    'generationKey',
    'artifactId',
    'generatedCoverUrl',
    'sourceCoverUrl',
    'currentCoverUrl',
    'coverImageStatus',
    'recognizedText',
    'visualDescription'
  ]
  return coverKeys.some(key => Boolean(value[key]))
}

function collectCoverImageRecords(value, records, depth = 0) {
  if (
    records.length >= MAX_SECTION_ITEMS ||
    !value ||
    depth > MAX_RECURSIVE_DEPTH
  ) {
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectCoverImageRecords(item, records, depth + 1))
    return
  }
  if (!isPlainObject(value)) {
    return
  }
  if (isCoverImageRecord(value)) {
    records.push(value)
    return
  }
  Object.values(value).forEach(childValue => {
    collectCoverImageRecords(childValue, records, depth + 1)
  })
}

function buildCoverImageOutputItem(record, index) {
  const label = getFirstPresentValue(
    record.targetTitle,
    record.sourceTitle,
    record.generationKey,
    record.recognitionKey,
    record.artifactId,
    `封面图结果 ${index + 1}`
  )
  const value = getFirstPresentValue(
    record.generatedCoverUrl,
    record.currentCoverUrl,
    record.sourceCoverUrl,
    record.recognizedText,
    record.visualDescription,
    record.reason,
    record.warningMessage,
    record.status,
    extractReadableText(record)
  )
  const meta = []
  if (record.status) {
    meta.push(`状态：${record.status}`)
  }
  if (record.artifactId) {
    meta.push(`产物：${record.artifactId}`)
  }
  if (record.recognitionKey) {
    meta.push(`识别记录：${record.recognitionKey}`)
  }
  if (record.generationKey) {
    meta.push(`生成记录：${record.generationKey}`)
  }
  if (record.sourceCoverUrl) {
    meta.push(`源封面：${record.sourceCoverUrl}`)
  }
  if (record.generatedCoverUrl) {
    meta.push(`AI 封面：${record.generatedCoverUrl}`)
  }
  return createItem(label, value, {
    meta,
    tone: 'output'
  })
}

function buildCoverImageOutputSection(root) {
  const records = []
  collectCoverImageRecords(root, records)
  return buildArraySection(
    'AI 封面图处理结果',
    '这里展示封面图识别、生成、跳过或产物保存的结果。',
    records,
    buildCoverImageOutputItem,
    'output'
  )
}

function buildGenericArrayOutputSection(root) {
  if (!Array.isArray(root) || root.length === 0) {
    return null
  }
  return buildArraySection(
    'AI 输出列表',
    '该步骤返回的是一组结果，已转成逐项摘要。',
    root,
    (item, index) => createItem(`结果 ${index + 1}`, item, { tone: 'output' }),
    'output'
  )
}

function buildAdditionalOutputSection(root, result) {
  const skippedKeys = new Set([
    'entries',
    'normalizedTerms',
    'terms',
    'missingTermRequests',
    'matchedTermIds',
    'result',
    'payload',
    'rawResponse',
    'stats',
    'groundingMetadata',
    'contextSummary',
    'previousContextSummary'
  ])
  const items = []
  const collectTopLevelItems = source => {
    if (!isPlainObject(source)) {
      return
    }
    Object.entries(source).forEach(([key, value]) => {
      if (skippedKeys.has(key)) {
        return
      }
      pushItem(items, createItem(getMetaLabel(key), value, { tone: 'output' }))
    })
  }
  collectTopLevelItems(root)
  collectTopLevelItems(result)
  return createSection({
    title: '其它 AI 输出摘要',
    description: '没有归入上面分组的输出字段会在这里转成可读摘要。',
    kind: 'metric',
    tone: 'output',
    items
  })
}

function getNormalizedTermSectionConfig(operation) {
  if (operation === 'proper-noun.official-translation.knowledge') {
    return {
      title: '名词搜索翻译 AI 确认的译名',
      description:
        '这些译名由 Gemini 模型知识确认，会写入或参与本次翻译的专有名词词库。'
    }
  }
  return {
    title: 'AI 抽取出的专有名词',
    description: '这些名词会进入后续名词库匹配或名词搜索翻译 AI。'
  }
}

function getTermSectionConfig(operation) {
  if (operation === 'proper-noun.keyword.extract') {
    return {
      title: 'AI 抽取出的专有名词',
      description: '这些名词会进入后续名词库匹配或名词搜索翻译 AI。'
    }
  }
  if (operation === 'proper-noun.official-translation.search') {
    return {
      title: '名词搜索翻译 AI 联网确认的译名',
      description:
        '这些译名由 Gemini 联网检索确认，会写入或参与本次翻译的专有名词词库。'
    }
  }
  return {
    title: 'AI 确认的专有名词译名',
    description: '这些译名会写入或参与本次翻译的专有名词词库。'
  }
}

function shouldShowRawTermSection(operation, normalizedTerms) {
  if (operation === 'proper-noun.official-translation.knowledge') {
    return false
  }
  if (!Array.isArray(normalizedTerms) || normalizedTerms.length === 0) {
    return true
  }
  if (operation === 'proper-noun.keyword.extract') {
    return false
  }
  return true
}

function buildOutputSections(log) {
  const root = getOutputRoot(log)
  const result = isPlainObject(root.result) ? root.result : {}
  const operation = normalizeText(log?.operation)
  const sections = []
  const entries = getFirstArray(
    root.entries,
    result.entries,
    root.payload?.entries
  )
  const entrySection = buildArraySection(
    'AI 输出的翻译结果',
    '这些是 AI 返回给服务端、随后会被整理成审核预览的内容。',
    entries,
    buildTranslationOutputItem,
    'output'
  )
  if (entrySection) {
    sections.push(entrySection)
  }

  const normalizedTerms = getFirstArray(
    root.normalizedTerms,
    result.normalizedTerms
  )
  const normalizedTermConfig = getNormalizedTermSectionConfig(operation)
  const normalizedTermSection = buildArraySection(
    normalizedTermConfig.title,
    normalizedTermConfig.description,
    normalizedTerms,
    buildTermOutputItem,
    'output'
  )
  if (normalizedTermSection) {
    sections.push(normalizedTermSection)
  }

  const terms = getFirstArray(root.terms, result.terms)
  if (shouldShowRawTermSection(operation, normalizedTerms)) {
    const termConfig = getTermSectionConfig(operation)
    const termSection = buildArraySection(
      termConfig.title,
      termConfig.description,
      terms,
      buildTermOutputItem,
      'output'
    )
    if (termSection) {
      sections.push(termSection)
    }
  }

  const missingTerms = getFirstArray(
    root.missingTermRequests,
    result.missingTermRequests
  )
  const missingSection = buildArraySection(
    'AI 认为还需要继续确认的名词',
    '这些内容会继续交给名词搜索翻译 AI 的后续确认步骤。',
    missingTerms,
    buildTermInputItem,
    'warning'
  )
  if (missingSection) {
    sections.push(missingSection)
  }

  const matchedTermIds = getFirstArray(
    root.matchedTermIds,
    result.matchedTermIds
  )
  const matchedSection = buildArraySection(
    'AI 选中的词库候选',
    '候选消歧后确认可复用的词库记录。',
    matchedTermIds,
    (termId, index) =>
      createItem(`词库记录 ${index + 1}`, termId, { tone: 'output' }),
    'output'
  )
  if (matchedSection) {
    sections.push(matchedSection)
  }

  const groundingSection = buildGroundingSection(root)
  if (groundingSection) {
    sections.push(groundingSection)
  }

  const coverImageSection = buildCoverImageOutputSection(root)
  if (coverImageSection) {
    sections.push(coverImageSection)
  }

  const genericArraySection = buildGenericArrayOutputSection(root)
  if (genericArraySection && !coverImageSection) {
    sections.push(genericArraySection)
  }

  const statsSection = buildStatsSection(root, log)
  if (statsSection) {
    sections.push(statsSection)
  }

  const additionalSection = buildAdditionalOutputSection(root, result)
  if (additionalSection) {
    sections.push(additionalSection)
  }

  if (sections.length === 0) {
    const summaryItems = []
    Object.entries(root).forEach(([key, value]) => {
      pushItem(
        summaryItems,
        createItem(getMetaLabel(key), value, { tone: 'output' })
      )
    })
    const summarySection = createSection({
      title: 'AI 输出摘要',
      description: '该步骤没有可拆分的业务条目，展示服务端保存的输出摘要。',
      kind: 'metric',
      tone: 'output',
      items: summaryItems
    })
    if (summarySection) {
      sections.push(summarySection)
    }
  }
  return sections
}

function getOperationDisplay(log) {
  const operation = normalizeText(log?.operation)
  const stage = normalizeText(log?.stage)
  const displayMap = {
    'proper-noun.keyword.extract': {
      title: '抽取需要确认的专有名词',
      description:
        'AI 先阅读原文，找出作品、角色、品牌、地点等需要稳定译名的内容。'
    },
    'proper-noun.existing-term.filter': {
      title: '匹配已有专有名词库',
      description: 'AI 根据上下文从候选词库中挑出真正对应的记录。'
    },
    'proper-noun.official-translation.knowledge': {
      title: '名词搜索翻译 AI 知识确认',
      description:
        'Gemini 不联网，先判断哪些译名可以直接确认，哪些需要交给联网检索。'
    },
    'proper-noun.official-translation.search': {
      title: '名词搜索翻译 AI 联网检索',
      description: 'Gemini 使用搜索结果确认缺失语言的正式译名或通行译名。'
    },
    'proper-noun.official-translation.resolve': {
      title: '整理联网检索译名',
      description: '服务端汇总联网检索结果，并准备写入本次翻译词库。'
    },
    'translation.post': {
      title: '翻译文章内容',
      description: 'AI 按字段翻译标题、正文、摘要、媒体说明等文章内容。'
    },
    'translation.content': {
      title: '翻译通用内容',
      description: 'AI 翻译弹窗或通用内容请求里的文本。'
    },
    'cover-image.recognition': {
      title: '识别封面图文字与主题',
      description: 'AI 分析源封面，为后续生成目标语言封面提供依据。'
    },
    'cover-image.generation': {
      title: '生成目标语言封面图',
      description: 'AI 根据识别结果和目标语言生成新的封面图。'
    },
    'cover-image.artifact': {
      title: '整理封面图产物',
      description: '服务端保存封面图生成、跳过或失败的结果。'
    }
  }
  if (displayMap[operation]) {
    return displayMap[operation]
  }
  if (stage === 'TranslationChunk') {
    return displayMap['translation.post']
  }
  return {
    title: operation || stage || 'AI 调用',
    description: '服务端记录的一次 AI 处理步骤。'
  }
}

function buildStepBadges(log) {
  const badges = []
  if (log?.provider) {
    badges.push({ label: '服务商', value: log.provider })
  }
  if (log?.model) {
    badges.push({ label: '模型', value: log.model })
  }
  if (log?.targetLanguageCode) {
    badges.push({
      label: '目标语言',
      value: formatLanguageList(log.targetLanguageCode)
    })
  }
  if (log?.meta?.chunkIndex && log?.meta?.chunkCount) {
    badges.push({
      label: '批次',
      value: `${log.meta.chunkIndex}/${log.meta.chunkCount}`
    })
  }
  if (log?.meta?.packageIndex && log?.meta?.packageCount) {
    badges.push({
      label: '分包',
      value: `${log.meta.packageIndex}/${log.meta.packageCount}`
    })
  }
  return badges
}

function buildWorkflowStep(log, index, order) {
  if (!isPlainObject(log)) {
    return null
  }
  const stepOrder = Number(order || index + 1)
  const display = getOperationDisplay(log)
  const inputSections = buildInputSections(log)
  const outputSections = buildOutputSections(log)
  return {
    id: `ai-step-${stepOrder}`,
    order: stepOrder,
    title: display.title,
    description: display.description,
    status: 'completed',
    statusText: getWorkflowStepStatusText('completed'),
    kind: 'ai',
    operation: normalizeText(log.operation),
    stage: normalizeText(log.stage),
    provider: normalizeText(log.provider),
    model: normalizeText(log.model),
    requestId: normalizeText(log.requestId),
    createdAt: log.createdAt || null,
    badges: buildStepBadges(log),
    inputSections,
    outputSections
  }
}

function buildReviewPreviewItem(entry, index) {
  if (!isPlainObject(entry)) {
    return createItem(`预览 ${index + 1}`, entry, { tone: 'output' })
  }
  const label =
    entry.label ||
    entry.fieldLabel ||
    entry.groupLabel ||
    entry.entryKey ||
    `预览 ${index + 1}`
  const value = getFirstPresentValue(
    entry.nextPreviewText,
    entry.nextPreviewRawValue,
    entry.nextValue,
    entry.previewRawValue,
    entry.value,
    entry.generatedCoverUrl,
    entry.aiSkipReason
  )
  const meta = []
  if (entry.languageCode) {
    meta.push(`语言：${formatLanguage(entry.languageCode)}`)
  }
  if (entry.groupLabel) {
    meta.push(`分组：${entry.groupLabel}`)
  }
  if (entry.aiSkipReason) {
    meta.push(`跳过原因：${entry.aiSkipReason}`)
  }
  if (entry.status) {
    meta.push(`状态：${entry.status}`)
  }
  return createItem(label, value, {
    meta,
    tone: 'output'
  })
}

function buildReviewStep(job, order, aiCallCount) {
  const result = job?.result || {}
  const previewEntries = Array.isArray(result.previewEntries)
    ? result.previewEntries
    : []
  const warningList = Array.isArray(result.warningList)
    ? result.warningList
    : []
  const aiSkipList = Array.isArray(result.aiSkipList) ? result.aiSkipList : []
  const relatedResults = Array.isArray(result.relatedResults)
    ? result.relatedResults
    : []
  if (
    previewEntries.length === 0 &&
    warningList.length === 0 &&
    aiSkipList.length === 0 &&
    relatedResults.length === 0
  ) {
    return null
  }
  const inputItems = []
  pushItem(inputItems, createItem('AI 调用记录', aiCallCount))
  pushItem(inputItems, createItem('审核预览条目', previewEntries.length))
  pushItem(inputItems, createItem('跳过条目', aiSkipList.length))
  pushItem(inputItems, createItem('关联结果', relatedResults.length))
  pushItem(inputItems, createItem('警告', warningList.length))

  const outputSections = []
  const previewSection = buildArraySection(
    '最终给人工审核的内容',
    '这些已经不是 AI 原始返回，而是服务端整理后可采纳的预览。',
    previewEntries,
    buildReviewPreviewItem,
    'output'
  )
  if (previewSection) {
    outputSections.push(previewSection)
  }
  const relatedSection = buildArraySection(
    '关联与多语言结果',
    '聚合任务中每个语言或关联内容的执行结果摘要。',
    relatedResults,
    buildRelatedResultItem,
    'output'
  )
  if (relatedSection) {
    outputSections.push(relatedSection)
  }
  const skipSection = buildArraySection(
    'AI 或服务端跳过的内容',
    '这些内容不会直接进入采纳列表，原因会显示在条目中。',
    aiSkipList,
    buildReviewPreviewItem,
    'warning'
  )
  if (skipSection) {
    outputSections.push(skipSection)
  }
  const warningSection = buildArraySection(
    '需要注意的问题',
    '任务完成但需要人工留意的提示。',
    warningList,
    (item, index) =>
      createItem(`提示 ${index + 1}`, item?.message || item, {
        tone: 'warning'
      }),
    'warning'
  )
  if (warningSection) {
    outputSections.push(warningSection)
  }

  return {
    id: `ai-step-${order}`,
    order,
    title: '生成审核预览',
    description: '服务端把 AI 的输出整理成人工可以勾选、对比和采纳的结果。',
    status: 'completed',
    statusText: getWorkflowStepStatusText('completed'),
    kind: 'review',
    operation: 'translation.review-preview',
    stage: 'FinalizeReview',
    provider: '',
    model: result.model || '',
    requestId: result.requestId || '',
    createdAt: result.completedAt || null,
    badges: [],
    inputSections: [
      createSection({
        title: '整理前的任务结果',
        description: '服务端根据 AI 输出和任务配置生成最终审核内容。',
        kind: 'metric',
        tone: 'input',
        items: inputItems
      })
    ].filter(Boolean),
    outputSections
  }
}

function buildRelatedResultItem(item, index) {
  if (!isPlainObject(item)) {
    return createItem(`关联结果 ${index + 1}`, item, { tone: 'output' })
  }
  const label = getFirstPresentValue(
    formatLanguage(item.languageCode),
    item.sourceId,
    `关联结果 ${index + 1}`
  )
  const meta = []
  if (item.isRoot === true) {
    meta.push('根文章')
  }
  if (typeof item.depth !== 'undefined') {
    meta.push(`深度：${item.depth}`)
  }
  if (item.entryCount) {
    meta.push(`审核条目：${item.entryCount}`)
  }
  if (item.model) {
    meta.push(`模型：${item.model}`)
  }
  if (item.requestId) {
    meta.push(`请求：${item.requestId}`)
  }
  return createItem(label, item.sourceId || item.targetId || label, {
    meta,
    tone: 'output'
  })
}
function buildWorkflowLogDeduplicationKey(log) {
  if (!isPlainObject(log)) {
    return ''
  }
  return JSON.stringify({
    operation: log.operation || '',
    stage: log.stage || '',
    provider: log.provider || '',
    model: log.model || '',
    requestId: log.requestId || '',
    sourceLanguageCode: log.sourceLanguageCode || '',
    targetLanguageCode: log.targetLanguageCode || '',
    meta: log.meta || {},
    input: log.input || {},
    json: log.json || log.output || {}
  })
}

function getUniqueWorkflowAiJsonLogs(aiJsonLogs) {
  if (!Array.isArray(aiJsonLogs)) {
    return []
  }
  const seenKeys = new Set()
  const logs = []
  aiJsonLogs.forEach(log => {
    const deduplicationKey = buildWorkflowLogDeduplicationKey(log)
    if (!deduplicationKey || seenKeys.has(deduplicationKey)) {
      return
    }
    seenKeys.add(deduplicationKey)
    logs.push(log)
  })
  return logs
}

function getCurrentWorkflowStep(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return null
  }
  const stoppingStep = steps.find(step => step.status === 'stopping')
  if (stoppingStep) {
    return stoppingStep
  }
  const runningStep = steps.find(step => {
    return step.status === 'running' || step.status === 'retrying'
  })
  if (runningStep) {
    return runningStep
  }
  const failedStep = steps.find(step => {
    return step.status === 'failed'
  })
  if (failedStep) {
    return failedStep
  }
  const completedSteps = steps.filter(step => {
    return step.status === 'completed'
  })
  if (completedSteps.length > 0) {
    return completedSteps[completedSteps.length - 1]
  }
  return steps[0]
}

function summarizeWorkflow(job, steps, aiCallCount) {
  const result = job?.result || {}
  const source = job?.source || {}
  const target = job?.target || {}
  let targetLanguageText = ''
  if (target.languageCode) {
    targetLanguageText = formatLanguage(target.languageCode)
  }
  if (Array.isArray(target.languageCodes) && target.languageCodes.length > 0) {
    targetLanguageText = formatLanguageList(target.languageCodes)
  }
  const previewEntries = Array.isArray(result.previewEntries)
    ? result.previewEntries
    : []
  const warningList = Array.isArray(result.warningList)
    ? result.warningList
    : []
  const aiSkipList = Array.isArray(result.aiSkipList) ? result.aiSkipList : []
  const progress = job?.progress || {}
  const currentWorkflowStep = getCurrentWorkflowStep(steps)
  return {
    jobId: normalizeText(job?._id),
    jobType: normalizeText(job?.jobType),
    status: normalizeText(job?.status),
    title: normalizeText(source.title || target.title || job?._id),
    sourceLanguage: formatLanguage(source.languageCode),
    targetLanguage: targetLanguageText,
    stepCount: steps.length,
    aiCallCount,
    runtimeStepCount: steps.filter(step => step.kind === 'runtime').length,
    currentStepId: currentWorkflowStep?.id || '',
    currentStepTitle: currentWorkflowStep?.title || '',
    currentStepStatus: currentWorkflowStep?.status || '',
    currentStepStatusText: currentWorkflowStep?.statusText || '',
    currentStage: normalizeText(progress.currentStage),
    currentProgressText: normalizeText(progress.currentStep),
    percent: Number(progress.percent || 0),
    previewEntryCount: previewEntries.length,
    skippedEntryCount: aiSkipList.length,
    warningCount: warningList.length,
    completedAt: result.completedAt || null
  }
}

function buildTranslationJobWorkflow(job) {
  const result = job?.result || {}
  const aiJsonLogs = getUniqueWorkflowAiJsonLogs(result.aiJsonLogs)
  const steps = []
  if (shouldBuildRuntimeWorkflowSteps(job, aiJsonLogs)) {
    buildRuntimeWorkflowSteps(job).forEach(step => {
      steps.push(step)
    })
  }
  let aiCallCount = 0
  aiJsonLogs.forEach((log, index) => {
    const step = buildWorkflowStep(log, index, steps.length + 1)
    if (step) {
      steps.push(step)
      aiCallCount += 1
    }
  })
  const reviewStep = buildReviewStep(job, steps.length + 1, aiCallCount)
  if (reviewStep) {
    steps.push(reviewStep)
  }
  return {
    schema: WORKFLOW_SCHEMA,
    version: WORKFLOW_VERSION,
    summary: summarizeWorkflow(job, steps, aiCallCount),
    steps
  }
}

module.exports = {
  buildTranslationJobWorkflow
}

function sanitizePromptDisplayText(text) {
  const lines = normalizeText(text)
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
  const cleanLines = lines.filter(line => {
    if (line.includes('{') || line.includes('}') || line.includes('[')) {
      return false
    }
    if (/^JSON\s*/i.test(line)) {
      return false
    }
    return true
  })
  if (cleanLines.length > 0) {
    return cleanLines.join('\n')
  }
  if (lines.length > 0) {
    return 'AI 被要求按服务端约定返回可解析结果。'
  }
  return ''
}
