import { translateField } from './aiTranslation.js'
import { FIELD_KIND } from '../../common/constants/index.js'

/**
 * 翻译 HTML 富文本内容
 * 保留 HTML 结构，仅翻译文本节点和特定属性（alt, title）
 * @param {string} html
 * @param {string} targetLanguageCode
 * @param {string} entityId
 * @returns {Promise<string>}
 */
export async function translateHtml(html, targetLanguageCode, entityId = '') {
  if (!html || !html.trim()) return html

  // 整体翻译（以 RICH_TEXT 模式交给 AI，保留标签）
  const { result } = await translateField({
    sourceText: html,
    targetLanguageCode,
    fieldKind: FIELD_KIND.CONTENT_HTML,
    entityType: 'Post',
    entityId,
    fieldPath: 'content'
  })

  return result
}
