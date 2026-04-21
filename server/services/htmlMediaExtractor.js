const cheerio = require('cheerio')
const {
  normalizeSourceUrl
} = require('@wikimoe-ml/common/utils/sourceUrlNormalizer')
const env = require('../config/env')

// 可疑 URL 承载字段
const MEDIA_SELECTORS = [
  { selector: 'img', attr: 'src', kind: 'image' },
  { selector: 'img', attr: 'data-src', kind: 'image' },
  { selector: 'video', attr: 'src', kind: 'video' },
  { selector: 'video > source', attr: 'src', kind: 'video' },
  { selector: 'audio', attr: 'src', kind: 'audio' },
  { selector: 'audio > source', attr: 'src', kind: 'audio' },
  { selector: 'source', attr: 'src', kind: 'media-source' }
]

const LINK_SELECTORS = [{ selector: 'a', attr: 'href' }]

function normalizerOptions() {
  return {
    publicOrigin: env.SOURCE_BLOG_PUBLIC_ORIGIN,
    apiBaseUrl: env.SOURCE_BLOG_API_BASE_URL
  }
}

/**
 * 从 HTML 字符串中提取媒体与链接，归一化为相对路径或第三方外链。
 *
 * @param {string} html
 * @returns {{
 *   mediaItems: Array<{ kind:string, original:string, relative:string|null, external:string|null, attrs:object }>,
 *   linkItems:  Array<{ original:string, relative:string|null, external:string|null, text:string }>
 * }}
 */
function extractFromHtml(html) {
  const result = {
    mediaItems: [],
    linkItems: []
  }
  if (!html || typeof html !== 'string') {
    return result
  }

  const $ = cheerio.load(html, { decodeEntities: false })
  const opts = normalizerOptions()

  const mediaDedup = new Set()
  MEDIA_SELECTORS.forEach(function (cfg) {
    $(cfg.selector).each(function () {
      const $el = $(this)
      const raw = $el.attr(cfg.attr)
      if (!raw) return
      const normalized = normalizeSourceUrl(raw, opts)
      const key =
        cfg.kind +
        '::' +
        (normalized.relative || normalized.external || normalized.original)
      if (mediaDedup.has(key)) return
      mediaDedup.add(key)

      result.mediaItems.push({
        kind: cfg.kind,
        original: normalized.original,
        relative: normalized.relative,
        external: normalized.external,
        attrs: {
          alt: $el.attr('alt') || '',
          width: $el.attr('width') || '',
          height: $el.attr('height') || '',
          mimetype: $el.attr('type') || ''
        }
      })
    })
  })

  // srcset 可能包含多个候选 URL，逐一拆出
  $('img[srcset], source[srcset]').each(function () {
    const $el = $(this)
    const srcset = $el.attr('srcset')
    if (!srcset) return
    const candidates = srcset.split(',')
    for (let i = 0; i < candidates.length; i++) {
      const token = candidates[i].trim().split(/\s+/)[0]
      if (!token) continue
      const normalized = normalizeSourceUrl(token, opts)
      const key =
        'srcset::' +
        (normalized.relative || normalized.external || normalized.original)
      if (mediaDedup.has(key)) continue
      mediaDedup.add(key)
      result.mediaItems.push({
        kind: 'image',
        original: normalized.original,
        relative: normalized.relative,
        external: normalized.external,
        attrs: {
          alt: $el.attr('alt') || '',
          width: '',
          height: '',
          mimetype: ''
        }
      })
    }
  })

  const linkDedup = new Set()
  LINK_SELECTORS.forEach(function (cfg) {
    $(cfg.selector).each(function () {
      const $el = $(this)
      const raw = $el.attr(cfg.attr)
      if (!raw) return
      const normalized = normalizeSourceUrl(raw, opts)
      const key =
        'link::' +
        (normalized.relative || normalized.external || normalized.original)
      if (linkDedup.has(key)) return
      linkDedup.add(key)

      result.linkItems.push({
        original: normalized.original,
        relative: normalized.relative,
        external: normalized.external,
        text: ($el.text() || '').trim().slice(0, 200)
      })
    })
  })

  return result
}

module.exports = {
  extractFromHtml
}
