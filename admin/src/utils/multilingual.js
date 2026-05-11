import { limitStr } from '@/utils/utils'

export const SUPPORTED_LANGUAGE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁体中文（香港）', value: 'zh-HK' },
  { label: '繁体中文（台湾）', value: 'zh-TW' },
  { label: '简体中文（新加坡）', value: 'zh-SG' },
  { label: '日本語', value: 'ja-JP' },
  { label: 'English', value: 'en-US' }
]

const SUPPORTED_LANGUAGE_ORDER_MAP = SUPPORTED_LANGUAGE_OPTIONS.reduce(
  (result, item, index) => {
    result[item.value] = index
    return result
  },
  {}
)

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
  { label: '文章', value: 'posts' },
  { label: '投票', value: 'votes' }
]

export const MEDIA_MODE_OPTIONS = [
  { label: '远程快照', value: 'remote' },
  { label: '本地文件', value: 'local' }
]

export const SIDEBAR_BUILTIN_TITLE_MAP = {
  1: {
    'zh-CN': '自定义内容',
    'zh-HK': '自訂內容',
    'zh-TW': '自訂內容',
    'zh-SG': '自定义内容',
    'ja-JP': 'カスタムコンテンツ',
    'en-US': 'Custom content'
  },
  3: {
    'zh-CN': '最新评论',
    'zh-HK': '最新評論',
    'zh-TW': '最新評論',
    'zh-SG': '最新评论',
    'ja-JP': '最新コメント',
    'en-US': 'Latest comments'
  },
  4: {
    'zh-CN': '随机标签',
    'zh-HK': '隨機標籤',
    'zh-TW': '隨機標籤',
    'zh-SG': '随机标签',
    'ja-JP': 'ランダムタグ',
    'en-US': 'Random tags'
  },
  8: {
    'zh-CN': '分类',
    'zh-HK': '分類',
    'zh-TW': '分類',
    'zh-SG': '分类',
    'ja-JP': 'カテゴリ',
    'en-US': 'Categories'
  },
  9: {
    'zh-CN': '归档',
    'zh-HK': '歸檔',
    'zh-TW': '歸檔',
    'zh-SG': '归档',
    'ja-JP': 'アーカイブ',
    'en-US': 'Archive'
  },
  10: {
    'zh-CN': '谷歌广告',
    'zh-HK': 'Google 廣告',
    'zh-TW': 'Google 廣告',
    'zh-SG': '谷歌广告',
    'ja-JP': 'Google 広告',
    'en-US': 'Google Ads'
  },
  11: {
    'zh-CN': '自定义HTML',
    'zh-HK': '自訂 HTML',
    'zh-TW': '自訂 HTML',
    'zh-SG': '自定义HTML',
    'ja-JP': 'カスタム HTML',
    'en-US': 'Custom HTML'
  },
  12: {
    'zh-CN': '热门文章',
    'zh-HK': '熱門文章',
    'zh-TW': '熱門文章',
    'zh-SG': '热门文章',
    'ja-JP': '人気記事',
    'en-US': 'Popular posts'
  },
  13: {
    'zh-CN': '当季追番',
    'zh-HK': '當季追番',
    'zh-TW': '當季追番',
    'zh-SG': '当季追番',
    'ja-JP': '今期アニメ',
    'en-US': 'This season'
  },
  14: {
    'zh-CN': '攻略中',
    'zh-HK': '攻略中',
    'zh-TW': '攻略中',
    'zh-SG': '攻略中',
    'ja-JP': '攻略中',
    'en-US': 'Currently playing'
  },
  15: {
    'zh-CN': '阅读中',
    'zh-HK': '閱讀中',
    'zh-TW': '閱讀中',
    'zh-SG': '阅读中',
    'ja-JP': '読書中',
    'en-US': 'Currently reading'
  }
}

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

export function compareSupportedLanguage(leftLanguageCode, rightLanguageCode) {
  const leftOrder = Object.prototype.hasOwnProperty.call(
    SUPPORTED_LANGUAGE_ORDER_MAP,
    leftLanguageCode
  )
    ? SUPPORTED_LANGUAGE_ORDER_MAP[leftLanguageCode]
    : Number.MAX_SAFE_INTEGER
  const rightOrder = Object.prototype.hasOwnProperty.call(
    SUPPORTED_LANGUAGE_ORDER_MAP,
    rightLanguageCode
  )
    ? SUPPORTED_LANGUAGE_ORDER_MAP[rightLanguageCode]
    : Number.MAX_SAFE_INTEGER

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  const leftText = String(leftLanguageCode || '')
  const rightText = String(rightLanguageCode || '')
  return leftText.localeCompare(rightText)
}

export function sortBySupportedLanguageOrder(list, getLanguageCode) {
  const resolveLanguageCode =
    typeof getLanguageCode === 'function' ? getLanguageCode : item => item

  return [...(Array.isArray(list) ? list : [])].sort((leftItem, rightItem) => {
    return compareSupportedLanguage(
      resolveLanguageCode(leftItem),
      resolveLanguageCode(rightItem)
    )
  })
}

export function getLocalizedSidebarBuiltinTitle(type, languageCode) {
  const titleMap = SIDEBAR_BUILTIN_TITLE_MAP[type]
  if (!titleMap) {
    return ''
  }

  const normalizedLanguageCode = SUPPORTED_LANGUAGE_OPTIONS.some(option => {
    return option.value === languageCode
  })
    ? languageCode
    : 'zh-CN'

  return titleMap[normalizedLanguageCode] || titleMap['zh-CN'] || ''
}

export function normalizeSidebarBuiltinTitle(title, type, languageCode) {
  const localizedTitle = getLocalizedSidebarBuiltinTitle(type, languageCode)
  const normalizedTitle = stripText(title)

  if (!localizedTitle) {
    return normalizedTitle
  }

  if (!normalizedTitle) {
    return localizedTitle
  }

  const builtinTitleList = Object.values(SIDEBAR_BUILTIN_TITLE_MAP[type] || {})
  if (builtinTitleList.includes(normalizedTitle)) {
    return localizedTitle
  }

  return normalizedTitle
}

export function getPostTypeText(value) {
  const option = findOption(POST_TYPE_OPTIONS, Number(value))
  if (option) {
    return option.label
  }

  return '-'
}

export function getPostTypeTagType(value) {
  const postType = Number(value)
  if (postType === 1) {
    return 'success'
  }
  if (postType === 3) {
    return 'info'
  }
  return undefined
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

export function stripText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .replace(/<[^>]*>/g, '')
    .trim()
}

function getTweetMediaTitle(post) {
  const mediaList = Array.isArray(post?.coverImages) ? post.coverImages : []
  if (mediaList.length === 0) {
    return ''
  }

  const videoCount = mediaList.filter(item => {
    return String(item?.mimetype || '').startsWith('video')
  }).length
  const imageCount = mediaList.length - videoCount

  if (imageCount > 0 && videoCount === 0) {
    return `${imageCount}张图片`
  }
  if (videoCount > 0 && imageCount === 0) {
    return `${videoCount}个视频`
  }
  return `${mediaList.length}个媒体`
}

export function getPostDisplayTitle(post) {
  if (!post) {
    return '-'
  }

  const title = stripText(post.title)
  if (title) {
    return title
  }

  if (Number(post.type) === 2) {
    const tweetText = stripText(post.excerpt).replace(/\s+/g, ' ')
    if (tweetText) {
      return limitStr(tweetText, 50)
    }

    const mediaTitle = getTweetMediaTitle(post)
    if (mediaTitle) {
      return mediaTitle
    }
  }

  const excerpt = stripText(post.excerpt).replace(/\s+/g, ' ')
  if (excerpt) {
    return limitStr(excerpt, 50)
  }

  return '未命名内容'
}

export function getRelationDisplayName(record) {
  if (!record) {
    return '-'
  }

  if ([1, 2, 3].includes(Number(record.type))) {
    return getPostDisplayTitle(record)
  }

  if (record.displayName) {
    return record.displayName
  }

  if (record.tagname) {
    return record.tagname
  }

  if (record.sortname) {
    return record.sortname
  }

  if (record.nickname) {
    return record.nickname
  }

  if (record.username) {
    return record.username
  }

  if (record.filename) {
    return record.filename
  }

  return getPostDisplayTitle(record)
}
