const cheerio = require('cheerio')
const { normalizeText } = require('../../common/utils/object')
const { normalizeSourceUrl } = require('./sourceUrl')

const TRANSLATABLE_TEXT_TAGS = new Set([
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
  'a'
])

const SKIPPED_TEXT_TAGS = new Set(['script', 'style', 'code', 'pre'])
const TRANSLATABLE_ATTRIBUTES = new Set(['title', 'aria-label'])

function loadHtml(html) {
  return cheerio.load(html || '', { decodeEntities: false })
}

function normalizeInternalUrlsInHtml(html, sourceOrigin) {
  const $ = loadHtml(html)
  $('a[href], img[src], video[src], source[src]').each((_, element) => {
    const node = $(element)
    const href = node.attr('href')
    const src = node.attr('src')
    if (href) {
      node.attr('href', normalizeSourceUrl(href, sourceOrigin))
    }
    if (src) {
      node.attr('src', normalizeSourceUrl(src, sourceOrigin))
    }
  })
  return $('body').html() || $.root().html() || ''
}

function extractHtmlMediaReferences(html, sourceOrigin) {
  const $ = loadHtml(html)
  const results = []

  $('img[src], video[src], source[src], a[href]').each((_, element) => {
    const node = $(element)
    const attributeName = node.attr('src') ? 'src' : 'href'
    const rawValue = node.attr(attributeName)
    if (!rawValue) {
      return
    }
    results.push({
      attributeName,
      normalizedValue: normalizeSourceUrl(rawValue, sourceOrigin),
      tagName: element.tagName,
      value: rawValue
    })
  })

  return results
}

function walkTranslatableNodes($, handler) {
  let segmentIndex = 0

  $('*').each((_, element) => {
    const tagName = element.tagName?.toLowerCase()
    if (!tagName || SKIPPED_TEXT_TAGS.has(tagName)) {
      return
    }

    if (TRANSLATABLE_TEXT_TAGS.has(tagName)) {
      $(element)
        .contents()
        .each((__, child) => {
          if (child.type !== 'text') {
            return
          }
          const text = child.data || ''
          if (!normalizeText(text)) {
            return
          }
          handler({
            attributeName: null,
            element,
            segmentId: String(segmentIndex),
            text
          })
          segmentIndex += 1
        })
    }

    for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
      const attributeValue = $(element).attr(attributeName)
      if (!normalizeText(attributeValue)) {
        continue
      }
      handler({
        attributeName,
        element,
        segmentId: String(segmentIndex),
        text: attributeValue
      })
      segmentIndex += 1
    }

    if (tagName === 'img') {
      for (const attributeName of ['alt', 'title']) {
        const attributeValue = $(element).attr(attributeName)
        if (!normalizeText(attributeValue)) {
          continue
        }
        handler({
          attributeName,
          element,
          segmentId: String(segmentIndex),
          text: attributeValue
        })
        segmentIndex += 1
      }
    }
  })
}

function extractTranslatableHtmlSegments(html) {
  const $ = loadHtml(html)
  const segments = []

  walkTranslatableNodes($, ({ attributeName, segmentId, text }) => {
    segments.push({
      segmentId,
      sourceText: text,
      attributeName
    })
  })

  return {
    segments,
    sanitizedHtml: $('body').html() || $.root().html() || ''
  }
}

function applyTranslatedHtmlSegments(html, translations) {
  const $ = loadHtml(html)
  const translationMap = new Map(
    translations.map(item => [String(item.segmentId), item.translatedText])
  )

  walkTranslatableNodes($, ({ attributeName, element, segmentId }) => {
    if (!translationMap.has(segmentId)) {
      return
    }
    const nextValue = translationMap.get(segmentId)
    if (attributeName) {
      $(element).attr(attributeName, nextValue)
    } else {
      $(element)
        .contents()
        .each((_, child) => {
          if (child.type === 'text' && normalizeText(child.data || '')) {
            child.data = nextValue
            return false
          }
          return undefined
        })
    }
  })

  return $('body').html() || $.root().html() || ''
}

function validateHtmlContent(html) {
  const $ = loadHtml(html)
  return $('body').html() || $.root().html() || ''
}

function extractPlainTextFromHtml(html) {
  const $ = loadHtml(html)
  return normalizeText($.text() || '')
}

module.exports = {
  extractPlainTextFromHtml,
  applyTranslatedHtmlSegments,
  extractHtmlMediaReferences,
  extractTranslatableHtmlSegments,
  normalizeInternalUrlsInHtml,
  validateHtmlContent
}