import {
  buildTranslationEntryMatchKeys,
  buildTranslationExportEntries
} from '@/utils/translationJson'
import { ALL_POST_RELATION_FIELDS } from '@/utils/translationPostAiWorkflow'
import { normalizeTagRecord } from '@/utils/tagName'

// 详情页"相关博文/相关推文"由各自文章独立维护，关联条目内容无法在翻译时稳妥控制，
// 因此多语言（已导入）AI 翻译从根本不纳入这两类字段，批量翻译同样遵循该约定。
const AI_TRANSLATION_EXCLUDED_RELATION_FIELD_SET = new Set([
  'postList',
  'tweetList'
])

export const AI_TRANSLATABLE_POST_RELATION_FIELDS =
  ALL_POST_RELATION_FIELDS.filter(field => {
    return !AI_TRANSLATION_EXCLUDED_RELATION_FIELD_SET.has(field.field)
  })

/**
 * 由原始文章对象构建 buildTranslationExportEntries 所需的关联记录表。
 * @param {Object} post 文章对象（含各关联字段数组）
 * @returns {Object} 以字段名为 key 的关联记录表
 */
function buildRelationRecordsFromPost(post) {
  const records = {}
  AI_TRANSLATABLE_POST_RELATION_FIELDS.forEach(field => {
    records[field.field] = []
  })
  records.author = post.author ? [post.author] : []
  records.sort = post.sort ? [post.sort] : []
  AI_TRANSLATABLE_POST_RELATION_FIELDS.forEach(field => {
    if (field.field === 'author' || field.field === 'sort') {
      return
    }
    if (Array.isArray(post[field.field])) {
      records[field.field] = post[field.field].filter(Boolean)
    }
  })
  if (Array.isArray(records.tags)) {
    records.tags = records.tags.map(normalizeTagRecord)
  }
  return records
}

/**
 * 由原始文章对象构建 buildTranslationExportEntries 所需的 form。
 * @param {Object} post 文章对象
 * @returns {Object} 翻译条目导出所需的最小 form
 */
function buildFormFromPost(post) {
  return {
    ...post,
    id: post._id,
    languageCode: post.languageCode || post.sourceLanguageCode,
    sourceLanguageCode: post.sourceLanguageCode,
    sourceId: post.sourceId || '',
    sourceSnapshotId: post.sourceSnapshotId || '',
    snapshotVersion: post.snapshotVersion,
    type: Number(post.type || 1),
    title: post.title || ''
  }
}

/**
 * 计算条目的跨语言稳定匹配签名（与源→目标映射使用的匹配键一致）。
 * 文章字段为 `post:fieldName`，关联字段基于源记录身份生成，因此同一逻辑字段在
 * 不同语言版本中签名一致，可用于批量翻译时按字段勾选。
 * @param {Object} entry 翻译条目
 * @returns {string} 匹配签名，无法匹配时返回空字符串
 */
export function getTranslationEntryMatchSignature(entry) {
  const keyList = buildTranslationEntryMatchKeys(entry)
  if (Array.isArray(keyList) && keyList.length > 0) {
    return String(keyList[0])
  }
  return ''
}

/**
 * 基于源文章快照构建用于"选择翻译字段"的代表性条目列表。
 * 批量界面只隐藏"当前语言下的内容"（各语言不同，无法在批量界面统一展示），
 * 仍保留"源内容"与"新内容"预览，与单篇 AI 翻译弹窗的字段选择体验保持一致。
 * @param {Object} sourcePost 源文章快照对象
 * @returns {Array<Object>} 代表性翻译条目列表
 */
export function buildSourcePostFieldEntries(sourcePost) {
  if (!sourcePost) {
    return []
  }
  const sourceForm = buildFormFromPost({
    ...sourcePost,
    languageCode: sourcePost.languageCode || sourcePost.sourceLanguageCode
  })
  const entries = buildTranslationExportEntries({
    form: sourceForm,
    relationFields: AI_TRANSLATABLE_POST_RELATION_FIELDS,
    relationRecords: buildRelationRecordsFromPost(sourcePost)
  })
  // 补齐"源内容"预览字段：源条目自身的 previewText 即源文内容，既作为"源内容"也作为
  // 即将翻译的"新内容"展示；不设置"当前语言下的内容"，让该预览行在批量界面自动隐藏。
  return entries.map(entry => {
    return {
      ...entry,
      sourcePreviewText: entry.previewText || '',
      sourcePreviewRawValue: entry.previewRawValue || ''
    }
  })
}
