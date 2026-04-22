import sanitizeHtmlLib from 'sanitize-html'
import {
  RICH_TEXT_DISALLOWED_TAGS,
  DANGEROUS_URL_PROTOCOLS
} from '../../common/constants/index.js'

const ALLOWED_TAGS = sanitizeHtmlLib.defaults.allowedTags.filter(
  tag => !RICH_TEXT_DISALLOWED_TAGS.includes(tag)
)

const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtmlLib.defaults.allowedAttributes,
  '*': ['class', 'style', 'id'],
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  video: ['src', 'controls', 'width', 'height', 'poster', 'preload'],
  source: ['src', 'type'],
  iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow']
}

/**
 * 清理富文本 HTML 内容，移除危险标签与属性
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  if (!html) return ''
  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      a: ['http', 'https', 'ftp', 'mailto', 'tel']
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || ''
        const lower = href.toLowerCase().trim()
        const isDangerous = DANGEROUS_URL_PROTOCOLS.some(p =>
          lower.startsWith(p)
        )
        if (isDangerous) {
          return { tagName: 'span', attribs: { class: 'blocked-link' } }
        }
        return { tagName, attribs }
      }
    }
  })
}

/**
 * 验证已清理的 HTML 内容是否满足安全要求
 * @param {string} html
 * @returns {string[]} 警告信息列表（非空则表示有问题）
 */
export function validateHtmlSafety(html) {
  const warnings = []
  if (!html) return warnings

  // 检查是否含有内联事件处理器（on* 属性）
  if (/\son\w+\s*=/i.test(html)) {
    warnings.push('HTML 内容可能包含内联事件处理器')
  }

  // 检查 javascript: 协议
  if (/javascript\s*:/i.test(html)) {
    warnings.push('HTML 内容包含 javascript: 协议引用')
  }

  return warnings
}
