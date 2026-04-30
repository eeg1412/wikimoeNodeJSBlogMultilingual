import {
  getRelationEditFields,
  getRelationTranslationFields
} from '@/utils/relationEditFields'
import {
  getPostDisplayTitle,
  getRelationDisplayName
} from '@/utils/multilingual'
import { normalizeTagName } from '@/utils/tagName'

export const TRANSLATION_JSON_SCHEMA = 'wikimoe.translation.post'
export const TRANSLATION_JSON_VERSION = 2

const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'
const SUPPORTED_ENTRY_VALUE_TYPES = [
  'plainText',
  LEGACY_RICH_TEXT_VALUE_TYPE,
  STRUCTURED_RICH_TEXT_VALUE_TYPE
]
const RICH_TEXT_TEMPLATE_ENTRY_KIND = 'richTextTemplate'
const RICH_TEXT_SEGMENT_ENTRY_KIND = 'richTextSegment'
const RICH_TEXT_EXPORT_SEGMENT_MAX_LENGTH = 1200
const RICH_TEXT_TRANSLATABLE_ATTRIBUTE_NAME_SET = new Set([
  'alt',
  'title',
  'placeholder',
  'aria-label'
])
const VOID_HTML_TAG_SET = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])
const BLOCKED_HTML_TAG_SET = new Set(['script', 'style'])
const URL_ATTRIBUTE_NAME_SET = new Set(['href', 'src', 'poster'])

const POST_TRANSLATION_FIELDS = [
  {
    name: 'title',
    label: '标题',
    valueType: 'plainText',
    supportedTypes: [1, 3],
    defaultSelected: true
  },
  {
    name: 'content',
    label: '文章内容',
    valueType: STRUCTURED_RICH_TEXT_VALUE_TYPE,
    supportedTypes: [1, 3],
    defaultSelected: true
  },
  {
    name: 'excerpt',
    label: '摘要',
    valueType: 'plainText',
    supportedTypes: [1, 2, 3],
    defaultSelected: true,
    getLabel(form) {
      if (Number(form.type) === 2) {
        return '推文正文'
      }
      return '摘要'
    }
  },
  {
    name: 'code',
    label: '插入 code',
    valueType: 'plainText',
    supportedTypes: [1, 3],
    defaultSelected: false,
    optional: true
  }
]

const TOKEN_PREFIX = '__WIKIMOE_TRANSLATION_TOKEN_'
const ASSET_ATTRIBUTE_REGEXP = /(\w+)="([^"]*)"/g
const ASSET_PLACEHOLDER_REGEXP =
  /^\[(image|video|embed|event):([A-Za-z0-9_-]+)([^\]]*)\]$/
const DETAIL_RELATION_FIELD_SET = new Set([
  'eventList',
  'voteList',
  'postList',
  'tweetList',
  'bangumiList',
  'movieList',
  'bookList',
  'gameList'
])

function normalizeStringValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).replace(/\r\n?/g, '\n').trim()
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneSerializableValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function isRichTextValueType(valueType) {
  return (
    valueType === LEGACY_RICH_TEXT_VALUE_TYPE ||
    valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE
  )
}

function createEmptyRichTextDocument() {
  return {
    type: 'root',
    children: []
  }
}

function normalizeRichTextDocumentValue(value) {
  if (!isPlainObject(value)) {
    return createEmptyRichTextDocument()
  }

  return cloneSerializableValue(value)
}

function hasMeaningfulValue(value) {
  return normalizeStringValue(value) !== ''
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;')
}

function stripHtml(value) {
  return normalizeStringValue(value)
    .replace(/<[^>]*>/g, '')
    .trim()
}

function collectRichTextPreviewSegments(node, segmentList = []) {
  if (!isPlainObject(node)) {
    return segmentList
  }

  if (node.type === 'text') {
    const text = normalizeStringValue(node.text || '')
    if (text) {
      segmentList.push(text)
    }
    return segmentList
  }

  if (isPlainObject(node.translatableAttrs)) {
    Object.values(node.translatableAttrs).forEach(value => {
      const text = normalizeStringValue(value)
      if (text) {
        segmentList.push(text)
      }
    })
  }

  const childList = Array.isArray(node.children) ? node.children : []
  childList.forEach(childNode => {
    collectRichTextPreviewSegments(childNode, segmentList)
  })

  return segmentList
}

function getRichTextDocumentPreviewText(value) {
  const documentValue = normalizeRichTextDocumentValue(value)
  return collectRichTextPreviewSegments(documentValue)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPreviewRawValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return JSON.stringify(normalizeRichTextDocumentValue(value), null, 2)
  }

  return normalizeStringValue(value)
}

function normalizeEntryValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return normalizeRichTextDocumentValue(value)
  }

  return normalizeStringValue(value)
}

function findRichTextExportSplitIndex(text, maxLength) {
  const searchText = text.slice(0, maxLength)
  const candidates = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? ', ' ']
  let splitIndex = -1
  candidates.forEach(candidate => {
    const candidateIndex = searchText.lastIndexOf(candidate)
    if (candidateIndex > splitIndex) {
      splitIndex = candidateIndex + candidate.length
    }
  })
  if (splitIndex <= 0) {
    return maxLength
  }
  return splitIndex
}

function splitRichTextExportText(text) {
  const parts = []
  let restText = String(text || '')
  while (restText.length > RICH_TEXT_EXPORT_SEGMENT_MAX_LENGTH) {
    const splitIndex = findRichTextExportSplitIndex(
      restText,
      RICH_TEXT_EXPORT_SEGMENT_MAX_LENGTH
    )
    parts.push(restText.slice(0, splitIndex))
    restText = restText.slice(splitIndex)
  }
  if (restText) {
    parts.push(restText)
  }
  return parts
}

function pushRichTextExportSegments(segments, path, text) {
  splitRichTextExportText(text).forEach(partText => {
    if (!hasMeaningfulValue(partText)) {
      return
    }
    segments.push({
      segmentIndex: segments.length + 1,
      path,
      value: partText
    })
  })
}

function collectRichTextDocumentSegments(node, path = [], segments = []) {
  if (!isPlainObject(node)) {
    return segments
  }

  if (node.type === 'text') {
    if (hasMeaningfulValue(node.text)) {
      pushRichTextExportSegments(segments, path.concat('text'), node.text)
    }
    return segments
  }

  if (node.type === 'element' && isPlainObject(node.translatableAttrs)) {
    Object.keys(node.translatableAttrs).forEach(attrName => {
      const text = node.translatableAttrs[attrName]
      if (hasMeaningfulValue(text)) {
        pushRichTextExportSegments(
          segments,
          path.concat(['translatableAttrs', attrName]),
          text
        )
      }
    })
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((childNode, index) => {
      collectRichTextDocumentSegments(
        childNode,
        path.concat(['children', index]),
        segments
      )
    })
  }

  return segments
}

function buildRichTextDocumentSkeleton(node) {
  if (!isPlainObject(node)) {
    return node
  }

  const nextNode = cloneSerializableValue(node)
  if (nextNode.type === 'text') {
    if (hasMeaningfulValue(nextNode.text)) {
      nextNode.text = ''
    }
    return nextNode
  }

  if (
    nextNode.type === 'element' &&
    isPlainObject(nextNode.translatableAttrs)
  ) {
    Object.keys(nextNode.translatableAttrs).forEach(attrName => {
      if (hasMeaningfulValue(nextNode.translatableAttrs[attrName])) {
        nextNode.translatableAttrs[attrName] = ''
      }
    })
  }

  if (Array.isArray(nextNode.children)) {
    nextNode.children = nextNode.children.map(childNode => {
      return buildRichTextDocumentSkeleton(childNode)
    })
  }

  return nextNode
}

function hasMeaningfulEntryValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    const documentValue = normalizeRichTextDocumentValue(value)
    return (
      getRichTextDocumentPreviewText(documentValue) !== '' ||
      (Array.isArray(documentValue.children) &&
        documentValue.children.length > 0)
    )
  }

  return hasMeaningfulValue(value)
}

function buildPreviewText(value, valueType) {
  let previewText = ''

  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    previewText = stripHtml(normalizeStringValue(value))
  } else if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    previewText = getRichTextDocumentPreviewText(value)
  } else {
    previewText = normalizeStringValue(value)
  }

  return previewText.length > 120
    ? `${previewText.slice(0, 120)}...`
    : previewText || '空内容'
}

function buildTextEntry(baseData, options = {}) {
  const valueType = baseData.valueType || 'plainText'
  const value = normalizeEntryValue(baseData.value, valueType)
  if (!options.includeEmpty && !hasMeaningfulEntryValue(value, valueType)) {
    return null
  }

  return {
    ...baseData,
    value,
    previewText: buildPreviewText(value, valueType),
    previewRawValue: buildPreviewRawValue(value, valueType)
  }
}

function getTextNodeValue(node) {
  return node.textContent.replace(/\s+/g, ' ')
}

function getAssetAttributes(node, fieldNameList) {
  const attributes = {}
  fieldNameList.forEach(fieldName => {
    const value = node.getAttribute(fieldName)
    if (value) {
      attributes[fieldName] = value
    }
  })
  return attributes
}

function buildAssetPlaceholder(type, id, attributes = {}) {
  const attributeText = Object.entries(attributes)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
    .map(([key, value]) => `${key}="${String(value).replace(/"/g, '&quot;')}"`)
    .join(' ')

  if (!attributeText) {
    return `[${type}:${id}]`
  }

  return `[${type}:${id} ${attributeText}]`
}

function serializeRichTextDocumentNode(node) {
  if (node.nodeType === 3) {
    return {
      type: 'text',
      text: node.textContent || ''
    }
  }

  if (node.nodeType !== 1) {
    return null
  }

  const tag = node.tagName.toLowerCase()
  if (BLOCKED_HTML_TAG_SET.has(tag)) {
    return null
  }

  const attrs = {}
  const translatableAttrs = {}
  Array.from(node.attributes).forEach(attribute => {
    if (RICH_TEXT_TRANSLATABLE_ATTRIBUTE_NAME_SET.has(attribute.name)) {
      translatableAttrs[attribute.name] = attribute.value
      return
    }
    attrs[attribute.name] = attribute.value
  })

  const childList = Array.from(node.childNodes)
    .map(childNode => serializeRichTextDocumentNode(childNode))
    .filter(Boolean)

  const nextNode = {
    type: 'element',
    tag
  }

  if (Object.keys(attrs).length > 0) {
    nextNode.attrs = attrs
  }
  if (Object.keys(translatableAttrs).length > 0) {
    nextNode.translatableAttrs = translatableAttrs
  }
  if (childList.length > 0) {
    nextNode.children = childList
  }

  return nextNode
}

export function serializeRichTextHtmlToDocument(html) {
  const normalizedHtml = normalizeStringValue(html)
  if (!normalizedHtml) {
    return {
      document: createEmptyRichTextDocument(),
      previewText: ''
    }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(normalizedHtml, 'text/html')
  const documentValue = {
    type: 'root',
    children: Array.from(doc.body.childNodes)
      .map(node => serializeRichTextDocumentNode(node))
      .filter(Boolean)
  }

  return {
    document: documentValue,
    previewText: getRichTextDocumentPreviewText(documentValue)
  }
}

function validateRichTextDocumentAttributes(attributeMap, path) {
  if (attributeMap === undefined) {
    return
  }

  if (!isPlainObject(attributeMap)) {
    throw new Error(`${path} 必须是对象`)
  }

  Object.entries(attributeMap).forEach(([key, value]) => {
    if (!normalizeStringValue(key)) {
      throw new Error(`${path} 包含空属性名`)
    }
    if (typeof value !== 'string') {
      throw new Error(`${path}.${key} 必须是字符串`)
    }
  })
}

function validateRichTextDocumentNode(node, path = 'value') {
  if (!isPlainObject(node)) {
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

  if (!normalizeStringValue(node.tag)) {
    throw new Error(`${path}.tag 不能为空`)
  }

  validateRichTextDocumentAttributes(node.attrs, `${path}.attrs`)
  validateRichTextDocumentAttributes(
    node.translatableAttrs,
    `${path}.translatableAttrs`
  )

  if (node.children !== undefined && !Array.isArray(node.children)) {
    throw new Error(`${path}.children 必须是数组`)
  }

  ;(node.children || []).forEach((childNode, index) => {
    validateRichTextDocumentNode(childNode, `${path}.children[${index}]`)
  })
}

function sanitizeRichTextTagName(tag) {
  const normalizedTag = normalizeStringValue(tag).toLowerCase()
  if (!/^[a-z][a-z0-9:-]*$/.test(normalizedTag)) {
    return 'span'
  }
  if (BLOCKED_HTML_TAG_SET.has(normalizedTag)) {
    return 'span'
  }
  return normalizedTag
}

function sanitizeRichTextAttributeEntries(attributeMap = {}) {
  return Object.entries(attributeMap)
    .map(([key, value]) => {
      const normalizedKey = normalizeStringValue(key).toLowerCase()
      if (!normalizedKey || normalizedKey.startsWith('on')) {
        return null
      }

      const nextValue = String(value || '')
      if (
        URL_ATTRIBUTE_NAME_SET.has(normalizedKey) &&
        /^\s*javascript:/i.test(nextValue)
      ) {
        return null
      }

      return [normalizedKey, nextValue]
    })
    .filter(Boolean)
}

function renderRichTextDocumentNode(node) {
  if (node.type === 'root') {
    return (node.children || [])
      .map(childNode => renderRichTextDocumentNode(childNode))
      .join('')
  }

  if (node.type === 'text') {
    return escapeHtml(node.text || '')
  }

  const tag = sanitizeRichTextTagName(node.tag)
  const mergedAttrs = Object.fromEntries([
    ...sanitizeRichTextAttributeEntries(node.attrs || {}),
    ...sanitizeRichTextAttributeEntries(node.translatableAttrs || {})
  ])
  const attrText = Object.entries(mergedAttrs)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('')

  if (VOID_HTML_TAG_SET.has(tag)) {
    return `<${tag}${attrText}>`
  }

  const childHtml = (node.children || [])
    .map(childNode => renderRichTextDocumentNode(childNode))
    .join('')
  return `<${tag}${attrText}>${childHtml}</${tag}>`
}

export function renderRichTextDocument(value) {
  const documentValue = normalizeRichTextDocumentValue(value)
  validateRichTextDocumentNode(documentValue)
  return renderRichTextDocumentNode(documentValue)
}

function attachLinkToSerializedAsset(text, href, context) {
  const matched = text.match(ASSET_PLACEHOLDER_REGEXP)
  if (!matched || !href) {
    return false
  }

  const assetId = matched[2]
  if (!context.assets[assetId]) {
    return false
  }

  context.assets[assetId].href = href
  return true
}

function serializeInlineNodes(nodes, context) {
  const segments = []
  nodes.forEach(node => {
    if (node.nodeType === 3) {
      segments.push(getTextNodeValue(node))
      return
    }

    if (node.nodeType !== 1) {
      return
    }

    const tagName = node.tagName.toLowerCase()
    if (tagName === 'br') {
      segments.push('\n')
      return
    }

    if (tagName === 'strong' || tagName === 'b') {
      segments.push(
        `**${serializeInlineNodes(Array.from(node.childNodes), context)}**`
      )
      return
    }

    if (tagName === 'em' || tagName === 'i') {
      segments.push(
        `*${serializeInlineNodes(Array.from(node.childNodes), context)}*`
      )
      return
    }

    if (tagName === 'code') {
      segments.push(`\`${node.textContent || ''}\``)
      return
    }

    if (tagName === 'a') {
      const text = serializeInlineNodes(
        Array.from(node.childNodes),
        context
      ).trim()
      const href = node.getAttribute('href') || ''
      if (!href) {
        segments.push(text)
        return
      }
      if (attachLinkToSerializedAsset(text, href, context)) {
        segments.push(text)
        return
      }
      segments.push(`[${text || href}](${href})`)
      return
    }

    if (tagName === 'img') {
      context.imageIndex += 1
      const assetId = `image${context.imageIndex}`
      const alt = node.getAttribute('alt') || ''
      context.assets[assetId] = {
        type: 'image',
        src: node.getAttribute('src') || '',
        title: node.getAttribute('title') || ''
      }
      segments.push(buildAssetPlaceholder('image', assetId, { alt }))
      return
    }

    if (tagName === 'video') {
      context.videoIndex += 1
      const assetId = `video${context.videoIndex}`
      const sourceNode = node.querySelector('source')
      context.assets[assetId] = {
        type: 'video',
        src: sourceNode?.getAttribute('src') || node.getAttribute('src') || '',
        poster: node.getAttribute('poster') || '',
        mimetype: sourceNode?.getAttribute('type') || ''
      }
      segments.push(buildAssetPlaceholder('video', assetId))
      return
    }

    if (tagName === 'iframe') {
      context.embedIndex += 1
      const assetId = `embed${context.embedIndex}`
      context.assets[assetId] = {
        type: 'embed',
        src: node.getAttribute('src') || '',
        title: node.getAttribute('title') || ''
      }
      segments.push(
        buildAssetPlaceholder('embed', assetId, {
          title: node.getAttribute('title') || ''
        })
      )
      return
    }

    if (node.getAttribute('data-w-e-type') === 'eventspan') {
      context.eventIndex += 1
      const assetId = `event${context.eventIndex}`
      const text = node.textContent || ''
      context.assets[assetId] = {
        type: 'event',
        eventId: node.getAttribute('data-id') || '',
        text
      }
      segments.push(buildAssetPlaceholder('event', assetId, { text }))
      return
    }

    segments.push(serializeInlineNodes(Array.from(node.childNodes), context))
  })

  return segments.join('').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n')
}

function serializeListNode(node, context, ordered, depth = 0) {
  const lines = []
  Array.from(node.children).forEach((childNode, index) => {
    if (childNode.tagName.toLowerCase() !== 'li') {
      return
    }

    const nestedListNodes = []
    const inlineNodes = Array.from(childNode.childNodes).filter(item => {
      if (
        item.nodeType === 1 &&
        (item.tagName.toLowerCase() === 'ul' ||
          item.tagName.toLowerCase() === 'ol')
      ) {
        nestedListNodes.push(item)
        return false
      }
      return true
    })
    const text = serializeInlineNodes(inlineNodes, context).trim()
    const indent = '  '.repeat(depth)
    const prefix = ordered ? `${index + 1}. ` : '- '
    lines.push(`${indent}${prefix}${text}`.trimEnd())
    nestedListNodes.forEach(listNode => {
      lines.push(
        serializeListNode(
          listNode,
          context,
          listNode.tagName.toLowerCase() === 'ol',
          depth + 1
        )
      )
    })
  })

  return lines.filter(Boolean).join('\n')
}

function serializeBlockNode(node, context) {
  if (node.nodeType === 3) {
    const text = getTextNodeValue(node).trim()
    return text ? `${text}\n\n` : ''
  }

  if (node.nodeType !== 1) {
    return ''
  }

  const tagName = node.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1))
    const text = serializeInlineNodes(
      Array.from(node.childNodes),
      context
    ).trim()
    return text ? `${'#'.repeat(level)} ${text}\n\n` : ''
  }

  if (tagName === 'p') {
    const text = serializeInlineNodes(
      Array.from(node.childNodes),
      context
    ).trim()
    return text ? `${text}\n\n` : ''
  }

  if (tagName === 'blockquote') {
    const text = serializeBlockNodes(Array.from(node.childNodes), context)
      .trim()
      .split('\n')
      .map(line => (line ? `> ${line}` : '>'))
      .join('\n')
    return text ? `${text}\n\n` : ''
  }

  if (tagName === 'pre') {
    const codeNode = node.querySelector('code')
    const className = codeNode?.getAttribute('class') || ''
    const language = className.replace(/^language-/, '')
    const codeText = codeNode?.textContent || node.textContent || ''
    return `\`\`\`${language}\n${codeText.trim()}\n\`\`\`\n\n`
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const listText = serializeListNode(node, context, tagName === 'ol')
    return listText ? `${listText}\n\n` : ''
  }

  if (tagName === 'hr') {
    return '---\n\n'
  }

  if (tagName === 'table') {
    const rowTextList = Array.from(node.querySelectorAll('tr')).map(rowNode => {
      const cellTextList = Array.from(rowNode.children).map(cellNode => {
        return serializeInlineNodes(
          Array.from(cellNode.childNodes),
          context
        ).trim()
      })
      return `| ${cellTextList.join(' | ')} |`
    })
    return rowTextList.length > 0 ? `${rowTextList.join('\n')}\n\n` : ''
  }

  const inlineText = serializeInlineNodes(
    Array.from(node.childNodes),
    context
  ).trim()
  if (inlineText) {
    return `${inlineText}\n\n`
  }

  return serializeBlockNodes(Array.from(node.childNodes), context)
}

function serializeBlockNodes(nodes, context) {
  return nodes.map(node => serializeBlockNode(node, context)).join('')
}

export function serializeRichTextHtml(html) {
  const normalizedHtml = normalizeStringValue(html)
  if (!normalizedHtml) {
    return { text: '', assets: {} }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(normalizedHtml, 'text/html')
  const context = {
    assets: {},
    imageIndex: 0,
    videoIndex: 0,
    embedIndex: 0,
    eventIndex: 0
  }

  const text = serializeBlockNodes(Array.from(doc.body.childNodes), context)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text,
    assets: context.assets
  }
}

function readAssetAttributes(attributeText) {
  const attributeMap = {}
  if (!attributeText) {
    return attributeMap
  }

  let matched = ASSET_ATTRIBUTE_REGEXP.exec(attributeText)
  while (matched) {
    attributeMap[matched[1]] = matched[2].replace(/&quot;/g, '"')
    matched = ASSET_ATTRIBUTE_REGEXP.exec(attributeText)
  }
  ASSET_ATTRIBUTE_REGEXP.lastIndex = 0
  return attributeMap
}

function createInlineTokenStore() {
  const tokenMap = new Map()
  let tokenIndex = 0

  return {
    put(html) {
      const token = `${TOKEN_PREFIX}${tokenIndex}__`
      tokenIndex += 1
      tokenMap.set(token, html)
      return token
    },
    restore(text) {
      let result = text
      Array.from(tokenMap.entries())
        .reverse()
        .forEach(([token, html]) => {
          result = result.replaceAll(token, html)
        })
      return result
    }
  }
}

function renderAssetPlaceholder(type, id, attributeText, assets) {
  const asset = assets?.[id] || {}
  const attributes = readAssetAttributes(attributeText)

  function wrapAssetHtml(html) {
    if (!asset.href) {
      return html
    }

    return `<a href="${escapeAttribute(asset.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`
  }

  if (type === 'image') {
    if (!asset.src) {
      return `<span>${escapeHtml(attributes.alt || asset.alt || '')}</span>`
    }
    const alt = attributes.alt || asset.alt || ''
    const title = asset.title || ''
    return wrapAssetHtml(
      `<img src="${escapeAttribute(asset.src)}" alt="${escapeAttribute(alt)}"${
        title ? ` title="${escapeAttribute(title)}"` : ''
      }>`
    )
  }

  if (type === 'video') {
    if (!asset.src) {
      return ''
    }
    return wrapAssetHtml(
      `<video controls playsinline preload="metadata"${
        asset.poster ? ` poster="${escapeAttribute(asset.poster)}"` : ''
      }><source src="${escapeAttribute(asset.src)}"${
        asset.mimetype ? ` type="${escapeAttribute(asset.mimetype)}"` : ''
      }></video>`
    )
  }

  if (type === 'embed') {
    if (!asset.src) {
      return `<span>${escapeHtml(attributes.title || asset.title || '')}</span>`
    }
    const label = attributes.title || asset.title || asset.src
    return `<a href="${escapeAttribute(asset.src)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  }

  if (type === 'event') {
    const text = attributes.text || asset.text || ''
    return `<span data-w-e-type="eventspan" data-w-e-is-inline data-w-e-is-void data-id="${escapeAttribute(asset.eventId || '')}">${escapeHtml(text)}</span>`
  }

  return ''
}

function renderInlineMarkup(value, assets = {}) {
  const tokenStore = createInlineTokenStore()
  let nextValue = normalizeStringValue(value)

  nextValue = nextValue.replace(
    /\[(image|video|embed|event):([A-Za-z0-9_-]+)([^\]]*)\]/g,
    (_, type, id, attributeText) => {
      return tokenStore.put(
        renderAssetPlaceholder(type, id, attributeText, assets)
      )
    }
  )
  nextValue = nextValue.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    return tokenStore.put(
      `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    )
  })
  nextValue = nextValue.replace(/\`([^`]+)\`/g, (_, text) => {
    return tokenStore.put(`<code>${escapeHtml(text)}</code>`)
  })
  nextValue = nextValue.replace(/\*\*([^*]+)\*\*/g, (_, text) => {
    return tokenStore.put(`<strong>${escapeHtml(text)}</strong>`)
  })
  nextValue = nextValue.replace(/\*([^*]+)\*/g, (_, text) => {
    return tokenStore.put(`<em>${escapeHtml(text)}</em>`)
  })

  return tokenStore.restore(escapeHtml(nextValue)).replace(/\n/g, '<br>')
}

function flushParagraph(htmlList, paragraphLines, assets) {
  if (paragraphLines.length === 0) {
    return
  }

  const text = paragraphLines.join('\n').trim()
  if (text) {
    htmlList.push(`<p>${renderInlineMarkup(text, assets)}</p>`)
  }
  paragraphLines.length = 0
}

function flushList(htmlList, listState, assets) {
  if (!listState) {
    return null
  }

  const tagName = listState.ordered ? 'ol' : 'ul'
  const itemHtml = listState.items
    .map(item => `<li>${renderInlineMarkup(item, assets)}</li>`)
    .join('')
  htmlList.push(`<${tagName}>${itemHtml}</${tagName}>`)
  return null
}

function flushQuote(htmlList, quoteLines, assets) {
  if (quoteLines.length === 0) {
    return
  }

  const text = quoteLines.join('\n').trim()
  if (text) {
    htmlList.push(
      `<blockquote><p>${renderInlineMarkup(text, assets)}</p></blockquote>`
    )
  }
  quoteLines.length = 0
}

function flushCodeBlock(htmlList, codeBlock) {
  if (!codeBlock) {
    return null
  }

  const className = codeBlock.language
    ? ` class="language-${escapeAttribute(codeBlock.language)}"`
    : ''
  htmlList.push(
    `<pre><code${className}>${escapeHtml(codeBlock.lines.join('\n'))}</code></pre>`
  )
  return null
}

function maybeRenderStandaloneAsset(lineText, assets) {
  const matched = lineText.match(
    /^\[(image|video|embed|event):([A-Za-z0-9_-]+)([^\]]*)\]$/
  )
  if (!matched) {
    return ''
  }

  return renderAssetPlaceholder(matched[1], matched[2], matched[3], assets)
}

export function deserializeRichTextText(text, assets = {}) {
  const normalizedText = normalizeStringValue(text)
  if (!normalizedText) {
    return ''
  }

  const lineList = normalizedText.split('\n')
  const htmlList = []
  const paragraphLines = []
  const quoteLines = []
  let listState = null
  let codeBlock = null

  const flushAll = () => {
    flushParagraph(htmlList, paragraphLines, assets)
    listState = flushList(htmlList, listState, assets)
    flushQuote(htmlList, quoteLines, assets)
    codeBlock = flushCodeBlock(htmlList, codeBlock)
  }

  lineList.forEach(lineText => {
    if (codeBlock) {
      if (lineText.startsWith('```')) {
        codeBlock = flushCodeBlock(htmlList, codeBlock)
        return
      }
      codeBlock.lines.push(lineText)
      return
    }

    if (!lineText.trim()) {
      flushAll()
      return
    }

    if (lineText.startsWith('```')) {
      flushParagraph(htmlList, paragraphLines, assets)
      listState = flushList(htmlList, listState, assets)
      flushQuote(htmlList, quoteLines, assets)
      codeBlock = {
        language: lineText.slice(3).trim(),
        lines: []
      }
      return
    }

    const headingMatched = lineText.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatched) {
      flushAll()
      const level = headingMatched[1].length
      htmlList.push(
        `<h${level}>${renderInlineMarkup(headingMatched[2], assets)}</h${level}>`
      )
      return
    }

    if (lineText === '---') {
      flushAll()
      htmlList.push('<hr>')
      return
    }

    const quoteMatched = lineText.match(/^>\s?(.*)$/)
    if (quoteMatched) {
      flushParagraph(htmlList, paragraphLines, assets)
      listState = flushList(htmlList, listState, assets)
      quoteLines.push(quoteMatched[1])
      return
    }

    const listMatched = lineText.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)
    if (listMatched) {
      flushParagraph(htmlList, paragraphLines, assets)
      flushQuote(htmlList, quoteLines, assets)
      const ordered = /^\s*\d+\./.test(lineText)
      if (!listState || listState.ordered !== ordered) {
        listState = flushList(htmlList, listState, assets)
        listState = {
          ordered,
          items: []
        }
      }
      listState.items.push(listMatched[1])
      return
    }

    const standaloneAssetHtml = maybeRenderStandaloneAsset(
      lineText.trim(),
      assets
    )
    if (standaloneAssetHtml) {
      flushAll()
      htmlList.push(standaloneAssetHtml)
      return
    }

    paragraphLines.push(lineText)
  })

  flushAll()
  return htmlList.join('')
}

function createPostEntry(form, fieldConfig, options = {}) {
  const label = fieldConfig.getLabel
    ? fieldConfig.getLabel(form)
    : fieldConfig.label
  if (fieldConfig.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    const richTextResult = serializeRichTextHtmlToDocument(
      form[fieldConfig.name]
    )
    return buildTextEntry(
      {
        id: `post.${fieldConfig.name}`,
        scope: 'post',
        fieldName: fieldConfig.name,
        fieldLabel: label,
        label,
        groupLabel: '文章正文',
        groupCategory: '文章字段',
        groupTitle: '文章正文',
        valueType: fieldConfig.valueType,
        value: richTextResult.document,
        defaultSelected: fieldConfig.defaultSelected,
        optional: Boolean(fieldConfig.optional)
      },
      options
    )
  }

  return buildTextEntry(
    {
      id: `post.${fieldConfig.name}`,
      scope: 'post',
      fieldName: fieldConfig.name,
      fieldLabel: label,
      label,
      groupLabel: '文章正文',
      groupCategory: '文章字段',
      groupTitle: '文章正文',
      valueType: fieldConfig.valueType,
      value: form[fieldConfig.name],
      defaultSelected: fieldConfig.defaultSelected,
      optional: Boolean(fieldConfig.optional)
    },
    options
  )
}

function getRelationRecordDisplayName(record, relationField = {}) {
  if (!record) {
    return '未命名内容'
  }

  if (relationField.collectionName === 'posts' && relationField.postType) {
    return getPostDisplayTitle({
      ...record,
      type: record.type || relationField.postType
    })
  }

  return getRelationDisplayName(record)
}

function getRelationScopeMeta(relationField = {}) {
  if (relationField.relationScope === 'tweetContent') {
    return {
      relationScope: 'tweetContent',
      relationScopeLabel: '推文内',
      groupCategory: '推文内关联内容',
      groupLabel: `推文内关联内容 / ${relationField.label}`
    }
  }

  if (relationField.relationScope === 'detail') {
    return {
      relationScope: 'detail',
      relationScopeLabel: '详情页',
      groupCategory: '详情页相关内容',
      groupLabel: `详情页相关内容 / ${relationField.label}`
    }
  }

  if (String(relationField.field || '').startsWith('content')) {
    return {
      relationScope: 'tweetContent',
      relationScopeLabel: '推文内',
      groupCategory: '推文内关联内容',
      groupLabel: `推文内关联内容 / ${relationField.label}`
    }
  }

  if (DETAIL_RELATION_FIELD_SET.has(relationField.field)) {
    return {
      relationScope: 'detail',
      relationScopeLabel: '详情页',
      groupCategory: '详情页相关内容',
      groupLabel: `详情页相关内容 / ${relationField.label}`
    }
  }

  return {
    relationScope: 'base',
    relationScopeLabel: '',
    groupCategory: '关联内容',
    groupLabel: `关联内容 / ${relationField.label}`
  }
}

function createVoteOptionRelationEntries(
  relationField,
  record,
  editField,
  options = {}
) {
  const optionList = Array.isArray(record.options) ? record.options : []
  const recordLabel = getRelationRecordDisplayName(record, relationField)
  const relationScopeMeta = getRelationScopeMeta(relationField)

  return optionList
    .map((option, index) => {
      return buildTextEntry(
        {
          id: `relation.${relationField.field}.${record._id}.options.${option._id || index}.title`,
          scope: 'relation',
          relationField: relationField.field,
          collectionName: relationField.collectionName,
          recordId: record._id,
          recordKind: record.recordKind,
          sourceRecordId: normalizeStringValue(record._id),
          sourceId: normalizeStringValue(record.sourceId),
          sourceSnapshotId: normalizeStringValue(record.sourceSnapshotId),
          relationScope: relationScopeMeta.relationScope,
          relationScopeLabel: relationScopeMeta.relationScopeLabel,
          relationTypeLabel: relationField.label,
          recordLabel,
          fieldName: 'options.title',
          fieldLabel: `${editField.label} #${index + 1}`,
          optionId: normalizeStringValue(option._id),
          optionIndex: index,
          optionList: cloneSerializableValue(optionList),
          label: `${recordLabel} / ${editField.label} #${index + 1}`,
          groupLabel: relationScopeMeta.groupLabel,
          groupCategory: relationScopeMeta.groupCategory,
          groupTitle: relationField.label,
          valueType: 'plainText',
          value: option.title,
          defaultSelected: !editField.translationOptional,
          optional: Boolean(editField.translationOptional)
        },
        options
      )
    })
    .filter(Boolean)
}

function createRelationEntry(relationField, record, editField, options = {}) {
  const recordLabel = getRelationRecordDisplayName(record, relationField)
  const relationScopeMeta = getRelationScopeMeta(relationField)
  const valueType =
    editField.type === 'richText'
      ? STRUCTURED_RICH_TEXT_VALUE_TYPE
      : 'plainText'
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    const richTextResult = serializeRichTextHtmlToDocument(
      record[editField.name]
    )
    return buildTextEntry(
      {
        id: `relation.${relationField.field}.${record._id}.${editField.name}`,
        scope: 'relation',
        relationField: relationField.field,
        collectionName: relationField.collectionName,
        recordId: record._id,
        recordKind: record.recordKind,
        postType: Number(record.type || relationField.postType || 0),
        sourceRecordId: normalizeStringValue(record._id),
        sourceId: normalizeStringValue(record.sourceId),
        sourceSnapshotId: normalizeStringValue(record.sourceSnapshotId),
        relationScope: relationScopeMeta.relationScope,
        relationScopeLabel: relationScopeMeta.relationScopeLabel,
        relationTypeLabel: relationField.label,
        recordLabel,
        fieldName: editField.name,
        fieldLabel: editField.label,
        label: `${recordLabel} / ${editField.label}`,
        groupLabel: relationScopeMeta.groupLabel,
        groupCategory: relationScopeMeta.groupCategory,
        groupTitle: relationField.label,
        valueType,
        value: richTextResult.document,
        defaultSelected: !editField.translationOptional,
        optional: Boolean(editField.translationOptional)
      },
      options
    )
  }

  return buildTextEntry(
    {
      id: `relation.${relationField.field}.${record._id}.${editField.name}`,
      scope: 'relation',
      relationField: relationField.field,
      collectionName: relationField.collectionName,
      recordId: record._id,
      recordKind: record.recordKind,
      postType: Number(record.type || relationField.postType || 0),
      sourceRecordId: normalizeStringValue(record._id),
      sourceId: normalizeStringValue(record.sourceId),
      sourceSnapshotId: normalizeStringValue(record.sourceSnapshotId),
      relationScope: relationScopeMeta.relationScope,
      relationScopeLabel: relationScopeMeta.relationScopeLabel,
      relationTypeLabel: relationField.label,
      recordLabel,
      fieldName: editField.name,
      fieldLabel: editField.label,
      label: `${recordLabel} / ${editField.label}`,
      groupLabel: relationScopeMeta.groupLabel,
      groupCategory: relationScopeMeta.groupCategory,
      groupTitle: relationField.label,
      valueType,
      value: record[editField.name],
      defaultSelected: !editField.translationOptional,
      optional: Boolean(editField.translationOptional)
    },
    options
  )
}

function buildParentRelationEntry(
  parentRelationField,
  parentRecord,
  parentEditField,
  options = {}
) {
  const parentLabel = getRelationRecordDisplayName(parentRecord, {
    collectionName: parentRelationField.relationCollectionName
  })
  return buildTextEntry(
    {
      id: `parent.${parentRelationField.relationCollectionName}.${parentRecord._id}.${parentEditField.name}`,
      scope: 'parentRelation',
      collectionName: parentRelationField.relationCollectionName,
      recordId: parentRecord._id,
      recordKind: parentRecord.recordKind,
      sourceRecordId: normalizeStringValue(parentRecord._id),
      sourceId: normalizeStringValue(parentRecord.sourceId),
      sourceSnapshotId: normalizeStringValue(parentRecord.sourceSnapshotId),
      relationTypeLabel: parentRelationField.label,
      recordLabel: parentLabel,
      fieldName: parentEditField.name,
      fieldLabel: parentEditField.label,
      label: `${parentLabel} / ${parentEditField.label}`,
      groupLabel: `父级关联 / ${parentRelationField.label}`,
      groupCategory: '父级关联',
      groupTitle: parentRelationField.label,
      valueType: 'plainText',
      value: parentRecord[parentEditField.name],
      defaultSelected: !parentEditField.translationOptional,
      optional: Boolean(parentEditField.translationOptional)
    },
    options
  )
}

function getParentTranslationFields(parentRelationField) {
  const editableFieldNameList =
    parentRelationField.parentEditableFieldNames || []
  return getRelationTranslationFields(
    parentRelationField.relationCollectionName
  ).filter(field => {
    if (editableFieldNameList.length === 0) {
      return true
    }
    return editableFieldNameList.includes(field.name)
  })
}

function appendParentRelationEntries({
  entryList,
  exportedParentIdSet,
  parentRelationFieldList,
  record,
  buildOptions
}) {
  parentRelationFieldList.forEach(parentRelationField => {
    const parentRecord = record[parentRelationField.name]
    if (
      !parentRecord ||
      typeof parentRecord !== 'object' ||
      !parentRecord._id
    ) {
      return
    }

    getParentTranslationFields(parentRelationField).forEach(
      parentEditField => {
        const parentEntryId = `parent.${parentRelationField.relationCollectionName}.${parentRecord._id}.${parentEditField.name}`
        if (exportedParentIdSet.has(parentEntryId)) {
          return
        }
        const entry = buildParentRelationEntry(
          parentRelationField,
          parentRecord,
          parentEditField,
          buildOptions
        )
        if (entry) {
          exportedParentIdSet.add(parentEntryId)
          entryList.push(entry)
        }
      }
    )
  })
}

export function buildTranslationExportEntries({
  form,
  relationFields,
  relationRecords,
  includeEmpty = false
}) {
  const buildOptions = { includeEmpty }
  const entryList = []
  const exportedParentIdSet = new Set()
  POST_TRANSLATION_FIELDS.forEach(fieldConfig => {
    if (!fieldConfig.supportedTypes.includes(Number(form.type))) {
      return
    }

    const entry = createPostEntry(form, fieldConfig, buildOptions)
    if (entry) {
      entryList.push(entry)
    }
  })

  relationFields.forEach(relationField => {
    const recordList = Array.isArray(relationRecords[relationField.field])
      ? relationRecords[relationField.field]
      : []
    const translationFieldList = getRelationTranslationFields(
      relationField.collectionName
    )
    const relationEditFieldList = getRelationEditFields(
      relationField.collectionName
    )
    const parentRelationFieldList = relationEditFieldList.filter(field => {
      return field.type === 'parentRelation'
    })

    recordList.forEach(record => {
      if (!record?._id) {
        return
      }

      translationFieldList.forEach(editField => {
        if (editField.type === 'voteOptions') {
          entryList.push(
            ...createVoteOptionRelationEntries(
              relationField,
              record,
              editField,
              buildOptions
            )
          )
          return
        }

        const entry = createRelationEntry(
          relationField,
          record,
          editField,
          buildOptions
        )
        if (entry) {
          entryList.push(entry)
        }
      })

      appendParentRelationEntries({
        entryList,
        exportedParentIdSet,
        parentRelationFieldList,
        record,
        buildOptions
      })
    })
  })

  return entryList
}

export function buildRecordTranslationEntries({
  record,
  collectionName,
  groupLabel = '基础字段',
  includeEmpty = false
}) {
  const buildOptions = { includeEmpty }
  const entryList = []
  const exportedParentIdSet = new Set()
  const translationFieldList = getRelationTranslationFields(collectionName)
  const relationEditFieldList = getRelationEditFields(collectionName)
  const parentRelationFieldList = relationEditFieldList.filter(field => {
    return field.type === 'parentRelation'
  })

  translationFieldList.forEach(editField => {
    if (editField.type === 'voteOptions') {
      entryList.push(
        ...createVoteOptionRelationEntries(
          {
            field: 'record',
            label: groupLabel,
            collectionName
          },
          record,
          editField,
          buildOptions
        ).map(entry => ({
          ...entry,
          groupLabel,
          groupCategory: '内容字段',
          groupTitle: groupLabel
        }))
      )
      return
    }

    const entry = createRelationEntry(
      {
        field: 'record',
        label: groupLabel,
        collectionName
      },
      record,
      editField,
      buildOptions
    )
    if (entry) {
      entry.groupLabel = groupLabel
      entry.groupCategory = '内容字段'
      entry.groupTitle = groupLabel
      entryList.push(entry)
    }
  })

  appendParentRelationEntries({
    entryList,
    exportedParentIdSet,
    parentRelationFieldList,
    record,
    buildOptions
  })

  return entryList
}

function buildExportBasePayload(form) {
  return {
    schema: TRANSLATION_JSON_SCHEMA,
    version: TRANSLATION_JSON_VERSION,
    meta: {
      postId: form.id,
      languageCode: form.languageCode,
      sourceLanguageCode: form.sourceLanguageCode,
      postType: Number(form.type),
      snapshotVersion: Number(form.snapshotVersion || 1),
      exportedAt: new Date().toISOString(),
      richTextFormat: 'structured-html-dom-v1',
      richTextInstruction:
        '富文本字段使用结构化 JSON 导出。只翻译 text 与 translatableAttrs 中的自然语言，不要修改 tag、attrs、children、src、href、style、data-* 等结构字段。'
    },
    entries: []
  }
}

function buildExportEntryList(selectedEntries) {
  return selectedEntries.map((entry, index) => {
    const exportEntry = {
      index: index + 1,
      id: entry.id,
      scope: entry.scope,
      label: entry.label,
      groupLabel: entry.groupLabel,
      fieldName: entry.fieldName,
      valueType: entry.valueType,
      value: entry.value
    }

    if (entry.collectionName) {
      exportEntry.collectionName = entry.collectionName
    }
    if (entry.relationField) {
      exportEntry.relationField = entry.relationField
    }
    if (entry.recordId) {
      exportEntry.recordId = entry.recordId
    }
    if (entry.recordKind) {
      exportEntry.recordKind = entry.recordKind
    }
    if (entry.postType) {
      exportEntry.postType = entry.postType
    }
    if (entry.sourceRecordId) {
      exportEntry.sourceRecordId = entry.sourceRecordId
    }
    if (entry.sourceId) {
      exportEntry.sourceId = entry.sourceId
    }
    if (entry.sourceSnapshotId) {
      exportEntry.sourceSnapshotId = entry.sourceSnapshotId
    }
    if (entry.recordLabel) {
      exportEntry.recordLabel = entry.recordLabel
    }
    if (entry.relationTypeLabel) {
      exportEntry.relationTypeLabel = entry.relationTypeLabel
    }
    if (entry.relationScope) {
      exportEntry.relationScope = entry.relationScope
    }
    if (entry.relationScopeLabel) {
      exportEntry.relationScopeLabel = entry.relationScopeLabel
    }
    if (entry.fieldLabel) {
      exportEntry.fieldLabel = entry.fieldLabel
    }
    if (entry.optionIndex !== undefined) {
      exportEntry.optionIndex = entry.optionIndex
    }
    if (entry.groupCategory) {
      exportEntry.groupCategory = entry.groupCategory
    }
    if (entry.groupTitle) {
      exportEntry.groupTitle = entry.groupTitle
    }
    if (entry.assets && Object.keys(entry.assets).length > 0) {
      exportEntry.assets = entry.assets
    }

    return exportEntry
  })
}

function appendSlicedExportUnit(unitList, entry) {
  unitList.push({
    ...entry,
    index: unitList.length + 1
  })
}

function appendRichTextSlicedExportUnits(unitList, entry) {
  const segmentList = collectRichTextDocumentSegments(entry.value)
  if (segmentList.length === 0) {
    appendSlicedExportUnit(unitList, entry)
    return
  }

  appendSlicedExportUnit(unitList, {
    ...entry,
    entryKind: RICH_TEXT_TEMPLATE_ENTRY_KIND,
    parentIndex: entry.index,
    segmentTotal: segmentList.length,
    value: buildRichTextDocumentSkeleton(entry.value),
    note: '富文本结构模板。不要删除；实际可翻译文本在同 parentId 的 richTextSegment 条目中。'
  })

  segmentList.forEach(segment => {
    appendSlicedExportUnit(unitList, {
      ...entry,
      id: `${entry.id}#segment.${segment.segmentIndex}`,
      entryKind: RICH_TEXT_SEGMENT_ENTRY_KIND,
      parentId: entry.id,
      parentIndex: entry.index,
      segmentIndex: segment.segmentIndex,
      segmentTotal: segmentList.length,
      path: segment.path,
      label: `${entry.label} / 片段 ${segment.segmentIndex}`,
      valueType: 'plainText',
      value: segment.value
    })
  })
}

function buildSlicedExportUnitList(entries) {
  const unitList = []
  entries.forEach(entry => {
    if (entry.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
      appendRichTextSlicedExportUnits(unitList, entry)
      return
    }
    appendSlicedExportUnit(unitList, entry)
  })
  return unitList
}

function buildSlicedEntries(entries, sliceSize) {
  const size = Math.max(1, Number(sliceSize || 20))
  const unitList = buildSlicedExportUnitList(entries)
  const slices = []
  for (let index = 0; index < unitList.length; index += size) {
    slices.push(unitList.slice(index, index + size))
  }
  return {
    slices,
    unitList,
    size
  }
}

export function buildTranslationExportPayload({
  form,
  selectedEntries,
  sliceOptions = {}
}) {
  const payload = buildExportBasePayload(form)
  const entries = buildExportEntryList(selectedEntries)
  if (!sliceOptions.enabled) {
    payload.entries = entries
    return payload
  }

  const slicedResult = buildSlicedEntries(entries, sliceOptions.size)
  delete payload.entries
  payload.meta.slice = {
    enabled: true,
    total: slicedResult.slices.length,
    totalEntries: slicedResult.unitList.length,
    sourceEntries: entries.length,
    size: slicedResult.size,
    unit: 'translation-entry-or-rich-text-segment'
  }
  payload.slices = slicedResult.slices.map((sliceEntries, index) => {
    return {
      index: index + 1,
      total: slicedResult.slices.length,
      entries: sliceEntries
    }
  })
  return payload
}

function mergeSlicedImportPayload(parsedData) {
  if (!Array.isArray(parsedData.slices)) {
    return parsedData
  }

  const sliceMeta = parsedData.meta?.slice || {}
  const expectedTotal = Number(sliceMeta.total || parsedData.slices.length)
  const expectedEntryTotal = Number(sliceMeta.totalEntries || 0)
  const importedDocumentCount = Number(parsedData.__importDocumentCount || 0)
  if (!Number.isInteger(expectedTotal) || expectedTotal <= 0) {
    throw new Error('JSON 切片总数不合法')
  }

  const sliceMap = new Map()
  parsedData.slices.forEach((slice, index) => {
    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
      throw new Error(`第 ${index + 1} 个切片格式不正确`)
    }
    const sliceIndex = Number(slice.index)
    const sliceTotal = Number(slice.total || expectedTotal)
    if (!Number.isInteger(sliceIndex) || sliceIndex <= 0) {
      throw new Error(`第 ${index + 1} 个切片缺少合法 index`)
    }
    if (sliceTotal !== expectedTotal) {
      throw new Error(`第 ${sliceIndex} 个切片 total 与 meta 不一致`)
    }
    if (sliceMap.has(sliceIndex)) {
      throw new Error(`JSON 切片 ${sliceIndex} 重复`)
    }
    if (!Array.isArray(slice.entries)) {
      throw new Error(`JSON 切片 ${sliceIndex} 缺少 entries`)
    }
    sliceMap.set(sliceIndex, slice.entries)
  })

  for (let index = 1; index <= expectedTotal; index += 1) {
    if (!sliceMap.has(index)) {
      throw new Error(
        buildMissingSliceImportError({
          expectedTotal,
          importedDocumentCount,
          importedSliceCount: sliceMap.size,
          missingIndex: index
        })
      )
    }
  }

  const entries = []
  for (let index = 1; index <= expectedTotal; index += 1) {
    entries.push(...sliceMap.get(index))
  }
  if (expectedEntryTotal > 0 && entries.length !== expectedEntryTotal) {
    throw new Error('JSON 切片条目总数不一致，可能缺少内容')
  }

  return {
    ...parsedData,
    entries
  }
}

function isRichTextTemplateEntry(entry) {
  return entry?.entryKind === RICH_TEXT_TEMPLATE_ENTRY_KIND
}

function isRichTextSegmentEntry(entry) {
  return entry?.entryKind === RICH_TEXT_SEGMENT_ENTRY_KIND
}

function assertRichTextSegmentPath(path, label) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error(`${label} 缺少合法 path`)
  }
  path.forEach((item, index) => {
    const isValidItem = typeof item === 'string' || typeof item === 'number'
    if (!isValidItem) {
      throw new Error(`${label} 的 path[${index}] 不合法`)
    }
  })
}

function setRichTextDocumentValueByPath(documentValue, path, text) {
  let current = documentValue
  for (let index = 0; index < path.length - 1; index += 1) {
    current = current?.[path[index]]
    if (!isPlainObject(current) && !Array.isArray(current)) {
      return false
    }
  }
  const key = path[path.length - 1]
  if (typeof key === 'undefined') {
    return false
  }
  if (typeof current?.[key] !== 'string') {
    return false
  }
  current[key] = text
  return true
}

function buildMergedRichTextEntry(templateEntry, segmentList) {
  const expectedTotal = Number(templateEntry.segmentTotal)
  if (!Number.isInteger(expectedTotal) || expectedTotal < 0) {
    throw new Error(
      `${templateEntry.label || templateEntry.id} 的 segmentTotal 不合法`
    )
  }
  if (segmentList.length !== expectedTotal) {
    throw new Error(
      `${templateEntry.label || templateEntry.id} 的富文本片段不完整，期望 ${expectedTotal} 个，实际 ${segmentList.length} 个`
    )
  }

  const segmentIndexMap = new Map()
  segmentList.forEach(segment => {
    const segmentIndex = Number(segment.segmentIndex)
    if (!Number.isInteger(segmentIndex) || segmentIndex <= 0) {
      throw new Error(`${segment.label || segment.id} 的 segmentIndex 不合法`)
    }
    if (Number(segment.segmentTotal || expectedTotal) !== expectedTotal) {
      throw new Error(`${segment.label || segment.id} 的 segmentTotal 不一致`)
    }
    if (segmentIndexMap.has(segmentIndex)) {
      throw new Error(
        `${templateEntry.label || templateEntry.id} 的富文本片段 ${segmentIndex} 重复`
      )
    }
    if (typeof segment.value !== 'string') {
      throw new Error(`${segment.label || segment.id} 的 value 必须是字符串`)
    }
    assertRichTextSegmentPath(segment.path, segment.label || segment.id)
    segmentIndexMap.set(segmentIndex, segment)
  })

  for (let index = 1; index <= expectedTotal; index += 1) {
    if (!segmentIndexMap.has(index)) {
      throw new Error(
        `${templateEntry.label || templateEntry.id} 的富文本片段不完整，缺少 ${index}/${expectedTotal}`
      )
    }
  }

  const documentValue = cloneSerializableValue(templateEntry.value)
  const pathTextMap = new Map()
  for (let index = 1; index <= expectedTotal; index += 1) {
    const segment = segmentIndexMap.get(index)
    const pathKey = JSON.stringify(segment.path)
    if (!pathTextMap.has(pathKey)) {
      pathTextMap.set(pathKey, {
        path: segment.path,
        text: ''
      })
    }
    pathTextMap.get(pathKey).text += segment.value
  }

  for (const item of pathTextMap.values()) {
    const isUpdated = setRichTextDocumentValueByPath(
      documentValue,
      item.path,
      item.text
    )
    if (!isUpdated) {
      throw new Error(
        `${templateEntry.label || templateEntry.id} 的富文本片段回填失败`
      )
    }
  }

  validateRichTextDocumentNode(documentValue, templateEntry.id)
  const mergedEntry = {
    ...templateEntry,
    valueType: STRUCTURED_RICH_TEXT_VALUE_TYPE,
    value: documentValue
  }
  delete mergedEntry.entryKind
  delete mergedEntry.parentId
  delete mergedEntry.parentIndex
  delete mergedEntry.segmentIndex
  delete mergedEntry.segmentTotal
  delete mergedEntry.path
  delete mergedEntry.note
  return mergedEntry
}

function mergeRichTextSegmentImportPayload(parsedData) {
  const entries = parsedData.entries || []
  const hasSegmentEntries = entries.some(entry => {
    return isRichTextTemplateEntry(entry) || isRichTextSegmentEntry(entry)
  })
  if (!hasSegmentEntries) {
    return parsedData
  }

  const templateMap = new Map()
  const segmentMap = new Map()
  entries.forEach(entry => {
    if (isRichTextTemplateEntry(entry)) {
      if (templateMap.has(entry.id)) {
        throw new Error(`${entry.label || entry.id} 的富文本结构模板重复`)
      }
      templateMap.set(entry.id, entry)
      return
    }
    if (isRichTextSegmentEntry(entry)) {
      const parentId = normalizeStringValue(entry.parentId)
      if (!parentId) {
        throw new Error(`${entry.label || entry.id} 缺少 parentId`)
      }
      if (!segmentMap.has(parentId)) {
        segmentMap.set(parentId, [])
      }
      segmentMap.get(parentId).push(entry)
    }
  })

  for (const parentId of segmentMap.keys()) {
    if (!templateMap.has(parentId)) {
      throw new Error(`富文本片段 ${parentId} 缺少结构模板`)
    }
  }

  const mergedTemplateMap = new Map()
  for (const [templateId, templateEntry] of templateMap.entries()) {
    mergedTemplateMap.set(
      templateId,
      buildMergedRichTextEntry(templateEntry, segmentMap.get(templateId) || [])
    )
  }

  return {
    ...parsedData,
    entries: entries
      .map(entry => {
        if (isRichTextTemplateEntry(entry)) {
          return mergedTemplateMap.get(entry.id)
        }
        if (isRichTextSegmentEntry(entry)) {
          return null
        }
        return entry
      })
      .filter(Boolean)
  }
}

function buildRelationEntryMatchKey(entry, sourceId) {
  if (entry.scope === 'relation') {
    const fieldName =
      entry.fieldName === 'options.title'
        ? `${entry.fieldName}.${entry.optionIndex}`
        : entry.fieldName || ''
    return [
      'relation',
      entry.relationField || '',
      entry.collectionName || '',
      sourceId,
      fieldName
    ].join(':')
  }

  if (entry.scope === 'parentRelation') {
    return [
      'parentRelation',
      entry.collectionName || '',
      sourceId,
      entry.fieldName || ''
    ].join(':')
  }

  return ''
}

function buildTranslationEntryMatchKeys(entry) {
  if (entry.scope === 'post') {
    return [`post:${entry.fieldName}`]
  }

  const sourceId = normalizeStringValue(entry.sourceId)
  if (!sourceId) {
    return []
  }

  const matchKey = buildRelationEntryMatchKey(entry, sourceId)
  if (!matchKey) {
    return []
  }
  return [matchKey]
}

function buildMappedSourceEntry(sourceEntry, targetEntry) {
  const value = cloneSerializableValue(sourceEntry.value)
  return {
    ...targetEntry,
    value,
    previewText: buildPreviewText(value, targetEntry.valueType),
    previewRawValue: buildPreviewRawValue(value, targetEntry.valueType),
    currentPreviewText: targetEntry.previewText,
    currentPreviewRawValue: targetEntry.previewRawValue,
    sourcePreviewText: sourceEntry.previewText,
    sourcePreviewRawValue: sourceEntry.previewRawValue
  }
}

function getSkippedEntryDisplayName(entry) {
  const recordLabel = normalizeStringValue(entry.recordLabel)
  if (recordLabel) {
    return recordLabel
  }

  const label = normalizeStringValue(entry.label)
  if (label.includes(' / ')) {
    return label.split(' / ')[0]
  }
  if (label) {
    return label
  }
  return normalizeStringValue(entry.id) || '未命名内容'
}

function getSkippedEntryTypeLabel(entry) {
  const relationTypeLabel = normalizeStringValue(entry.relationTypeLabel)
  if (relationTypeLabel) {
    return relationTypeLabel
  }

  const groupLabel = normalizeStringValue(entry.groupLabel)
  if (groupLabel.includes(' / ')) {
    const parts = groupLabel.split(' / ')
    const lastPart = parts[parts.length - 1]
    if (lastPart) {
      return lastPart
    }
  }

  if (entry.scope === 'relation') {
    return '关联内容'
  }
  if (entry.scope === 'parentRelation') {
    return '父级关联'
  }
  return '内容'
}

function buildSkippedEntryGroupKey(entry, reasonType) {
  if (entry.scope === 'relation') {
    return [
      reasonType,
      entry.scope,
      entry.relationField || '',
      entry.collectionName || '',
      normalizeStringValue(
        entry.sourceId || entry.recordId || entry.recordLabel
      )
    ].join(':')
  }

  if (entry.scope === 'parentRelation') {
    return [
      reasonType,
      entry.scope,
      entry.collectionName || '',
      normalizeStringValue(
        entry.sourceId || entry.recordId || entry.recordLabel
      )
    ].join(':')
  }

  return [reasonType, entry.scope || '', entry.id || ''].join(':')
}

function buildMissingTargetMessage(entry) {
  const displayName = getSkippedEntryDisplayName(entry)
  const typeLabel = getSkippedEntryTypeLabel(entry)
  if (entry.scope === 'post') {
    return `当前文章缺少「${displayName}」对应内容，已跳过`
  }
  if (entry.scope === 'relation') {
    return `${typeLabel}「${displayName}」还没有当前语言版本，已跳过`
  }
  if (entry.scope === 'parentRelation') {
    return `父级${typeLabel}「${displayName}」还没有当前语言版本，已跳过`
  }
  return `「${displayName}」还没有当前语言版本，已跳过`
}

function buildTypeMismatchMessage(entry) {
  const displayName = getSkippedEntryDisplayName(entry)
  return `「${displayName}」的数据类型和当前语言版本不一致，已跳过`
}

function buildMissingSourceIdMessage(entry) {
  const displayName = getSkippedEntryDisplayName(entry)
  const typeLabel = getSkippedEntryTypeLabel(entry)
  if (entry.scope === 'relation') {
    return `${typeLabel}「${displayName}」源快照缺少 sourceId，已跳过`
  }
  if (entry.scope === 'parentRelation') {
    return `父级${typeLabel}「${displayName}」源快照缺少 sourceId，已跳过`
  }
  return `「${displayName}」源快照缺少 sourceId，已跳过`
}

function buildSkippedEntryAction(entry, reasonType) {
  if (
    reasonType === 'missingTarget' &&
    entry.scope === 'relation' &&
    entry.collectionName === 'posts' &&
    entry.relationField &&
    entry.sourceId &&
    entry.recordId
  ) {
    return {
      actionType: 'createTranslationPost',
      sourceSnapshotId: entry.recordId,
      relationField: entry.relationField,
      collectionName: entry.collectionName
    }
  }

  return {}
}

function addSkippedEntry(skippedEntries, skippedEntryMap, entry, reasonType) {
  const key = buildSkippedEntryGroupKey(entry, reasonType)
  if (skippedEntryMap.has(key)) {
    return
  }

  let message = buildMissingTargetMessage(entry)
  let reason = '缺少当前语言版本'
  if (reasonType === 'typeMismatch') {
    message = buildTypeMismatchMessage(entry)
    reason = '数据类型不一致'
  }
  if (reasonType === 'missingSourceId') {
    message = buildMissingSourceIdMessage(entry)
    reason = '源快照缺少 sourceId'
  }

  skippedEntryMap.set(key, true)
  skippedEntries.push({
    id: key,
    label: getSkippedEntryDisplayName(entry),
    reason,
    message,
    ...buildSkippedEntryAction(entry, reasonType)
  })
}

export function buildSourceToTargetTranslationEntries({
  sourceEntries,
  targetEntries
}) {
  const targetEntryMap = new Map()
  targetEntries.forEach(entry => {
    const keyList = buildTranslationEntryMatchKeys(entry)
    keyList.forEach(key => {
      targetEntryMap.set(key, entry)
    })
  })

  const entries = []
  const skippedEntries = []
  const skippedEntryMap = new Map()
  sourceEntries.forEach(sourceEntry => {
    const keyList = buildTranslationEntryMatchKeys(sourceEntry)
    if (sourceEntry.scope !== 'post' && keyList.length === 0) {
      addSkippedEntry(
        skippedEntries,
        skippedEntryMap,
        sourceEntry,
        'missingSourceId'
      )
      return
    }

    const targetEntry = keyList
      .map(key => targetEntryMap.get(key))
      .find(Boolean)
    if (!targetEntry) {
      addSkippedEntry(
        skippedEntries,
        skippedEntryMap,
        sourceEntry,
        'missingTarget'
      )
      return
    }

    if (sourceEntry.valueType !== targetEntry.valueType) {
      addSkippedEntry(
        skippedEntries,
        skippedEntryMap,
        sourceEntry,
        'typeMismatch'
      )
      return
    }

    entries.push(buildMappedSourceEntry(sourceEntry, targetEntry))
  })

  return {
    entries,
    skippedEntries
  }
}

export function buildTranslationJsonFilename(form) {
  const languageCode = normalizeStringValue(form.languageCode || 'unknown')
  const postId = normalizeStringValue(form.id || 'draft')
  return `translation-post-${languageCode}-${postId}.json`
}

export function buildTranslationJsonSliceFilename(form, index, total) {
  const baseFilename = buildTranslationJsonFilename(form).replace(/\.json$/, '')
  const width = String(total || 1).length
  const indexText = String(index).padStart(width, '0')
  return `${baseFilename}-part-${indexText}-of-${total}.json`
}

function buildMissingSliceImportError({
  expectedTotal,
  importedDocumentCount,
  importedSliceCount,
  missingIndex
}) {
  let message = 'JSON 切片不完整'

  if (importedDocumentCount > 0) {
    message += `，当前导入了 ${importedDocumentCount} 个 JSON`
  }

  if (importedSliceCount > 0) {
    message += `，解析出 ${importedSliceCount}/${expectedTotal} 片`
  } else {
    message += '，当前没有读到有效切片'
  }

  message += `，缺少第 ${missingIndex}/${expectedTotal} 片`
  message +=
    '。如果这些文件来自旧版切片导出，浏览器可能拦截了部分下载；请重新导出完整切片后再导入。'

  return message
}

function splitJsonDocumentTexts(jsonText) {
  const text = normalizeStringValue(jsonText)
  if (!text) {
    return []
  }

  const documentTexts = []
  let startIndex = -1
  let depth = 0
  let isInString = false
  let isEscaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (isInString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        isInString = false
      }
      continue
    }

    if (char === '"') {
      isInString = true
      continue
    }
    if (char === '{') {
      if (depth === 0) {
        startIndex = index
      }
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth < 0) {
        throw new Error('JSON 结构不完整，请检查切片内容')
      }
      if (depth === 0 && startIndex >= 0) {
        documentTexts.push(text.slice(startIndex, index + 1))
        startIndex = -1
      }
      continue
    }
    if (depth === 0 && !/\s/.test(char)) {
      throw new Error('多个 JSON 片段之间只能使用空白分隔')
    }
  }

  if (depth !== 0 || isInString) {
    throw new Error('JSON 结构不完整，请检查切片内容')
  }
  return documentTexts
}

function parseJsonDocumentList(jsonText) {
  const text = normalizeStringValue(jsonText)
  try {
    return [JSON.parse(text)]
  } catch (error) {
    const documentTexts = splitJsonDocumentTexts(text)
    if (documentTexts.length <= 1) {
      throw new Error('JSON 解析失败，请检查语法是否正确')
    }
    return documentTexts.map((documentText, index) => {
      try {
        return JSON.parse(documentText)
      } catch (parseError) {
        throw new Error(`第 ${index + 1} 段 JSON 解析失败，请检查语法`)
      }
    })
  }
}

function assertImportDocumentCompatible(baseDocument, documentItem, index) {
  if (documentItem.schema !== baseDocument.schema) {
    throw new Error(`第 ${index + 1} 段 JSON schema 与第 1 段不一致`)
  }
  if (Number(documentItem.version) !== Number(baseDocument.version)) {
    throw new Error(`第 ${index + 1} 段 JSON version 与第 1 段不一致`)
  }
  const baseMeta = baseDocument.meta || {}
  const itemMeta = documentItem.meta || {}
  ;['postId', 'languageCode'].forEach(fieldName => {
    if (itemMeta[fieldName] !== baseMeta[fieldName]) {
      throw new Error(`第 ${index + 1} 段 JSON ${fieldName} 与第 1 段不一致`)
    }
  })
}

function mergeImportDocumentList(documentList) {
  if (documentList.length === 1) {
    return {
      ...documentList[0],
      __importDocumentCount: 1
    }
  }

  const baseDocument = cloneSerializableValue(documentList[0])
  baseDocument.__importDocumentCount = documentList.length
  const slices = []
  documentList.forEach((documentItem, index) => {
    assertImportDocumentCompatible(baseDocument, documentItem, index)
    if (!documentItem.meta?.slice) {
      throw new Error(`第 ${index + 1} 段不是切片 JSON`)
    }
    if (!Array.isArray(documentItem.slices)) {
      throw new Error(`第 ${index + 1} 段切片 JSON 缺少 slices`)
    }
    slices.push(...documentItem.slices)
  })

  delete baseDocument.entries
  baseDocument.slices = slices
  return baseDocument
}

export function parseTranslationImportPayload(jsonText) {
  let parsedData = mergeImportDocumentList(parseJsonDocumentList(jsonText))

  if (
    !parsedData ||
    typeof parsedData !== 'object' ||
    Array.isArray(parsedData)
  ) {
    throw new Error('JSON 根节点必须是对象')
  }
  if (parsedData.schema !== TRANSLATION_JSON_SCHEMA) {
    throw new Error('JSON schema 不匹配，无法导入到当前编辑器')
  }
  const version = Number(parsedData.version)
  if (![1, TRANSLATION_JSON_VERSION].includes(version)) {
    throw new Error('JSON version 不受支持')
  }
  if (!parsedData.meta || typeof parsedData.meta !== 'object') {
    throw new Error('JSON meta 缺失')
  }
  parsedData = mergeSlicedImportPayload(parsedData)
  parsedData = mergeRichTextSegmentImportPayload(parsedData)
  delete parsedData.__importDocumentCount
  if (!Array.isArray(parsedData.entries) || parsedData.entries.length === 0) {
    throw new Error('JSON entries 不能为空')
  }

  parsedData.entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`第 ${index + 1} 项 entries 数据格式不正确`)
    }
    if (!entry.id || typeof entry.id !== 'string') {
      throw new Error(`第 ${index + 1} 项 entries 缺少 id`)
    }
    if (!entry.fieldName || typeof entry.fieldName !== 'string') {
      throw new Error(`第 ${index + 1} 项 entries 缺少 fieldName`)
    }
    if (
      !entry.valueType ||
      !SUPPORTED_ENTRY_VALUE_TYPES.includes(entry.valueType)
    ) {
      throw new Error(`第 ${index + 1} 项 entries 的 valueType 不受支持`)
    }

    if (entry.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
      try {
        validateRichTextDocumentNode(entry.value, `entries[${index}].value`)
      } catch (error) {
        throw new Error(
          `第 ${index + 1} 项 entries 的富文本结构不合法：${error.message}`
        )
      }
    } else if (typeof entry.value !== 'string') {
      throw new Error(`第 ${index + 1} 项 entries 的 value 必须是字符串`)
    }

    if (entry.assets !== undefined && !isPlainObject(entry.assets)) {
      throw new Error(`第 ${index + 1} 项 entries 的 assets 必须是对象`)
    }
  })

  return parsedData
}

function buildRichTextHtmlFromEntryValue(valueType, value, assets = {}) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return renderRichTextDocument(value)
  }
  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return deserializeRichTextText(value, assets)
  }
  return ''
}

function buildComparableEntryValue(valueType, value) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return JSON.stringify(normalizeRichTextDocumentValue(value))
  }
  return normalizeStringValue(value)
}

function normalizeImportedEntryForCurrentEntry(entry, currentEntry) {
  if (entry.valueType === currentEntry.valueType) {
    return {
      valueType: entry.valueType,
      value: normalizeEntryValue(entry.value, entry.valueType),
      assets: entry.assets || {}
    }
  }

  if (
    currentEntry.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE &&
    entry.valueType === LEGACY_RICH_TEXT_VALUE_TYPE
  ) {
    const html = deserializeRichTextText(entry.value, entry.assets || {})
    const richTextResult = serializeRichTextHtmlToDocument(html)
    return {
      valueType: STRUCTURED_RICH_TEXT_VALUE_TYPE,
      value: richTextResult.document,
      assets: {}
    }
  }

  if (
    currentEntry.valueType === LEGACY_RICH_TEXT_VALUE_TYPE &&
    entry.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE
  ) {
    const html = renderRichTextDocument(entry.value)
    const richTextResult = serializeRichTextHtml(html)
    return {
      valueType: LEGACY_RICH_TEXT_VALUE_TYPE,
      value: richTextResult.text,
      assets: richTextResult.assets
    }
  }

  return null
}

export function buildTranslationImportPreview({
  parsedPayload,
  currentEntries,
  form,
  referenceEntries = []
}) {
  if (parsedPayload.meta.postId !== form.id) {
    throw new Error('JSON postId 与当前文章不匹配')
  }
  if (parsedPayload.meta.languageCode !== form.languageCode) {
    throw new Error('JSON languageCode 与当前文章不匹配')
  }

  const currentEntryMap = new Map(
    currentEntries.map(entry => [entry.id, entry])
  )
  const referenceEntryMap = new Map(
    referenceEntries.map(entry => [entry.id, entry])
  )
  const relationUpdateMap = new Map()
  const postPatch = {}
  const warningList = []
  const changeList = []

  parsedPayload.entries.forEach(entry => {
    const currentEntry = currentEntryMap.get(entry.id)
    if (!currentEntry) {
      warningList.push(`已跳过未知条目：${entry.label || entry.id}`)
      return
    }

    const normalizedImportEntry = normalizeImportedEntryForCurrentEntry(
      entry,
      currentEntry
    )
    if (!normalizedImportEntry) {
      warningList.push(`已跳过类型不匹配条目：${entry.label || entry.id}`)
      return
    }

    const nextValue = normalizedImportEntry.value
    const currentValue = currentEntry.value
    let nextComparableValue = buildComparableEntryValue(
      normalizedImportEntry.valueType,
      nextValue
    )
    let currentComparableValue = buildComparableEntryValue(
      currentEntry.valueType,
      currentValue
    )
    if (
      currentEntry.collectionName === 'tags' &&
      currentEntry.fieldName === 'tagname'
    ) {
      nextComparableValue = normalizeTagName(nextComparableValue)
    }
    if (nextComparableValue === currentComparableValue) {
      return
    }

    let nextHtml = ''
    let currentHtml = ''
    let sourceHtml = ''
    let sourceValue = ''
    let hasSourceValue = false
    const referenceEntry = referenceEntryMap.get(entry.id)
    if (isRichTextValueType(currentEntry.valueType)) {
      currentHtml = buildRichTextHtmlFromEntryValue(
        currentEntry.valueType,
        currentValue,
        currentEntry.assets || {}
      )
      nextHtml = buildRichTextHtmlFromEntryValue(
        normalizedImportEntry.valueType,
        nextValue,
        normalizedImportEntry.assets || {}
      )
    }
    if (referenceEntry) {
      hasSourceValue = true
      sourceValue = buildPreviewRawValue(
        referenceEntry.value,
        referenceEntry.valueType
      )
      if (isRichTextValueType(referenceEntry.valueType)) {
        sourceHtml = buildRichTextHtmlFromEntryValue(
          referenceEntry.valueType,
          referenceEntry.value,
          referenceEntry.assets || {}
        )
      }
    }

    changeList.push({
      id: entry.id,
      scope: currentEntry.scope,
      label: currentEntry.label,
      groupLabel: currentEntry.groupLabel,
      groupCategory: currentEntry.groupCategory,
      groupTitle: currentEntry.groupTitle,
      valueType: currentEntry.valueType,
      fieldName: currentEntry.fieldName,
      fieldLabel: currentEntry.fieldLabel,
      recordLabel: currentEntry.recordLabel,
      relationTypeLabel: currentEntry.relationTypeLabel,
      collectionName: currentEntry.collectionName,
      postType: currentEntry.postType,
      optional: currentEntry.optional,
      entryKind: currentEntry.entryKind,
      segmentIndex: currentEntry.segmentIndex,
      segmentTotal: currentEntry.segmentTotal,
      hasSourceValue,
      sourceRecordLabel: referenceEntry?.recordLabel || '',
      sourceValue,
      sourceHtml,
      currentValue: buildPreviewRawValue(currentValue, currentEntry.valueType),
      nextValue: buildPreviewRawValue(
        nextValue,
        normalizedImportEntry.valueType
      ),
      currentHtml,
      nextHtml
    })

    let finalValue = isRichTextValueType(currentEntry.valueType)
      ? buildRichTextHtmlFromEntryValue(
          normalizedImportEntry.valueType,
          nextValue,
          normalizedImportEntry.assets || {}
        )
      : nextValue
    if (
      currentEntry.collectionName === 'tags' &&
      currentEntry.fieldName === 'tagname'
    ) {
      finalValue = normalizeTagName(finalValue)
    }

    if (entry.scope === 'post') {
      postPatch[entry.fieldName] = finalValue
      return
    }

    const targetCollectionName = currentEntry.collectionName
    const targetRecordId = currentEntry.recordId
    const relationUpdateKey = `${targetCollectionName}:${targetRecordId}`
    if (!relationUpdateMap.has(relationUpdateKey)) {
      relationUpdateMap.set(relationUpdateKey, {
        collectionName: targetCollectionName,
        id: targetRecordId,
        payload: {}
      })
    }
    if (
      currentEntry.collectionName === 'votes' &&
      currentEntry.fieldName === 'options.title'
    ) {
      const payload = relationUpdateMap.get(relationUpdateKey).payload
      const optionList = Array.isArray(payload.options)
        ? payload.options
        : cloneSerializableValue(currentEntry.optionList || [])
      const optionIndex = optionList.findIndex((option, index) => {
        if (currentEntry.optionId) {
          return String(option._id || '') === String(currentEntry.optionId)
        }
        return index === currentEntry.optionIndex
      })
      if (optionIndex >= 0) {
        optionList[optionIndex].title = finalValue
        payload.options = optionList
      }
      return
    }

    relationUpdateMap.get(relationUpdateKey).payload[entry.fieldName] =
      finalValue
  })

  return {
    changeList,
    warningList,
    skippedCount: warningList.length,
    changeCount: changeList.length,
    applyPlan: {
      postPatch,
      relationUpdates: Array.from(relationUpdateMap.values())
    }
  }
}
