const cheerio = require('cheerio')

// 允许抽取直接文本节点的元素白名单
const TEXT_CONTAINER_TAGS = new Set([
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'td',
  'th',
  'blockquote',
  'figcaption',
  'a',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'small',
  'mark',
  'label',
  'caption',
  'dt',
  'dd',
  'summary'
])

// 严格排除的元素（及其后代全部跳过）
const EXCLUDED_TAGS = new Set([
  'script',
  'style',
  'code',
  'pre',
  'iframe',
  'noscript',
  'template',
  'svg',
  'math'
])

// 允许翻译的元素特定属性
const TRANSLATABLE_ATTRS_BY_TAG = {
  img: ['alt', 'title'],
  area: ['alt', 'title'],
  input: ['placeholder', 'title', 'aria-label'],
  textarea: ['placeholder', 'title', 'aria-label'],
  a: ['title', 'aria-label']
}

// 通用可翻译属性（所有元素）
const COMMON_TRANSLATABLE_ATTRS = ['title', 'aria-label']

// 禁止触碰的属性（即使是 title/aria-label 也要在这些标签上跳过）
const ATTR_EXCLUDED_TAGS = new Set([
  'script',
  'style',
  'code',
  'pre',
  'iframe',
  'video',
  'audio',
  'source',
  'svg',
  'math',
  'template'
])

function makeSegmentId(counter) {
  return 'seg-' + counter.toString(36).padStart(4, '0')
}

/**
 * 判定文本是否值得翻译
 */
function isTranslatableText(text) {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  // 纯数字、纯符号、纯空白不翻译
  if (/^[\s\d\W_]+$/.test(trimmed)) return false
  return true
}

/**
 * 解析 HTML，抽取可翻译 segment，并返回回填函数。
 *
 * @param {string} html
 * @returns {{
 *   segments: Array<{ segmentId:string, kind:string, text:string, context?:string }>,
 *   applyTranslations: (translations: Record<string,string>) => string,
 *   isEmpty: boolean
 * }}
 */
function prepareHtmlTranslation(html) {
  if (!html || typeof html !== 'string') {
    return {
      segments: [],
      applyTranslations: () => html || '',
      isEmpty: true
    }
  }

  const $ = cheerio.load(html, { decodeEntities: false }, false)

  const segments = []
  const appliers = [] // Array<(map) => void>
  let counter = 0

  function registerTextNode(node, kind, contextTag) {
    const raw = node.data
    if (!isTranslatableText(raw)) return
    // 保留前后空白，只翻译中间实体
    const leading = raw.match(/^\s*/)[0]
    const trailing = raw.match(/\s*$/)[0]
    const body = raw.slice(leading.length, raw.length - trailing.length)
    if (!body) return
    const segmentId = makeSegmentId(counter++)
    segments.push({
      segmentId,
      kind: kind || 'text',
      text: body,
      context: contextTag || ''
    })
    appliers.push(function (map) {
      if (Object.prototype.hasOwnProperty.call(map, segmentId)) {
        const translated = map[segmentId]
        if (typeof translated === 'string') {
          node.data = leading + translated + trailing
        }
      }
    })
  }

  function registerAttr(element, attrName, kind) {
    const attribs = element.attribs || {}
    const raw = attribs[attrName]
    if (!isTranslatableText(raw)) return
    const segmentId = makeSegmentId(counter++)
    segments.push({
      segmentId,
      kind: kind || 'attr:' + attrName,
      text: raw.trim(),
      context: element.name + '[' + attrName + ']'
    })
    appliers.push(function (map) {
      if (Object.prototype.hasOwnProperty.call(map, segmentId)) {
        const translated = map[segmentId]
        if (typeof translated === 'string') {
          element.attribs[attrName] = translated
        }
      }
    })
  }

  function walk(node) {
    if (!node) return
    if (node.type === 'text') {
      // 走到这里说明父节点允许抽取
      return
    }
    if (node.type !== 'tag') {
      // comment / directive / cdata 全部忽略
      if (node.children && node.children.length) {
        node.children.forEach(walk)
      }
      return
    }

    const tagName = (node.name || '').toLowerCase()
    if (EXCLUDED_TAGS.has(tagName)) {
      return
    }

    // 先抽属性
    if (!ATTR_EXCLUDED_TAGS.has(tagName)) {
      const specific = TRANSLATABLE_ATTRS_BY_TAG[tagName] || []
      specific.forEach(function (attr) {
        registerAttr(node, attr, 'attr:' + attr)
      })
      COMMON_TRANSLATABLE_ATTRS.forEach(function (attr) {
        if (specific.indexOf(attr) === -1) {
          registerAttr(node, attr, 'attr:' + attr)
        }
      })
    }

    // 再抽直接文本子节点
    if (TEXT_CONTAINER_TAGS.has(tagName) && Array.isArray(node.children)) {
      node.children.forEach(function (child) {
        if (child.type === 'text') {
          registerTextNode(child, 'text', tagName)
        }
      })
    }

    // 递归子节点
    if (Array.isArray(node.children)) {
      node.children.forEach(walk)
    }
  }

  const root = $.root()[0]
  if (root && Array.isArray(root.children)) {
    root.children.forEach(walk)
  }

  function applyTranslations(translations) {
    const map =
      translations && typeof translations === 'object' ? translations : {}
    appliers.forEach(function (fn) {
      fn(map)
    })
    return $.html()
  }

  return {
    segments,
    applyTranslations,
    isEmpty: segments.length === 0
  }
}

/**
 * 按照 plan 6.4 的批处理约束拆分 segments。
 * 默认 80 条 / 6000 字符一批，超出自动切分。
 *
 * @param {Array} segments
 * @param {object} [limits]
 * @param {number} [limits.maxSegments]
 * @param {number} [limits.maxChars]
 * @returns {Array<Array>} batches
 */
function chunkSegments(segments, limits) {
  const maxSegments = (limits && limits.maxSegments) || 80
  const maxChars = (limits && limits.maxChars) || 6000
  const batches = []
  let current = []
  let charsInCurrent = 0

  for (const seg of segments) {
    const len = seg.text ? seg.text.length : 0
    const wouldExceedChars =
      charsInCurrent + len > maxChars && current.length > 0
    const wouldExceedCount = current.length >= maxSegments
    if (wouldExceedChars || wouldExceedCount) {
      batches.push(current)
      current = []
      charsInCurrent = 0
    }
    current.push(seg)
    charsInCurrent += len
  }
  if (current.length) batches.push(current)
  return batches
}

/**
 * 粗校验 HTML 可被 DOM 正常解析（plan 8.1 校验要求的轻量版）
 * @param {string} html
 * @returns {boolean}
 */
function isParseableHtml(html) {
  if (typeof html !== 'string') return false
  try {
    cheerio.load(html, { decodeEntities: false }, false)
    return true
  } catch (_e) {
    return false
  }
}

module.exports = {
  prepareHtmlTranslation,
  chunkSegments,
  isParseableHtml,
  TEXT_CONTAINER_TAGS,
  EXCLUDED_TAGS
}
