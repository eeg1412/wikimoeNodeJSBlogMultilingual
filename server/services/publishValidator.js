import {
  TRANSLATION_STATUS,
  SUPPORTED_LANGUAGES,
  POST_STATUS
} from '../../common/constants/index.js'

/**
 * 发布前验证文章数据完整性
 * @param {object} post - Post lean 文档
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePostForPublish(post) {
  const errors = []
  const warnings = []

  // 必填字段
  if (!post.title || !post.title.trim()) {
    errors.push('标题不能为空')
  }
  if (!post.content || !post.content.trim()) {
    warnings.push('正文内容为空')
  }

  // 语言验证
  if (!SUPPORTED_LANGUAGES.includes(post.languageCode)) {
    errors.push(`不支持的语言代码: ${post.languageCode}`)
  }

  // 翻译状态验证
  if (post.translationStatus === TRANSLATION_STATUS.OUTDATED) {
    warnings.push('原文已更新，翻译内容可能不是最新版本')
  }
  if (post.translationStatus === TRANSLATION_STATUS.STUB) {
    errors.push('文章是 stub 状态，需要完整导入后再发布')
  }

  // 类型验证
  if (![1, 2].includes(post.type)) {
    errors.push(`文章类型 ${post.type} 不允许发布`)
  }

  // allowRemark 强制
  if (post.allowRemark !== false) {
    errors.push('allowRemark 必须为 false（此站不支持评论）')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
