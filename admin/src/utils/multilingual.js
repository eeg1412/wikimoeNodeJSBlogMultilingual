export const SUPPORTED_LANGUAGE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁体中文（香港）', value: 'zh-HK' },
  { label: '繁体中文（台湾）', value: 'zh-TW' },
  { label: '简体中文（新加坡）', value: 'zh-SG' },
  { label: '日本語', value: 'ja-JP' },
  { label: 'English', value: 'en-US' }
]

export const POST_TYPE_OPTIONS = [
  { label: '博文', value: 1 },
  { label: '推文', value: 2 },
  { label: '页面', value: 3 }
]

export const POST_STATUS_OPTIONS = [
  { label: '草稿', value: 0 },
  { label: '发布', value: 1 },
  { label: '回收站', value: 99 }
]

export const RELATION_COLLECTION_OPTIONS = [
  { label: '作者', value: 'users' },
  { label: '分类', value: 'sorts' },
  { label: '标签', value: 'tags' },
  { label: '地点', value: 'mappoints' },
  { label: '番剧', value: 'bangumis' },
  { label: '电影', value: 'movies' },
  { label: '游戏', value: 'games' },
  { label: '游戏平台', value: 'gamePlatforms' },
  { label: '阅读', value: 'books' },
  { label: '阅读类型', value: 'booktypes' },
  { label: '活动', value: 'events' },
  { label: '活动类型', value: 'eventtypes' },
  { label: '投票', value: 'votes' },
  { label: '媒体', value: 'attachments' }
]

export const MEDIA_MODE_OPTIONS = [
  { label: '远程快照', value: 'remote' },
  { label: '本地文件', value: 'local' }
]

function findOption(options, value) {
  return options.find(item => item.value === value)
}

export function getLanguageText(value) {
  const option = findOption(SUPPORTED_LANGUAGE_OPTIONS, value)
  if (option) {
    return option.label
  }

  return value || '-'
}

export function getPostTypeText(value) {
  const option = findOption(POST_TYPE_OPTIONS, Number(value))
  if (option) {
    return option.label
  }

  return '-'
}

export function getPostStatusText(value) {
  const option = findOption(POST_STATUS_OPTIONS, Number(value))
  if (option) {
    return option.label
  }

  return '-'
}

export function getPostStatusTagType(value) {
  const status = Number(value)
  if (status === 1) {
    return 'success'
  }
  if (status === 99) {
    return 'danger'
  }
  return 'info'
}

export function getTranslationProgress(summary) {
  const total = Number(summary?.total || 0)
  return `${total}/${SUPPORTED_LANGUAGE_OPTIONS.length}`
}
