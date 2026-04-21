// 翻译状态枚举
// pending        等待首次翻译
// ai_draft       AI 已出稿，尚未人工确认
// manual_draft   人工修改中，尚未确认
// approved       已确认，可用于发布
// not_required   无需翻译（例如纯数字字段或空文本）
// stub           仅登记但内容尚未导入的占位记录
// outdated       源文发生变化，现有译文可能过期，需人工重新确认
const TRANSLATION_STATUS = {
  PENDING: 'pending',
  AI_DRAFT: 'ai_draft',
  MANUAL_DRAFT: 'manual_draft',
  APPROVED: 'approved',
  NOT_REQUIRED: 'not_required',
  STUB: 'stub',
  OUTDATED: 'outdated'
}

const TRANSLATION_STATUS_VALUES = Object.values(TRANSLATION_STATUS)

// 发布校验通过的翻译状态
const PUBLISHABLE_TRANSLATION_STATUSES = [
  TRANSLATION_STATUS.APPROVED,
  TRANSLATION_STATUS.NOT_REQUIRED
]

module.exports = {
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES,
  PUBLISHABLE_TRANSLATION_STATUSES
}
