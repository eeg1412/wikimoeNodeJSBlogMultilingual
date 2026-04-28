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

function buildSystemPrompt(settings) {
  return [
    'You are a professional translation engine for a multilingual blog CMS.',
    'You must return valid JSON only. Do not wrap the JSON in markdown.',
    'Translate natural-language content from the source language to the target language.',
    'For richTextDocument values, the input value is indexedRichText with segments [{ index, text }]. Translate only the text field and keep every index unchanged.',
    'Some indexedRichText segments may include contextBefore/contextAfter. They are reference context only; do not translate or include them in output.',
    'The server will write translated segment text back into the original HTML by index. Do not invent HTML, attributes, tags, or extra indexes.',
    'Do not change id, index, URLs, code identifiers, media paths, or non-natural-language values.',
    'For plainText values, return a translated string.',
    'Do not add explanations, comments, or extra entries.',
    `Default site prompt: ${settings.deepSeekDefaultPrompt}`
  ].join('\n')
}

function buildUserPrompt(input) {
  return JSON.stringify(
    {
      task: 'translate_wikimoe_entries',
      requiredOutput: {
        schema: AI_RESULT_SCHEMA,
        version: 1,
        entries: [
          {
            id: 'entry id copied from input',
            value:
              'translated value; string for plainText/richTextLite, indexedRichText object for richTextDocument'
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
      userPrompt: input.prompt,
      rules: [
        'Return only the requiredOutput object. Do not return this request object, response schema, rules, markdown, or explanations.',
        'The top-level JSON object must contain schema, version, and entries.',
        'Return exactly one item in top-level entries for every input entry id.',
        'Keep every id unchanged.',
        'For indexedRichText values, return value as { type: "indexedRichText", segments: [{ index, text }] }. Return exactly one translated segment for every input segment.',
        'If a segment includes contextBefore/contextAfter, use it only to understand the boundary context. Output must contain translated text for the segment text only.',
        'Translate all visible natural-language text, including indexed text extracted from alt/title/placeholder/aria-label attributes.',
        'Never translate URLs, code identifiers, segment indexes, CSS classes, data-* attributes, or media paths.',
        'If a value contains code blocks, preserve code syntax and translate only comments or prose when clearly natural language.'
      ],
      entries: input.entries.map(entry => ({
        id: entry.id,
        valueType: entry.valueType,
        label: entry.label,
        groupLabel: entry.groupLabel,
        value: getAiPromptValue(entry)
      }))
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

function prepareAiInput(input) {
  const entries = input.entries.map(entry => {
    if (entry.valueType !== 'richTextDocument') {
      return entry
    }

    const richTextSegments = collectRichTextSegments(entry.value)
    entry.richTextSegments = richTextSegments
    return {
      ...entry,
      aiValue: buildIndexedRichTextValue(richTextSegments)
    }
  })

  return {
    ...input,
    entries
  }
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

function buildDeepSeekRequestBody(settings, input) {
  const requestBody = {
    model: settings.deepSeekModel,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(settings)
      },
      {
        role: 'user',
        content: buildUserPrompt(input)
      }
    ],
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

function requestJson(url, requestBody, settings) {
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 120) * 1000

  return new Promise((resolve, reject) => {
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

function requestStream(url, requestBody, settings, handlers = {}) {
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 300) * 1000

  return new Promise((resolve, reject) => {
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
  if (!Array.isArray(value.segments)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      `DeepSeek 返回的富文本 segments 不合法：${entry.label || entry.id}`,
      'deepSeek',
      502
    )
  }

  const segmentMap = new Map()
  value.segments.forEach(segment => {
    if (!segment || typeof segment.index !== 'string') {
      return
    }
    if (typeof segment.text === 'string') {
      segmentMap.set(segment.index, segment.text)
    }
  })
  return segmentMap
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
  const resultEntries = normalizeResultEntries(resultData)
  const resultMap = new Map()
  resultEntries.forEach(item => {
    if (item && typeof item.id === 'string') {
      resultMap.set(item.id, item)
    }
  })

  const entries = input.entries.map(entry => {
    const translatedEntry = resultMap.get(entry.id)
    if (!translatedEntry) {
      throw new ApiError(
        ERROR_CODES.AI_TRANSLATION_FAILED,
        `DeepSeek 返回结果缺少条目：${entry.label || entry.id}`,
        'deepSeek',
        502
      )
    }
    const normalizedValue = normalizeTranslatedValue(
      entry,
      translatedEntry.value
    )

    const outputEntry = {
      id: entry.id,
      scope: entry.scope,
      label: entry.label,
      groupLabel: entry.groupLabel,
      fieldName: entry.fieldName,
      valueType: entry.valueType,
      value: normalizedValue
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
      postId: input.postId,
      languageCode: input.targetLanguageCode,
      sourceLanguageCode: input.sourceLanguageCode,
      postType: Number(post.type || 1),
      snapshotVersion: Number(post.snapshotVersion || 1),
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
  if (!entry || typeof entry.id !== 'string') {
    return
  }

  if (
    entry.value &&
    entry.value.type === RICH_TEXT_INDEXED_VALUE_TYPE &&
    Array.isArray(entry.value.segments)
  ) {
    if (!resultMap.has(entry.id)) {
      resultMap.set(entry.id, {
        id: entry.id,
        value: {
          type: RICH_TEXT_INDEXED_VALUE_TYPE,
          segments: []
        }
      })
    }
    const mergedEntry = resultMap.get(entry.id)
    mergedEntry.value.segments.push(...entry.value.segments)
    return
  }

  resultMap.set(entry.id, entry)
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
  await aiUsageService.recordAiUsageLog({
    provider: 'deepseek',
    model: responseData.model || '',
    operation: 'translation.post',
    status,
    requestId: responseData.id || '',
    postId: post._id,
    translationGroupId: post.translationGroupId,
    sourceSnapshotId: post.sourceSnapshotId,
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
  const payload = buildTranslatedPayload(input, post, resultData)

  return {
    payload,
    model: responseData.model || settings.deepSeekModel,
    usage: responseData.usage || null,
    requestId: responseData.id || null
  }
}

async function translatePostEntriesStream(body = {}, handlers = {}) {
  const input = parseInput(body)
  const post = await getTranslationPost(input)
  const settings = await aiSettingsService.getDeepSeekRuntimeSettings()
  const url = buildChatCompletionUrl(settings)
  const aiInput = prepareAiInput(input)
  const inputChunks = splitAiInput(aiInput)
  const chunkResponses = []
  const resultMap = new Map()
  let combinedUsage = {}
  let responseModel = settings.deepSeekModel
  let responseId = ''

  if (handlers.onStatus) {
    handlers.onStatus({
      message: `正在准备 ${inputChunks.length} 个翻译批次`
    })
  }

  try {
    for (let index = 0; index < inputChunks.length; index += 1) {
      const chunkInput = inputChunks[index]
      if (handlers.onStatus) {
        handlers.onStatus({
          message: `正在翻译第 ${index + 1}/${inputChunks.length} 批`
        })
      }

      const requestBody = buildDeepSeekStreamRequestBody(settings, chunkInput)
      const deepSeekResponse = await requestStream(url, requestBody, settings, {
        onStatus: handlers.onStatus,
        onChunk: handlers.onChunk
      })
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
          message: `已完成第 ${index + 1}/${inputChunks.length} 批`
        })
      }
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

    const payload = buildTranslatedPayload(input, post, {
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
      status: 'error',
      httpStatusCode: error?.statusCode || 502,
      stream: true,
      chunkCount: inputChunks.length
    })
    throw error
  }
}

module.exports = {
  translatePostEntries,
  translatePostEntriesStream
}
