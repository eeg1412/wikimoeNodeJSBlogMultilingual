import {
  getRelationEditFields,
  getRelationOptionLabel,
  getRelationTranslationFields
} from '@/utils/relationEditFields'

export const TRANSLATION_JSON_SCHEMA = 'wikimoe.translation.post'
export const TRANSLATION_JSON_VERSION = 2

const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'
const SUPPORTED_ENTRY_VALUE_TYPES = [
  'plainText',
  LEGACY_RICH_TEXT_VALUE_TYPE,
  STRUCTURED_RICH_TEXT_VALUE_TYPE
]
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
    name: 'alias',
    label: '文章别名',
    valueType: 'plainText',
    supportedTypes: [1, 2, 3],
    defaultSelected: false,
    optional: true
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
        label,
        groupLabel: '文章正文',
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
      label,
      groupLabel: '文章正文',
      valueType: fieldConfig.valueType,
      value: form[fieldConfig.name],
      defaultSelected: fieldConfig.defaultSelected,
      optional: Boolean(fieldConfig.optional)
    },
    options
  )
}

function createRelationEntry(relationField, record, editField, options = {}) {
  const recordLabel = getRelationOptionLabel(record)
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
        sourceId: normalizeStringValue(record.sourceId),
        recordLabel,
        fieldName: editField.name,
        label: `${recordLabel} / ${editField.label}`,
        groupLabel: `关联内容 / ${relationField.label}`,
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
      sourceId: normalizeStringValue(record.sourceId),
      recordLabel,
      fieldName: editField.name,
      label: `${recordLabel} / ${editField.label}`,
      groupLabel: `关联内容 / ${relationField.label}`,
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
  const parentLabel = getRelationOptionLabel(parentRecord)
  return buildTextEntry(
    {
      id: `parent.${parentRelationField.relationCollectionName}.${parentRecord._id}.${parentEditField.name}`,
      scope: 'parentRelation',
      collectionName: parentRelationField.relationCollectionName,
      recordId: parentRecord._id,
      sourceId: normalizeStringValue(parentRecord.sourceId),
      recordLabel: parentLabel,
      fieldName: parentEditField.name,
      label: `${parentLabel} / ${parentEditField.label}`,
      groupLabel: `父级关联 / ${parentRelationField.label}`,
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
    })
  })

  return entryList
}

export function buildTranslationExportPayload({ form, selectedEntries }) {
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
    entries: selectedEntries.map(entry => {
      const exportEntry = {
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
      if (entry.sourceId) {
        exportEntry.sourceId = entry.sourceId
      }
      if (entry.recordLabel) {
        exportEntry.recordLabel = entry.recordLabel
      }
      if (entry.assets && Object.keys(entry.assets).length > 0) {
        exportEntry.assets = entry.assets
      }

      return exportEntry
    })
  }
}

function buildTranslationEntryMatchKey(entry) {
  if (entry.scope === 'post') {
    return `post:${entry.fieldName}`
  }

  const sourceId = normalizeStringValue(entry.sourceId)
  if (!sourceId) {
    return ''
  }

  if (entry.scope === 'relation') {
    return [
      'relation',
      entry.relationField || '',
      entry.collectionName || '',
      sourceId,
      entry.fieldName || ''
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

function buildMappedSourceEntry(sourceEntry, targetEntry) {
  const value = cloneSerializableValue(sourceEntry.value)
  return {
    ...targetEntry,
    value,
    previewText: buildPreviewText(value, targetEntry.valueType),
    previewRawValue: buildPreviewRawValue(value, targetEntry.valueType)
  }
}

export function buildSourceToTargetTranslationEntries({
  sourceEntries,
  targetEntries
}) {
  const targetEntryMap = new Map()
  targetEntries.forEach(entry => {
    const key = buildTranslationEntryMatchKey(entry)
    if (key) {
      targetEntryMap.set(key, entry)
    }
  })

  const entries = []
  const skippedEntries = []
  sourceEntries.forEach(sourceEntry => {
    const key = buildTranslationEntryMatchKey(sourceEntry)
    const targetEntry = targetEntryMap.get(key)
    if (!targetEntry) {
      skippedEntries.push({
        id: sourceEntry.id,
        label: sourceEntry.label,
        reason: '当前语言中找不到对应条目'
      })
      return
    }

    if (sourceEntry.valueType !== targetEntry.valueType) {
      skippedEntries.push({
        id: sourceEntry.id,
        label: sourceEntry.label,
        reason: '源条目和目标条目的类型不一致'
      })
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

export function parseTranslationImportPayload(jsonText) {
  let parsedData = null
  try {
    parsedData = JSON.parse(jsonText)
  } catch (error) {
    throw new Error('JSON 解析失败，请检查语法是否正确')
  }

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
    const nextComparableValue = buildComparableEntryValue(
      normalizedImportEntry.valueType,
      nextValue
    )
    const currentComparableValue = buildComparableEntryValue(
      currentEntry.valueType,
      currentValue
    )
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
      label: currentEntry.label,
      groupLabel: currentEntry.groupLabel,
      valueType: currentEntry.valueType,
      hasSourceValue,
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

    const finalValue = isRichTextValueType(currentEntry.valueType)
      ? buildRichTextHtmlFromEntryValue(
          normalizedImportEntry.valueType,
          nextValue,
          normalizedImportEntry.assets || {}
        )
      : nextValue

    if (entry.scope === 'post') {
      postPatch[entry.fieldName] = finalValue
      return
    }

    const relationUpdateKey = `${entry.collectionName}:${entry.recordId}`
    if (!relationUpdateMap.has(relationUpdateKey)) {
      relationUpdateMap.set(relationUpdateKey, {
        collectionName: entry.collectionName,
        id: entry.recordId,
        payload: {}
      })
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
