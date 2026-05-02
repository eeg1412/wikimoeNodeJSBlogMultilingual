const http = require('http')
const https = require('https')
const mongoose = require('mongoose')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const aiSettingsService = require('./aiSettingsService')
const aiUsageService = require('./aiUsageService')

const TRANSLATION_JSON_SCHEMA = 'wikimoe.translation.post'
const TRANSLATION_JSON_VERSION = 2
const AI_RESULT_SCHEMA = 'wikimoe.ai.translation.result'
const SUPPORTED_ENTRY_VALUE_TYPES = new Set([
  'plainText',
  'richTextLite',
  'richTextDocument'
])
const RICH_TEXT_INDEXED_VALUE_TYPE = 'indexedRichText'
const MAX_AI_REQUEST_TEXT_LENGTH = 12000
const MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH = 6000
const RICH_TEXT_SEGMENT_CONTEXT_LENGTH = 160
const LANGUAGE_LABEL_MAP = {
  'zh-CN': '简体中文',
  'zh-HK': '香港繁体中文',
  'zh-TW': '台湾繁体中文',
  'zh-SG': '新加坡简体中文',
  'ja-JP': '日语',
  'en-US': '英语'
}

function getPostModel() {
  const repository = global.$mongodDB.multilingual.repositories.posts
  if (!repository || !repository.model) {
    throw new Error('multilingual posts repository not found')
  }

  return repository.model
}

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value)
}

function normalizePrompt(value) {
  return normalizeString(value).trim().slice(0, 6000)
}

function cloneSerializableValue(value) {
  if (typeof value === 'undefined') {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function getLanguageLabel(languageCode) {
  return LANGUAGE_LABEL_MAP[languageCode] || languageCode
}

function assertPlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `${fieldName} 必须是对象`,
      fieldName,
      400
    )
  }
}

function validateRichTextDocumentNode(node, path) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`${path} 必须是对象`)
  }

  if (node.type === 'root') {
    if (!Array.isArray(node.children)) {
      throw new Error(`${path}.children 必须是数组`)
    }
    node.children.forEach((childNode, index) => {
      validateRichTextDocumentNode(childNode, `${path}.children[${index}]`)
    })
    return
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') {
      throw new Error(`${path}.text 必须是字符串`)
    }
    return
  }

  if (node.type !== 'element') {
    throw new Error(`${path}.type 不受支持`)
  }
  if (typeof node.tag !== 'string' || !node.tag.trim()) {
    throw new Error(`${path}.tag 不能为空`)
  }
  if (node.attrs !== undefined) {
    assertRichTextAttributeMap(node.attrs, `${path}.attrs`)
  }
  if (node.translatableAttrs !== undefined) {
    assertRichTextAttributeMap(
      node.translatableAttrs,
      `${path}.translatableAttrs`
    )
  }
  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error(`${path}.children 必须是数组`)
  }
  ;(node.children || []).forEach((childNode, index) => {
    validateRichTextDocumentNode(childNode, `${path}.children[${index}]`)
  })
}

function assertRichTextAttributeMap(attributeMap, path) {
  if (
    !attributeMap ||
    typeof attributeMap !== 'object' ||
    Array.isArray(attributeMap)
  ) {
    throw new Error(`${path} 必须是对象`)
  }

  Object.entries(attributeMap).forEach(([key, value]) => {
    if (!String(key || '').trim()) {
      throw new Error(`${path} 包含空属性名`)
    }
    if (typeof value !== 'string') {
      throw new Error(`${path}.${key} 必须是字符串`)
    }
  })
}

function validateInputEntry(entry, index) {
  assertPlainObject(entry, `entries[${index}]`)
  if (!entry.id || typeof entry.id !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目缺少 id`,
      'entries',
      400
    )
  }
  if (!entry.fieldName || typeof entry.fieldName !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目缺少 fieldName`,
      'entries',
      400
    )
  }
  if (!SUPPORTED_ENTRY_VALUE_TYPES.has(entry.valueType)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目的 valueType 不受支持`,
      'entries',
      400
    )
  }
  if (entry.valueType === 'richTextDocument') {
    try {
      validateRichTextDocumentNode(entry.value, `entries[${index}].value`)
    } catch (error) {
      throw new ApiError(
        ERROR_CODES.CONTENT_FIELD_INVALID,
        `第 ${index + 1} 个富文本条目结构不合法：${error.message}`,
        'entries',
        400
      )
    }
    return
  }
  if (typeof entry.value !== 'string') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `第 ${index + 1} 个翻译条目的 value 必须是字符串`,
      'entries',
      400
    )
  }
}

function parseInput(body = {}) {
  const postId = String(body.postId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_ID_INVALID,
      'translation post id invalid',
      'postId',
      400
    )
  }

  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  const targetLanguageCode = normalizeLanguageCode(body.targetLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一个翻译条目',
      'entries',
      400
    )
  }

  body.entries.forEach((entry, index) => validateInputEntry(entry, index))

  return {
    postId,
    sourceLanguageCode,
    targetLanguageCode,
    prompt: normalizePrompt(body.prompt),
    entries: body.entries
  }
}

function parseGenericInput(body = {}) {
  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  const targetLanguageCode = normalizeLanguageCode(body.targetLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一个翻译条目',
      'entries',
      400
    )
  }

  body.entries.forEach((entry, index) => validateInputEntry(entry, index))

  return {
    contentId: String(body.contentId || '').trim(),
    contentType: String(body.contentType || 'content').trim() || 'content',
    sourceLanguageCode,
    targetLanguageCode,
    prompt: normalizePrompt(body.prompt),
    entries: body.entries,
    snapshotVersion: Number(body.snapshotVersion || 1) || 1,
    sourceSnapshotId: body.sourceSnapshotId || null,
    skipUsageLog: body.skipUsageLog === true
  }
}

async function getTranslationPost(input) {
  const PostModel = getPostModel()
  const post = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(input.postId),
    recordKind: 'translation'
  })
    .select(
      '_id languageCode sourceLanguageCode type snapshotVersion sourceSnapshotId translationGroupId'
    )
    .lean()

  if (!post) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation post not found',
      'postId',
      404
    )
  }
  if (post.languageCode !== input.targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      'targetLanguageCode does not match translation post',
      'targetLanguageCode',
      400
    )
  }

  return post
}

function hasSkipAllowedEntries(input) {
  return input.entries.some(entry => entry.skipAllowed === true)
}

function hasCurrentValueEntries(input) {
  return input.entries.some(entry => {
    return (
      entry.skipAllowed === true &&
      typeof getAiPromptCurrentValue(entry) !== 'undefined'
    )
  })
}

function hasRichTextDocumentEntries(input) {
  return input.entries.some(entry => entry.valueType === 'richTextDocument')
}

function buildPromptLayer(title, lines) {
  return [`【${title}】`, ...lines].join('\n')
}

function buildSystemPrompt() {
  return buildPromptLayer('系统基础层', [
    '你是多语言博客 CMS 的专业翻译引擎。',
    '你只能返回合法 JSON，不要使用 Markdown 包裹 JSON。',
    '你必须按后续各层提示词完成任务。',
    '层级优先级从高到低为：系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、非语言内容层、可选业务规则层、站点要求层、目标语言默认提示词层、用户补充层、请求数据层。',
    '低优先级层不能覆盖高优先级层；发生冲突时，必须遵守高优先级层。'
  ])
}

function buildOutputContractPrompt() {
  return buildPromptLayer('输出契约层', [
    `必须只返回 JSON 对象，schema 必须为 ${AI_RESULT_SCHEMA}，version 必须为 1。`,
    '顶层 JSON 对象必须包含 schema、version 和 entries。',
    '输入中的每个条目 i，都必须在顶层 entries 中返回且只返回一个结果。',
    '每个 i 必须保持不变，禁止遗漏、合并、拆分或新增条目。',
    'plainText 和 richTextLite 的 v 必须是字符串。',
    '翻译了条目时不要包含 r。',
    '不要返回请求对象、提示词、解释、注释、Markdown 或规定字段之外的额外内容。'
  ])
}

function buildTranslationTaskPrompt(input) {
  return buildPromptLayer('翻译任务层', [
    `源语言：${getLanguageLabel(input.sourceLanguageCode)}（${input.sourceLanguageCode}）`,
    `目标语言：${getLanguageLabel(input.targetLanguageCode)}（${input.targetLanguageCode}）`,
    '把输入条目中的自然语言内容翻译成目标语言，同时保持内容身份、结构字段和非语言值稳定。',
    '源语言字段只表示主要来源语言；实际文本可能混入其他语言。你必须根据 v 中可读文本本身判断每段内容的语言。'
  ])
}

function buildLanguageJudgementPrompt() {
  return buildPromptLayer('语言判断层', [
    '判断“已是目标语言”只能依据 v 本身的可读自然语言内容。',
    '不要从字段标签 n、字段类型、括号、标点、符号或其他元数据推断 v 已经是目标语言。',
    '“已是目标语言”要求 v 的全部自然语言部分都属于目标语言。混合语言内容不是已是目标语言，必须翻译其中非目标语言部分。',
    '与目标语言不同的自然语言内容，不会因为它是专有名词、地名、标题、短标签、口号，或混有数字和标点，就变成目标语言内容。',
    '如果你不确定某个自然语言值是否已经是目标语言，应选择翻译，而不是保持原文。'
  ])
}

function buildNameTranslationPrompt() {
  return buildPromptLayer('名称与专有名词层', [
    '不要因为内容是专有名词就原样保留。有意义的昵称、作者名、分类名、标签名、地名、媒体标题、选项文案、包含可读词语的文件名，都属于可翻译内容。',
    '翻译专有名词、昵称、地名、名称或标题时，要保留指代对象身份，同时产出目标语言表达。',
    '优先使用目标语言既有译名；没有既有译名时，根据语境翻译可读部分、音译，或用简洁的目标语言注释表达。',
    '禁止用专有名词、昵称、作者名、分类名、标签名、地名、中文地名、媒体标题、无需翻译、字段类型不需要翻译等理由保留 v。'
  ])
}

function buildNonLanguagePrompt() {
  return buildPromptLayer('非语言内容层', [
    '不要翻译 URL、代码标识符、segment index、CSS class、data-* 属性或媒体路径。',
    '无意义的非语言字符串仅限纯日期、纯数字、哈希、随机字母数字 ID、文件扩展名、URL、路径，或不包含可读词语的文件名。',
    '如果值包含代码块，保留代码语法；只有明确属于自然语言的注释或说明文字才翻译。'
  ])
}

function buildSkipPolicyPrompt(input) {
  if (!hasSkipAllowedEntries(input)) {
    return buildPromptLayer('翻译义务层', [
      '本请求没有允许保留原值的 k=true 条目。',
      '只要 v 包含自然语言文本，就必须翻译。'
    ])
  }

  return buildPromptLayer('k=true 保留原值规则层', [
    'k=true 是很窄的“允许保留原值”标记，不是拒绝翻译的许可。',
    '只有当 k=true，并且 v 本身完整地属于目标语言，或 v 是无意义的非语言字符串时，才允许返回原始 v。',
    '当 k=true 且你合法保留 v 不变时，必须包含 r，并用面向用户的简体中文短句说明具体原因：完整已是目标语言(源语种→目标语言语种)、URL/路径/代码、数字/日期/哈希/ID，或不可读文件名。',
    '不要用 r 为可读的源语言文本、专有名词、地名、分类、标签、昵称或混合语言文本辩解。'
  ])
}

function buildCurrentValuePolicyPrompt(input) {
  if (!hasCurrentValueEntries(input)) {
    return ''
  }

  return buildPromptLayer('当前值 c 语义层', [
    '当前值 c 只用于对比上下文。c 不是翻译源，也不能让你把 v 标记为已翻译。',
    'c 可能未翻译、可能是源语言复制值、可能过期、可能为空、也可能和 v 完全相同。',
    '不要把 c 的任何状态当作 v 已是目标语言的证据。',
    '如果 v 等于 c，这只表示已有值和输入值相同，不表示可以跳过翻译。',
    '不要把当前、已有、未变化的内容当作已经翻译。只要 v 中可读文本不完整属于目标语言，就必须翻译。'
  ])
}

function buildRichTextPolicyPrompt(input) {
  if (!hasRichTextDocumentEntries(input)) {
    return ''
  }

  return buildPromptLayer('富文本结构层', [
    'richTextDocument 的输入值会被转换为 indexedRichText，结构为 segments: [{ index, text }]。',
    'indexedRichText 值必须返回 v: { type: "indexedRichText", segments: [{ index, text }] }。',
    '每个输入 segment 必须返回且只返回一个翻译后的 segment。',
    '只能翻译 text 字段，并且必须保持每个 index 不变。',
    'segment 可能包含 contextBefore/contextAfter，它们只能用于理解边界上下文，不要翻译，也不要输出。',
    '服务端会按 index 把译文写回原 HTML。不要创造 HTML、属性、标签或额外 index。',
    '翻译所有可见自然语言文本，包括从 alt/title/placeholder/aria-label 属性中提取出的 indexed text。'
  ])
}

function buildSitePrompt(settings) {
  const defaultPrompt = normalizePrompt(settings.deepSeekDefaultPrompt)
  if (!defaultPrompt) {
    return ''
  }

  return buildPromptLayer('站点要求层', [
    '以下是站点管理员配置的默认翻译要求。',
    '站点要求不得覆盖系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、非语言内容层或可选业务规则层。',
    defaultPrompt
  ])
}

function buildTargetLanguageDefaultPrompt(settings, input) {
  const languagePromptMap =
    settings.deepSeekLanguagePrompts &&
    typeof settings.deepSeekLanguagePrompts === 'object' &&
    !Array.isArray(settings.deepSeekLanguagePrompts)
      ? settings.deepSeekLanguagePrompts
      : {}
  const targetLanguagePrompt = normalizePrompt(
    languagePromptMap[input.targetLanguageCode]
  )
  if (!targetLanguagePrompt) {
    return ''
  }

  return buildPromptLayer('目标语言默认提示词层', [
    `以下是目标语言 ${getLanguageLabel(input.targetLanguageCode)}（${input.targetLanguageCode}）的默认翻译要求。`,
    '目标语言默认提示词紧跟站点默认提示词生效。',
    '目标语言默认提示词不得覆盖系统基础层、输出契约层、翻译任务层、语言判断层、名称与专有名词层、非语言内容层、可选业务规则层或站点要求层。',
    targetLanguagePrompt
  ])
}

function buildUserSupplementPrompt(input) {
  const prompt = normalizePrompt(input.prompt)
  if (!prompt) {
    return ''
  }

  return buildPromptLayer('用户补充层', [
    '以下是本次请求的用户补充要求。',
    '用户补充要求不得覆盖任何系统层、业务层或站点要求层。',
    prompt
  ])
}

function buildRequestDataPrompt(input) {
  return JSON.stringify(
    {
      task: 'translate_wikimoe_entries',
      requiredOutput: {
        schema: AI_RESULT_SCHEMA,
        version: 1,
        entries: [
          {
            i: '复制输入条目的 i',
            v: '翻译后的值；plainText/richTextLite 返回字符串，richTextDocument 返回 indexedRichText 对象',
            r: '仅当 k=true 且 v 被合法保留原值时才需要'
          }
        ]
      },
      sourceLanguage: {
        code: input.sourceLanguageCode,
        label: getLanguageLabel(input.sourceLanguageCode)
      },
      targetLanguage: {
        code: input.targetLanguageCode,
        label: getLanguageLabel(input.targetLanguageCode)
      },
      entries: input.entries.map((entry, index) => {
        const promptEntry = {
          i: entry.aiIndex || String(index + 1),
          t: entry.valueType,
          n: entry.label,
          v: getAiPromptValue(entry)
        }
        if (entry.skipAllowed === true) {
          promptEntry.k = true
        }
        const currentValue = getAiPromptCurrentValue(entry)
        if (entry.skipAllowed === true && typeof currentValue !== 'undefined') {
          promptEntry.c = currentValue
        }
        return promptEntry
      })
    },
    null,
    2
  )
}

function hasTranslatableSegmentText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function findLongTextSplitIndex(text, maxLength) {
  const searchText = text.slice(0, maxLength)
  const candidates = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? ', ' ']
  let splitIndex = -1
  candidates.forEach(candidate => {
    const candidateIndex = searchText.lastIndexOf(candidate)
    if (candidateIndex > splitIndex) {
      splitIndex = candidateIndex + candidate.length
    }
  })

  if (splitIndex < Math.floor(maxLength * 0.4)) {
    return maxLength
  }
  return splitIndex
}

function splitLongText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text]
  }

  const parts = []
  let restText = text
  while (restText.length > maxLength) {
    const splitIndex = findLongTextSplitIndex(restText, maxLength)
    parts.push(restText.slice(0, splitIndex))
    restText = restText.slice(splitIndex)
  }
  if (restText) {
    parts.push(restText)
  }
  return parts
}

function pushRichTextSegments(segments, path, text) {
  const parts = splitLongText(text, MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH)
  let offset = 0
  parts.forEach(partText => {
    if (!hasTranslatableSegmentText(partText)) {
      offset += partText.length
      return
    }
    const startIndex = offset
    const endIndex = offset + partText.length
    offset = endIndex
    const segment = {
      index: `s${segments.length + 1}`,
      path,
      text: partText
    }
    if (parts.length > 1) {
      segment.contextBefore = text.slice(
        Math.max(0, startIndex - RICH_TEXT_SEGMENT_CONTEXT_LENGTH),
        startIndex
      )
      segment.contextAfter = text.slice(
        endIndex,
        endIndex + RICH_TEXT_SEGMENT_CONTEXT_LENGTH
      )
    }
    segments.push({
      ...segment
    })
  })
}

function collectRichTextSegments(node, path = [], segments = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return segments
  }

  if (node.type === 'text') {
    if (hasTranslatableSegmentText(node.text)) {
      pushRichTextSegments(segments, path.concat('text'), node.text)
    }
    return segments
  }

  if (node.type === 'element' && node.translatableAttrs) {
    Object.keys(node.translatableAttrs).forEach(attrName => {
      const text = node.translatableAttrs[attrName]
      if (hasTranslatableSegmentText(text)) {
        pushRichTextSegments(
          segments,
          path.concat(['translatableAttrs', attrName]),
          text
        )
      }
    })
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((childNode, index) => {
      collectRichTextSegments(
        childNode,
        path.concat(['children', index]),
        segments
      )
    })
  }

  return segments
}

function buildIndexedRichTextValue(segments) {
  return {
    type: RICH_TEXT_INDEXED_VALUE_TYPE,
    segments: segments.map(segment => {
      const item = {
        index: segment.index,
        text: segment.text
      }
      if (segment.contextBefore) {
        item.contextBefore = segment.contextBefore
      }
      if (segment.contextAfter) {
        item.contextAfter = segment.contextAfter
      }
      return item
    })
  }
}

function getAiPromptValue(entry) {
  if (entry.aiValue) {
    return entry.aiValue
  }
  return entry.value
}

function getAiPromptCurrentValue(entry) {
  if (entry.valueType === 'richTextDocument') {
    return entry.aiCurrentValue
  }
  return entry.currentValue
}

function prepareAiInput(input) {
  const entries = input.entries.map((entry, index) => {
    const indexedEntry = {
      ...entry,
      aiIndex: String(index + 1)
    }
    if (indexedEntry.valueType !== 'richTextDocument') {
      return indexedEntry
    }

    const richTextSegments = collectRichTextSegments(indexedEntry.value)
    const currentRichTextSegments =
      indexedEntry.currentValue &&
      typeof indexedEntry.currentValue === 'object' &&
      !Array.isArray(indexedEntry.currentValue)
        ? collectRichTextSegments(indexedEntry.currentValue)
        : []
    return {
      ...indexedEntry,
      richTextSegments,
      aiValue: buildIndexedRichTextValue(richTextSegments),
      aiCurrentValue:
        currentRichTextSegments.length > 0
          ? buildIndexedRichTextValue(currentRichTextSegments)
          : undefined
    }
  })

  return {
    ...input,
    entries
  }
}

function isPreparedAiEntry(entry) {
  if (!entry || !entry.aiIndex) {
    return false
  }
  if (entry.valueType !== 'richTextDocument') {
    return true
  }
  return (
    Array.isArray(entry.richTextSegments) &&
    entry.aiValue &&
    entry.aiValue.type === RICH_TEXT_INDEXED_VALUE_TYPE
  )
}

function ensurePreparedAiInput(input) {
  if (
    input &&
    Array.isArray(input.entries) &&
    input.entries.every(entry => isPreparedAiEntry(entry))
  ) {
    return input
  }
  return prepareAiInput(input)
}

function getAiEntryTextLength(entry) {
  const value = getAiPromptValue(entry)
  if (
    value &&
    value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    Array.isArray(value.segments)
  ) {
    return value.segments.reduce((total, segment) => {
      return total + normalizeString(segment.text).length + 16
    }, 0)
  }
  return normalizeString(value).length + 64
}

function splitRichTextAiEntry(entry) {
  const value = getAiPromptValue(entry)
  if (
    !value ||
    value.type !== RICH_TEXT_INDEXED_VALUE_TYPE ||
    !Array.isArray(value.segments) ||
    value.segments.length === 0
  ) {
    return [entry]
  }

  const slices = []
  let currentSegments = []
  let currentLength = 0

  function pushCurrentSlice() {
    if (currentSegments.length === 0) {
      return
    }
    slices.push({
      ...entry,
      aiValue: {
        type: RICH_TEXT_INDEXED_VALUE_TYPE,
        segments: currentSegments
      }
    })
    currentSegments = []
    currentLength = 0
  }

  value.segments.forEach(segment => {
    const segmentLength = normalizeString(segment.text).length + 16
    if (
      currentSegments.length > 0 &&
      currentLength + segmentLength > MAX_RICH_TEXT_SEGMENT_TEXT_LENGTH
    ) {
      pushCurrentSlice()
    }
    currentSegments.push(segment)
    currentLength += segmentLength
  })
  pushCurrentSlice()

  return slices
}

function splitAiInput(input) {
  const chunks = []
  let currentEntries = []
  let currentLength = 0

  function pushCurrentChunk() {
    if (currentEntries.length === 0) {
      return
    }
    chunks.push({
      ...input,
      entries: currentEntries
    })
    currentEntries = []
    currentLength = 0
  }

  input.entries.forEach(entry => {
    const slices = splitRichTextAiEntry(entry)
    slices.forEach(slice => {
      const sliceLength = getAiEntryTextLength(slice)
      const hasSameEntryInCurrentChunk = currentEntries.some(currentEntry => {
        return currentEntry.id === slice.id
      })
      if (
        currentEntries.length > 0 &&
        (hasSameEntryInCurrentChunk ||
          currentLength + sliceLength > MAX_AI_REQUEST_TEXT_LENGTH)
      ) {
        pushCurrentChunk()
      }
      currentEntries.push(slice)
      currentLength += sliceLength
    })
  })
  pushCurrentChunk()

  if (chunks.length === 0) {
    return [{ ...input, entries: [] }]
  }
  return chunks
}

function buildDeepSeekMessages(settings, input) {
  const systemPromptList = [
    buildSystemPrompt(),
    buildOutputContractPrompt(),
    buildTranslationTaskPrompt(input),
    buildLanguageJudgementPrompt(input),
    buildNameTranslationPrompt(input),
    buildNonLanguagePrompt(input),
    buildSkipPolicyPrompt(input),
    buildCurrentValuePolicyPrompt(input),
    buildRichTextPolicyPrompt(input),
    buildSitePrompt(settings),
    buildTargetLanguageDefaultPrompt(settings, input)
  ].filter(Boolean)

  const messages = systemPromptList.map(content => ({
    role: 'system',
    content
  }))

  const userSupplementPrompt = buildUserSupplementPrompt(input)
  if (userSupplementPrompt) {
    messages.push({
      role: 'user',
      content: userSupplementPrompt
    })
  }

  messages.push({
    role: 'user',
    content: buildRequestDataPrompt(input)
  })

  return messages
}

function buildDeepSeekRequestBody(settings, input) {
  const requestBody = {
    model: settings.deepSeekModel,
    messages: buildDeepSeekMessages(settings, input),
    response_format: { type: 'json_object' },
    max_tokens: settings.deepSeekMaxTokens,
    stream: false
  }

  if (settings.deepSeekThinkingType === 'enabled') {
    requestBody.thinking = { type: 'enabled' }
    requestBody.reasoning_effort = settings.deepSeekReasoningEffort
    return requestBody
  }

  requestBody.thinking = { type: 'disabled' }
  requestBody.temperature = settings.deepSeekTemperature
  return requestBody
}

function buildDeepSeekStreamRequestBody(settings, input) {
  const requestBody = buildDeepSeekRequestBody(settings, input)
  requestBody.stream = true
  requestBody.stream_options = { include_usage: true }
  return requestBody
}

function buildChatCompletionUrl(settings) {
  const baseUrl = String(settings.deepSeekBaseUrl || '').trim()
  if (!baseUrl) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'DeepSeek Base URL 不能为空',
      'deepSeekBaseUrl',
      400
    )
  }

  try {
    const url = new URL(baseUrl.replace(/\/+$/, '') + '/chat/completions')
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol')
    }
    return url
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'DeepSeek Base URL 格式不正确',
      'deepSeekBaseUrl',
      400
    )
  }
}

function createTranslationCancelledError(reason) {
  const message = String(reason || '').trim() || 'AI 翻译已停止'
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    message,
    'translation',
    499
  )
}

function isCancellationRequested(options = {}) {
  return options.cancellation?.isCancelled === true
}

function throwIfCancellationRequested(options = {}) {
  if (!isCancellationRequested(options)) {
    return
  }
  throw createTranslationCancelledError(options.cancellation?.reason)
}

function bindCancellation(request, options = {}) {
  const cancellation = options.cancellation
  if (!cancellation || typeof cancellation.onCancel !== 'function') {
    return () => {}
  }

  return cancellation.onCancel(reason => {
    request.destroy(createTranslationCancelledError(reason))
  })
}

function requestJson(url, requestBody, settings, options = {}) {
  throwIfCancellationRequested(options)
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 120) * 1000

  return new Promise((resolve, reject) => {
    let unbindCancellation = () => {}
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.deepSeekApiKey}`,
          'Content-Length': Buffer.byteLength(requestText)
        },
        timeout
      },
      response => {
        const chunks = []
        response.on('data', chunk => {
          chunks.push(chunk)
        })
        response.on('end', () => {
          unbindCancellation()
          const responseText = Buffer.concat(chunks).toString('utf8')
          let responseData = null
          try {
            responseData = JSON.parse(responseText)
          } catch (error) {
            resolve({
              statusCode: response.statusCode,
              data: {
                rawText: responseText
              },
              parseError: true
            })
            return
          }

          resolve({
            statusCode: response.statusCode,
            data: responseData
          })
        })
      }
    )

    unbindCancellation = bindCancellation(request, options)
    if (isCancellationRequested(options)) {
      request.destroy(
        createTranslationCancelledError(options.cancellation?.reason)
      )
      return
    }

    request.on('timeout', () => {
      request.destroy(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          'DeepSeek 请求超时',
          'deepSeek',
          504
        )
      )
    })
    request.on('error', error => {
      unbindCancellation()
      if (error && error.name === 'ApiError') {
        reject(error)
        return
      }
      reject(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || 'DeepSeek 请求失败',
          'deepSeek',
          502
        )
      )
    })
    request.write(requestText)
    request.end()
  })
}

function parseSseBlock(block) {
  const dataLines = block
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
  if (dataLines.length === 0) {
    return null
  }
  return dataLines.join('\n')
}

function findSseBoundary(buffer) {
  const lfIndex = buffer.indexOf('\n\n')
  const crlfIndex = buffer.indexOf('\r\n\r\n')
  if (lfIndex < 0 && crlfIndex < 0) {
    return { index: -1, length: 0 }
  }
  if (lfIndex < 0) {
    return { index: crlfIndex, length: 4 }
  }
  if (crlfIndex < 0) {
    return { index: lfIndex, length: 2 }
  }
  if (lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 }
  }
  return { index: crlfIndex, length: 4 }
}

function requestStream(
  url,
  requestBody,
  settings,
  handlers = {},
  options = {}
) {
  throwIfCancellationRequested(options)
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 300) * 1000

  return new Promise((resolve, reject) => {
    let unbindCancellation = () => {}
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${settings.deepSeekApiKey}`,
          'Content-Length': Buffer.byteLength(requestText)
        },
        timeout
      },
      response => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          collectNonStreamResponse(response, resolve)
          return
        }

        if (handlers.onStatus) {
          handlers.onStatus({ message: '已连接 AI 服务' })
        }

        const streamChunks = []
        let buffer = ''
        let content = ''
        let reasoningContent = ''
        let usage = {}
        let responseId = ''
        let responseModel = settings.deepSeekModel

        function handleDataText(dataText) {
          if (!dataText || dataText === '[DONE]') {
            return
          }

          let chunkData = null
          try {
            chunkData = JSON.parse(dataText)
          } catch (error) {
            throw new ApiError(
              ERROR_CODES.AI_TRANSLATION_FAILED,
              'DeepSeek 流式返回解析失败',
              'deepSeek',
              502
            )
          }

          streamChunks.push(chunkData)
          if (chunkData.id && !responseId) {
            responseId = chunkData.id
          }
          if (chunkData.model) {
            responseModel = chunkData.model
          }
          if (chunkData.usage) {
            usage = chunkData.usage
          }

          const delta = chunkData.choices?.[0]?.delta || {}
          const contentDelta = delta.content || ''
          const reasoningDelta = delta.reasoning_content || ''
          if (contentDelta) {
            content += contentDelta
          }
          if (reasoningDelta) {
            reasoningContent += reasoningDelta
          }
          if (handlers.onChunk && (contentDelta || reasoningDelta)) {
            handlers.onChunk({ contentDelta, reasoningDelta })
          }
        }

        function consumeBuffer() {
          let boundary = findSseBoundary(buffer)
          while (boundary.index >= 0) {
            const boundaryIndex = boundary.index
            const block = buffer.slice(0, boundaryIndex)
            buffer = buffer.slice(boundaryIndex + boundary.length)
            const dataText = parseSseBlock(block)
            handleDataText(dataText)
            boundary = findSseBoundary(buffer)
          }
        }

        response.on('data', chunk => {
          try {
            buffer += chunk.toString('utf8')
            consumeBuffer()
          } catch (error) {
            request.destroy(error)
          }
        })
        response.on('end', () => {
          try {
            unbindCancellation()
            if (buffer.trim()) {
              const dataText = parseSseBlock(buffer)
              handleDataText(dataText)
            }
            resolve({
              statusCode: response.statusCode,
              data: {
                id: responseId,
                model: responseModel,
                object: 'chat.completion.stream',
                choices: [
                  {
                    message: {
                      content,
                      reasoning_content: reasoningContent
                    }
                  }
                ],
                usage,
                streamChunks
              }
            })
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    unbindCancellation = bindCancellation(request, options)
    if (isCancellationRequested(options)) {
      request.destroy(
        createTranslationCancelledError(options.cancellation?.reason)
      )
      return
    }

    request.on('timeout', () => {
      request.destroy(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          'DeepSeek 请求超时',
          'deepSeek',
          504
        )
      )
    })
    request.on('error', error => {
      unbindCancellation()
      if (error && error.name === 'ApiError') {
        reject(error)
        return
      }
      reject(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || 'DeepSeek 请求失败',
          'deepSeek',
          502
        )
      )
    })
    request.write(requestText)
    request.end()
  })
}

function collectNonStreamResponse(response, resolve) {
  const chunks = []
  response.on('data', chunk => {
    chunks.push(chunk)
  })
  response.on('end', () => {
    const responseText = Buffer.concat(chunks).toString('utf8')
    let responseData = null
    try {
      responseData = JSON.parse(responseText)
    } catch (error) {
      responseData = { rawText: responseText }
    }
    resolve({
      statusCode: response.statusCode,
      data: responseData
    })
  })
}

function parseAiContent(responseData) {
  const content = responseData?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'DeepSeek 没有返回可用内容',
      'deepSeek',
      502
    )
  }

  try {
    return JSON.parse(content)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'DeepSeek 返回的 JSON 内容解析失败',
      'deepSeek',
      502
    )
  }
}

function buildEntriesFromObjectMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }
  return Object.entries(value)
    .map(([key, entryValue]) => {
      if (/^\d+$/.test(key)) {
        return { i: key, v: entryValue }
      }
      return { n: key, v: entryValue }
    })
    .filter(item => item.v !== undefined)
}

function normalizeResultEntries(resultData) {
  if (Array.isArray(resultData)) {
    return resultData
  }

  if (!resultData || typeof resultData !== 'object') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'DeepSeek 返回的 JSON 根节点必须是对象',
      'deepSeek',
      502
    )
  }

  const candidateEntries = [
    resultData.entries,
    resultData.translations,
    resultData.data?.entries,
    resultData.result?.entries,
    resultData.payload?.entries
  ]
  for (const entries of candidateEntries) {
    if (Array.isArray(entries)) {
      return entries
    }
    const mappedEntries = buildEntriesFromObjectMap(entries)
    if (mappedEntries.length > 0) {
      return mappedEntries
    }
  }

  const ignoredKeys = new Set(['schema', 'version', 'meta', 'usage'])
  const mappedEntries = buildEntriesFromObjectMap(
    Object.fromEntries(
      Object.entries(resultData).filter(([key]) => !ignoredKeys.has(key))
    )
  )
  if (mappedEntries.length > 0) {
    return mappedEntries
  }

  const actualKeys = Object.keys(resultData).join(', ')
  throw new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    `DeepSeek 返回 JSON 缺少 entries，实际字段：${actualKeys || '无'}`,
    'deepSeek',
    502
  )
}

function mergeTranslatedRichTextNode(originalNode, translatedNode) {
  if (!originalNode || typeof originalNode !== 'object') {
    return originalNode
  }

  const result = cloneSerializableValue(originalNode)
  if (!translatedNode || typeof translatedNode !== 'object') {
    return result
  }

  if (result.type === 'text') {
    if (typeof translatedNode.text === 'string') {
      result.text = translatedNode.text
    }
    return result
  }

  if (result.type === 'element') {
    if (
      result.translatableAttrs &&
      translatedNode.translatableAttrs &&
      typeof translatedNode.translatableAttrs === 'object'
    ) {
      Object.keys(result.translatableAttrs).forEach(key => {
        if (typeof translatedNode.translatableAttrs[key] === 'string') {
          result.translatableAttrs[key] = translatedNode.translatableAttrs[key]
        }
      })
    }
  }

  if (
    Array.isArray(result.children) &&
    Array.isArray(translatedNode.children)
  ) {
    result.children = result.children.map((childNode, index) => {
      return mergeTranslatedRichTextNode(
        childNode,
        translatedNode.children[index]
      )
    })
  }

  return result
}

function setRichTextValueByPath(documentValue, path, text) {
  let current = documentValue
  for (let index = 0; index < path.length - 1; index += 1) {
    current = current?.[path[index]]
    if (!current || typeof current !== 'object') {
      return false
    }
  }
  const key = path[path.length - 1]
  if (typeof key === 'undefined') {
    return false
  }
  current[key] = text
  return true
}

function normalizeIndexedRichTextSegments(entry, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的富文本索引结果不合法：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }
  if (value.type !== RICH_TEXT_INDEXED_VALUE_TYPE) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的富文本类型不合法：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }
  const segmentList = Array.isArray(value.segments) ? value.segments : value.s
  if (!Array.isArray(segmentList)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的富文本 segments 不合法：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }

  const segmentMap = new Map()
  segmentList.forEach(segment => {
    const segmentIndex = segment?.index || segment?.i
    const segmentText = segment?.text ?? segment?.x ?? segment?.v
    if (!segment || typeof segmentIndex !== 'string') {
      return
    }
    if (typeof segmentText === 'string') {
      segmentMap.set(segmentIndex, segmentText)
    }
  })
  return segmentMap
}

function getResultEntryKey(item) {
  if (!item || typeof item !== 'object') {
    return ''
  }
  if (item.i !== undefined && item.i !== null) {
    return String(item.i)
  }
  if (typeof item.id === 'string') {
    return item.id
  }
  return ''
}

function getResultEntryValue(item) {
  if (!item || typeof item !== 'object') {
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(item, 'v')) {
    return item.v
  }
  return item.value
}

function getResultEntrySkipReason(item) {
  if (!item || typeof item !== 'object') {
    return ''
  }
  return normalizeString(item.r).trim().slice(0, 300)
}

function normalizeFallbackKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function addCandidateKey(candidateList, value) {
  const key = normalizeFallbackKey(value)
  if (key && !candidateList.includes(key)) {
    candidateList.push(key)
  }
}

function getLabelLastPart(label) {
  const text = String(label || '')
  if (!text.includes(' / ')) {
    return text
  }
  const parts = text.split(' / ')
  return parts[parts.length - 1]
}

function getInputEntryCandidateKeys(entry) {
  const candidateList = []
  addCandidateKey(candidateList, entry.label)
  addCandidateKey(candidateList, getLabelLastPart(entry.label))
  addCandidateKey(candidateList, entry.fieldName)
  addCandidateKey(candidateList, entry.n)
  return candidateList
}

function getResultEntryCandidateKeys(item) {
  const candidateList = []
  addCandidateKey(candidateList, item.n)
  addCandidateKey(candidateList, item.label)
  addCandidateKey(candidateList, item.name)
  addCandidateKey(candidateList, item.fieldName)
  addCandidateKey(candidateList, getResultEntryKey(item))
  return candidateList
}

function buildUniqueCandidateMap(itemList, getCandidateKeys) {
  const candidateMap = new Map()
  const duplicatedKeySet = new Set()
  itemList.forEach(item => {
    getCandidateKeys(item).forEach(key => {
      if (duplicatedKeySet.has(key)) {
        return
      }
      if (candidateMap.has(key)) {
        candidateMap.delete(key)
        duplicatedKeySet.add(key)
        return
      }
      candidateMap.set(key, item)
    })
  })
  return candidateMap
}

function findTranslatedEntry(
  entry,
  resultMap,
  resultCandidateMap,
  inputCandidateMap
) {
  const translatedEntry =
    resultMap.get(entry.aiIndex) || resultMap.get(entry.id)
  if (translatedEntry) {
    return translatedEntry
  }

  const candidateList = getInputEntryCandidateKeys(entry)
  for (const candidateKey of candidateList) {
    if (inputCandidateMap.get(candidateKey) !== entry) {
      continue
    }
    const fallbackEntry = resultCandidateMap.get(candidateKey)
    if (fallbackEntry) {
      return fallbackEntry
    }
  }
  return null
}

function applyIndexedRichTextTranslation(entry, value) {
  const richTextSegments = entry.richTextSegments || []
  if (richTextSegments.length === 0) {
    return cloneSerializableValue(entry.value)
  }

  const translatedSegmentMap = normalizeIndexedRichTextSegments(entry, value)
  const mergedValue = cloneSerializableValue(entry.value)
  const translatedPathMap = new Map()
  for (const segment of richTextSegments) {
    if (!translatedSegmentMap.has(segment.index)) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `DeepSeek 返回结果缺少富文本片段：${entry.label || entry.id} / ${segment.index}`,
        'deepSeek',
        502
      )
    }
    const pathKey = JSON.stringify(segment.path)
    if (!translatedPathMap.has(pathKey)) {
      translatedPathMap.set(pathKey, {
        path: segment.path,
        text: ''
      })
    }
    const pathItem = translatedPathMap.get(pathKey)
    pathItem.text += translatedSegmentMap.get(segment.index)
  }

  for (const pathItem of translatedPathMap.values()) {
    const isUpdated = setRichTextValueByPath(
      mergedValue,
      pathItem.path,
      pathItem.text
    )
    if (!isUpdated) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `富文本片段回填失败：${entry.label || entry.id}`,
        'deepSeek',
        502
      )
    }
  }

  try {
    validateRichTextDocumentNode(mergedValue, entry.id)
  } catch (error) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的富文本结构不合法：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }
  return mergedValue
}

function normalizeTranslatedValue(entry, value) {
  if (entry.valueType === 'richTextDocument') {
    if (value?.type === RICH_TEXT_INDEXED_VALUE_TYPE) {
      return applyIndexedRichTextTranslation(entry, value)
    }

    const mergedValue = mergeTranslatedRichTextNode(entry.value, value)
    try {
      validateRichTextDocumentNode(mergedValue, entry.id)
    } catch (error) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `DeepSeek 返回的富文本结构不合法：${entry.label || entry.id}`,
        'deepSeek',
        502
      )
    }
    return mergedValue
  }

  if (typeof value !== 'string') {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的条目不是字符串：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }

  return value
}

function buildTranslatedPayload(input, post, resultData) {
  const preparedInput = ensurePreparedAiInput(input)
  const resultEntries = normalizeResultEntries(resultData)
  const resultMap = new Map()
  resultEntries.forEach(item => {
    const key = getResultEntryKey(item)
    if (key) {
      resultMap.set(key, item)
    }
  })
  const resultCandidateMap = buildUniqueCandidateMap(
    resultEntries,
    getResultEntryCandidateKeys
  )
  const inputCandidateMap = buildUniqueCandidateMap(
    preparedInput.entries,
    getInputEntryCandidateKeys
  )

  const entries = preparedInput.entries.map(entry => {
    const translatedEntry = findTranslatedEntry(
      entry,
      resultMap,
      resultCandidateMap,
      inputCandidateMap
    )
    if (!translatedEntry) {
      const actualKeys = resultEntries
        .map(item => getResultEntryKey(item) || item.n || item.label || '')
        .filter(Boolean)
        .join(', ')
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `DeepSeek 返回结果缺少条目：${entry.label || entry.id}，期望 i=${entry.aiIndex}，实际返回：${actualKeys || '无'}`,
        'deepSeek',
        502
      )
    }
    const normalizedValue = normalizeTranslatedValue(
      entry,
      getResultEntryValue(translatedEntry)
    )
    const skipReason = getResultEntrySkipReason(translatedEntry)
    const keptOriginal =
      entry.skipAllowed === true &&
      entry.valueType !== 'richTextDocument' &&
      normalizeString(normalizedValue).trim() ===
        normalizeString(entry.value).trim()

    if (keptOriginal && !skipReason) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `AI 跳过内容缺少原因：${entry.label || entry.id}`,
        'deepSeek',
        502
      )
    }

    const outputEntry = {
      id: entry.id,
      scope: entry.scope,
      label: entry.label,
      groupLabel: entry.groupLabel,
      fieldName: entry.fieldName,
      valueType: entry.valueType,
      value: normalizedValue
    }
    if (keptOriginal) {
      outputEntry.aiSkipReason = skipReason
    }
    if (entry.collectionName) {
      outputEntry.collectionName = entry.collectionName
    }
    if (entry.relationField) {
      outputEntry.relationField = entry.relationField
    }
    if (entry.recordId) {
      outputEntry.recordId = entry.recordId
    }
    if (entry.recordKind) {
      outputEntry.recordKind = entry.recordKind
    }
    if (entry.sourceRecordId) {
      outputEntry.sourceRecordId = entry.sourceRecordId
    }
    if (entry.recordLabel) {
      outputEntry.recordLabel = entry.recordLabel
    }
    if (entry.optionId) {
      outputEntry.optionId = entry.optionId
    }
    if (Number.isInteger(entry.optionIndex)) {
      outputEntry.optionIndex = entry.optionIndex
    }
    if (Number.isInteger(entry.urlIndex)) {
      outputEntry.urlIndex = entry.urlIndex
    }
    if (entry.sourceId) {
      outputEntry.sourceId = entry.sourceId
    }
    if (entry.sourceSnapshotId) {
      outputEntry.sourceSnapshotId = entry.sourceSnapshotId
    }
    if (entry.relationTypeLabel) {
      outputEntry.relationTypeLabel = entry.relationTypeLabel
    }
    if (entry.assets && Object.keys(entry.assets).length > 0) {
      outputEntry.assets = entry.assets
    }

    return outputEntry
  })

  return {
    schema: TRANSLATION_JSON_SCHEMA,
    version: TRANSLATION_JSON_VERSION,
    meta: {
      postId: preparedInput.postId || '',
      contentId: preparedInput.contentId || preparedInput.postId || '',
      contentType: preparedInput.contentType || 'post',
      languageCode: preparedInput.targetLanguageCode,
      sourceLanguageCode: preparedInput.sourceLanguageCode,
      postType: Number(post?.type || preparedInput.postType || 1),
      snapshotVersion: Number(
        post?.snapshotVersion || preparedInput.snapshotVersion || 1
      ),
      exportedAt: new Date().toISOString(),
      generatedBy: 'deepseek',
      richTextFormat: 'structured-html-dom-v1',
      richTextInstruction:
        '富文本字段使用结构化 JSON。AI 只允许翻译 text 与 translatableAttrs 中的自然语言，不允许修改 tag、attrs、children、src、href、style、data-* 等结构字段。'
    },
    entries
  }
}

function mergeUsageValue(leftValue, rightValue) {
  if (typeof rightValue === 'number' && Number.isFinite(rightValue)) {
    if (typeof leftValue === 'number' && Number.isFinite(leftValue)) {
      return leftValue + rightValue
    }
    return rightValue
  }

  if (
    rightValue &&
    typeof rightValue === 'object' &&
    !Array.isArray(rightValue)
  ) {
    const result = {}
    if (
      leftValue &&
      typeof leftValue === 'object' &&
      !Array.isArray(leftValue)
    ) {
      Object.assign(result, cloneSerializableValue(leftValue))
    }
    Object.entries(rightValue).forEach(([key, value]) => {
      result[key] = mergeUsageValue(result[key], value)
    })
    return result
  }

  if (typeof leftValue === 'undefined') {
    return cloneSerializableValue(rightValue)
  }
  return leftValue
}

function mergeUsage(leftUsage = {}, rightUsage = {}) {
  return mergeUsageValue(leftUsage, rightUsage) || {}
}

function mergeChunkResultEntry(resultMap, entry) {
  const entryKey =
    getResultEntryKey(entry) || getResultEntryCandidateKeys(entry)[0]
  if (!entryKey) {
    return
  }

  const value = getResultEntryValue(entry)
  if (
    value &&
    value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    (Array.isArray(value.segments) || Array.isArray(value.s))
  ) {
    const segmentList = Array.isArray(value.segments) ? value.segments : value.s
    if (!resultMap.has(entryKey)) {
      resultMap.set(entryKey, {
        i: entryKey,
        v: {
          type: RICH_TEXT_INDEXED_VALUE_TYPE,
          segments: []
        }
      })
    }
    const mergedEntry = resultMap.get(entryKey)
    mergedEntry.v.segments.push(...segmentList)
    return
  }

  resultMap.set(entryKey, entry)
}

function buildAggregateRawResponse({
  chunkResponses,
  usage,
  model,
  requestId,
  error
}) {
  const rawResponse = {
    object: 'chat.completion.stream.batch',
    id: requestId || '',
    model: model || '',
    usage: usage || {},
    chunks: chunkResponses.map(item => item.data)
  }
  if (error) {
    rawResponse.error = {
      message: error.message || 'AI 翻译失败',
      code: error.code || ERROR_CODES.AI_TRANSLATION_FAILED
    }
  }
  return rawResponse
}

async function recordTranslationUsage({
  post,
  input,
  responseData,
  status,
  httpStatusCode,
  stream,
  chunkCount,
  parseError
}) {
  if (input.skipUsageLog === true) {
    return
  }

  await aiUsageService.recordAiUsageLog({
    provider: 'deepseek',
    model: responseData.model || '',
    operation: input.operation || 'translation.post',
    status,
    requestId: responseData.id || '',
    postId: post?._id,
    translationGroupId: post?.translationGroupId,
    sourceSnapshotId: post?.sourceSnapshotId || input.sourceSnapshotId,
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    usage: responseData.usage || {},
    rawResponse: responseData,
    meta: {
      httpStatusCode,
      stream: Boolean(stream),
      parseError: Boolean(parseError),
      entryCount: input.entries.length,
      chunkCount: chunkCount || 1
    }
  })
}

async function translatePostEntries(body = {}) {
  const input = parseInput(body)
  const post = await getTranslationPost(input)
  const settings = await aiSettingsService.getDeepSeekRuntimeSettings()
  const aiInput = prepareAiInput(input)
  const requestBody = buildDeepSeekRequestBody(settings, aiInput)
  const url = buildChatCompletionUrl(settings)
  const deepSeekResponse = await requestJson(url, requestBody, settings)
  const responseData = deepSeekResponse.data
  const isSuccessStatus =
    deepSeekResponse.statusCode >= 200 && deepSeekResponse.statusCode < 300
  let usageStatus = 'error'
  if (isSuccessStatus && !deepSeekResponse.parseError) {
    usageStatus = 'success'
  }
  await aiUsageService.recordAiUsageLog({
    provider: 'deepseek',
    model: responseData.model || settings.deepSeekModel,
    operation: 'translation.post',
    status: usageStatus,
    requestId: responseData.id || '',
    postId: post._id,
    translationGroupId: post.translationGroupId,
    sourceSnapshotId: post.sourceSnapshotId,
    sourceLanguageCode: input.sourceLanguageCode,
    targetLanguageCode: input.targetLanguageCode,
    usage: responseData.usage || {},
    rawResponse: responseData,
    meta: {
      httpStatusCode: deepSeekResponse.statusCode,
      parseError: Boolean(deepSeekResponse.parseError),
      entryCount: input.entries.length
    }
  })

  if (deepSeekResponse.parseError) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      'DeepSeek 返回内容不是 JSON',
      'deepSeek',
      502
    )
  }

  if (!isSuccessStatus) {
    const message =
      responseData.error?.message ||
      responseData.message ||
      `DeepSeek 请求失败：${deepSeekResponse.statusCode}`
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      message,
      'deepSeek',
      502
    )
  }

  const resultData = parseAiContent(responseData)
  const payload = buildTranslatedPayload(aiInput, post, resultData)

  return {
    payload,
    model: responseData.model || settings.deepSeekModel,
    usage: responseData.usage || null,
    requestId: responseData.id || null
  }
}

async function translatePreparedEntriesStream(input, post, handlers = {}) {
  const settings = await aiSettingsService.getDeepSeekRuntimeSettings()
  const url = buildChatCompletionUrl(settings)
  const aiInput = prepareAiInput(input)
  const inputChunks = splitAiInput(aiInput)
  const chunkTotal = inputChunks.length
  const chunkResponses = []
  const resultMap = new Map()
  let combinedUsage = {}
  let responseModel = settings.deepSeekModel
  let responseId = ''

  if (handlers.onStatus) {
    handlers.onStatus({
      message: `正在准备 ${chunkTotal} 个翻译批次`
    })
  }

  try {
    for (let index = 0; index < inputChunks.length; index += 1) {
      throwIfCancellationRequested(handlers)
      const chunkInput = inputChunks[index]
      if (handlers.onStatus) {
        handlers.onStatus({
          message: `正在翻译第 ${index + 1}/${chunkTotal} 批`
        })
      }

      const requestBody = buildDeepSeekStreamRequestBody(settings, chunkInput)
      const deepSeekResponse = await requestStream(
        url,
        requestBody,
        settings,
        {
          onStatus: handlers.onStatus,
          onChunk: handlers.onChunk
        },
        handlers
      )
      chunkResponses.push(deepSeekResponse)

      const responseData = deepSeekResponse.data
      responseModel = responseData.model || responseModel
      if (responseData.id && !responseId) {
        responseId = responseData.id
      }
      combinedUsage = mergeUsage(combinedUsage, responseData.usage || {})

      const isSuccessStatus =
        deepSeekResponse.statusCode >= 200 && deepSeekResponse.statusCode < 300
      if (!isSuccessStatus) {
        const message =
          responseData.error?.message ||
          responseData.message ||
          `DeepSeek 请求失败：${deepSeekResponse.statusCode}`
        throw new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          message,
          'deepSeek',
          502
        )
      }

      const resultData = parseAiContent(responseData)
      normalizeResultEntries(resultData).forEach(entry => {
        mergeChunkResultEntry(resultMap, entry)
      })

      if (handlers.onStatus) {
        handlers.onStatus({
          message: `已完成第 ${index + 1}/${chunkTotal} 批`
        })
      }

      throwIfCancellationRequested(handlers)
    }

    const responseData = buildAggregateRawResponse({
      chunkResponses,
      usage: combinedUsage,
      model: responseModel,
      requestId: responseId
    })
    await recordTranslationUsage({
      post,
      input,
      responseData,
      status: 'success',
      httpStatusCode: 200,
      stream: true,
      chunkCount: inputChunks.length
    })

    const payload = buildTranslatedPayload(aiInput, post, {
      entries: Array.from(resultMap.values())
    })
    const data = {
      payload,
      model: responseModel,
      usage: combinedUsage,
      requestId: responseId || null
    }
    if (handlers.onResult) {
      handlers.onResult(data)
    }
    return data
  } catch (error) {
    const isCancelled = error?.code === ERROR_CODES.AI_TRANSLATION_CANCELLED
    const responseData = buildAggregateRawResponse({
      chunkResponses,
      usage: combinedUsage,
      model: responseModel,
      requestId: responseId,
      error
    })
    await recordTranslationUsage({
      post,
      input,
      responseData,
      status: isCancelled ? 'cancelled' : 'error',
      httpStatusCode: isCancelled ? 499 : error?.statusCode || 502,
      stream: true,
      chunkCount: inputChunks.length
    })
    throw error
  }
}

async function translatePostEntriesStream(body = {}, handlers = {}) {
  const input = parseInput(body)
  const post = await getTranslationPost(input)
  return await translatePreparedEntriesStream(input, post, handlers)
}

async function translateContentEntriesStream(body = {}, handlers = {}) {
  const input = {
    ...parseGenericInput(body),
    operation: 'translation.content'
  }
  return await translatePreparedEntriesStream(input, null, handlers)
}

module.exports = {
  translatePostEntries,
  translatePostEntriesStream,
  translateContentEntriesStream
}
