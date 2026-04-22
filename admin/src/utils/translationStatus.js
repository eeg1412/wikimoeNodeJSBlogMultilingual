const STATUS_LABEL_MAP = {
  pending: '待翻译',
  ai_draft: 'AI 草稿',
  manual_draft: '人工草稿',
  approved: '已确认',
  not_required: '无需翻译',
  stub: '占位',
  outdated: '源数据已更新'
}

export function getTranslationStatusLabel(status) {
  if (!status) {
    return '缺失'
  }

  return STATUS_LABEL_MAP[status] || status
}

export function getTranslationStatusTagType(status) {
  if (!status) {
    return 'info'
  }
  if (status === 'approved' || status === 'not_required') {
    return 'success'
  }
  if (status === 'outdated') {
    return 'danger'
  }
  if (status === 'ai_draft' || status === 'manual_draft') {
    return 'warning'
  }

  return 'info'
}
