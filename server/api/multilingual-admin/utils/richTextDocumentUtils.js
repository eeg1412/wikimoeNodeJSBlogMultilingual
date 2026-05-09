const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'
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

function normalizeStringValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n')
}

function createEmptyRichTextDocument() {
  return {
    type: 'root',
    children: []
  }
}

function decodeHtmlEntities(value) {
  const text = normalizeStringValue(value)
  if (!text.includes('&')) {
    return text
  }
  const namedEntityMap = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  }
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const normalizedEntity = String(entity || '').toLowerCase()
    if (normalizedEntity.startsWith('#x')) {
      const codePoint = Number.parseInt(normalizedEntity.slice(2), 16)
      if (Number.isFinite(codePoint)) {
        return String.fromCodePoint(codePoint)
      }
      return match
    }
    if (normalizedEntity.startsWith('#')) {
      const codePoint = Number.parseInt(normalizedEntity.slice(1), 10)
      if (Number.isFinite(codePoint)) {
        return String.fromCodePoint(codePoint)
      }
      return match
    }
    return namedEntityMap[normalizedEntity] || match
  })
}

function normalizeAttributeName(value) {
  return normalizeStringValue(value).trim().toLowerCase()
}

function parseAttributeText(attributeText) {
  const attrs = {}
  const translatableAttrs = {}
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match = attributePattern.exec(attributeText)
  while (match) {
    const attributeName = normalizeAttributeName(match[1])
    if (attributeName) {
      let attributeValue = ''
      if (typeof match[3] !== 'undefined') {
        attributeValue = match[3]
      } else if (typeof match[4] !== 'undefined') {
        attributeValue = match[4]
      } else if (typeof match[5] !== 'undefined') {
        attributeValue = match[5]
      }
      const decodedValue = decodeHtmlEntities(attributeValue)
      if (RICH_TEXT_TRANSLATABLE_ATTRIBUTE_NAME_SET.has(attributeName)) {
        translatableAttrs[attributeName] = decodedValue
      } else {
        attrs[attributeName] = decodedValue
      }
    }
    match = attributePattern.exec(attributeText)
  }
  return { attrs, translatableAttrs }
}

function parseHtmlTag(token) {
  const tagText = normalizeStringValue(token)
  const closingMatch = tagText.match(/^<\s*\/\s*([a-z0-9:-]+)/i)
  if (closingMatch) {
    return {
      type: 'close',
      tag: closingMatch[1].toLowerCase()
    }
  }

  const openingMatch = tagText.match(/^<\s*([a-z0-9:-]+)([\s\S]*?)\/?\s*>$/i)
  if (!openingMatch) {
    return null
  }
  const tag = openingMatch[1].toLowerCase()
  const attributeText = openingMatch[2] || ''
  const parsedAttributes = parseAttributeText(attributeText)
  return {
    type: 'open',
    tag,
    selfClosing: /\/\s*>$/.test(tagText) || VOID_HTML_TAG_SET.has(tag),
    attrs: parsedAttributes.attrs,
    translatableAttrs: parsedAttributes.translatableAttrs
  }
}

function appendTextNode(parentNode, text) {
  if (!text) {
    return
  }
  if (!Array.isArray(parentNode.children)) {
    parentNode.children = []
  }
  parentNode.children.push({
    type: 'text',
    text: decodeHtmlEntities(text)
  })
}

function appendElementNode(parentNode, parsedTag) {
  const node = {
    type: 'element',
    tag: parsedTag.tag
  }
  if (Object.keys(parsedTag.attrs).length > 0) {
    node.attrs = parsedTag.attrs
  }
  if (Object.keys(parsedTag.translatableAttrs).length > 0) {
    node.translatableAttrs = parsedTag.translatableAttrs
  }
  if (!parsedTag.selfClosing) {
    node.children = []
  }
  if (!Array.isArray(parentNode.children)) {
    parentNode.children = []
  }
  parentNode.children.push(node)
  return node
}

function closeElementStack(stack, tag) {
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index].tag === tag) {
      stack.length = index
      return
    }
  }
}

function serializeRichTextHtmlToDocument(html) {
  const normalizedHtml = normalizeStringValue(html).trim()
  if (!normalizedHtml) {
    return {
      document: createEmptyRichTextDocument(),
      previewText: ''
    }
  }

  const root = createEmptyRichTextDocument()
  const stack = [root]
  let offset = 0
  let blockedTag = ''

  while (offset < normalizedHtml.length) {
    const tagStart = normalizedHtml.indexOf('<', offset)
    if (tagStart < 0) {
      if (!blockedTag) {
        appendTextNode(stack[stack.length - 1], normalizedHtml.slice(offset))
      }
      break
    }

    if (tagStart > offset && !blockedTag) {
      appendTextNode(
        stack[stack.length - 1],
        normalizedHtml.slice(offset, tagStart)
      )
    }

    const tagEnd = normalizedHtml.indexOf('>', tagStart + 1)
    if (tagEnd < 0) {
      if (!blockedTag) {
        appendTextNode(stack[stack.length - 1], normalizedHtml.slice(tagStart))
      }
      break
    }

    const token = normalizedHtml.slice(tagStart, tagEnd + 1)
    offset = tagEnd + 1
    if (/^<!--/.test(token) || /^<!doctype/i.test(token)) {
      continue
    }

    const parsedTag = parseHtmlTag(token)
    if (!parsedTag) {
      if (!blockedTag) {
        appendTextNode(stack[stack.length - 1], token)
      }
      continue
    }

    if (blockedTag) {
      if (parsedTag.type === 'close' && parsedTag.tag === blockedTag) {
        blockedTag = ''
      }
      continue
    }

    if (parsedTag.type === 'close') {
      closeElementStack(stack, parsedTag.tag)
      continue
    }

    if (BLOCKED_HTML_TAG_SET.has(parsedTag.tag)) {
      if (!parsedTag.selfClosing) {
        blockedTag = parsedTag.tag
      }
      continue
    }

    const elementNode = appendElementNode(stack[stack.length - 1], parsedTag)
    if (!parsedTag.selfClosing) {
      stack.push(elementNode)
    }
  }

  return {
    document: root,
    previewText: getRichTextDocumentPreviewText(root)
  }
}

function getRichTextDocumentPreviewText(value) {
  if (!value || typeof value !== 'object') {
    return ''
  }
  if (value.type === 'text') {
    return normalizeStringValue(value.text).replace(/\s+/g, ' ')
  }
  const textList = []
  if (value.translatableAttrs && typeof value.translatableAttrs === 'object') {
    Object.values(value.translatableAttrs).forEach(text => {
      const normalizedText = normalizeStringValue(text).replace(/\s+/g, ' ')
      if (normalizedText) {
        textList.push(normalizedText)
      }
    })
  }
  const children = Array.isArray(value.children) ? value.children : []
  children.forEach(childNode => {
    const text = getRichTextDocumentPreviewText(childNode)
    if (text) {
      textList.push(text)
    }
  })
  return textList.join(' ').replace(/\s+/g, ' ').trim()
}

function escapeHtmlText(value) {
  return normalizeStringValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, '&quot;').replace(/\n/g, '&#10;')
}

function renderRichTextDocumentNode(node) {
  if (!node || typeof node !== 'object') {
    return ''
  }
  if (node.type === 'root') {
    const children = Array.isArray(node.children) ? node.children : []
    return children.map(renderRichTextDocumentNode).join('')
  }
  if (node.type === 'text') {
    return escapeHtmlText(node.text || '')
  }
  if (node.type !== 'element' || !node.tag) {
    return ''
  }

  const attrs = {
    ...(node.attrs || {}),
    ...(node.translatableAttrs || {})
  }
  const attrText = Object.keys(attrs)
    .filter(key => attrs[key] !== null && typeof attrs[key] !== 'undefined')
    .map(key => ` ${key}="${escapeHtmlAttribute(attrs[key])}"`)
    .join('')
  if (VOID_HTML_TAG_SET.has(node.tag)) {
    return `<${node.tag}${attrText}>`
  }
  const children = Array.isArray(node.children) ? node.children : []
  return `<${node.tag}${attrText}>${children
    .map(renderRichTextDocumentNode)
    .join('')}</${node.tag}>`
}

module.exports = {
  STRUCTURED_RICH_TEXT_VALUE_TYPE,
  serializeRichTextHtmlToDocument,
  getRichTextDocumentPreviewText,
  renderRichTextDocumentNode
}
