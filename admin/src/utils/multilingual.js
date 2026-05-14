import { limitStr } from '@/utils/utils'
import {
  LANGUAGE_CONFIG_LIST,
  SIDEBAR_BUILTIN_TYPE_LIST
} from '@/config/languages'

function assertValidLanguageConfigList(languageConfigList) {
  if (!Array.isArray(languageConfigList) || languageConfigList.length === 0) {
    throw new Error('LANGUAGE_CONFIG_LIST must be a non-empty array')
  }

  const languageCodeSet = new Set()
  let defaultLanguageConfig = null

  for (const languageConfig of languageConfigList) {
    if (!languageConfig || typeof languageConfig !== 'object') {
      throw new Error('Language config must be an object')
    }

    if (
      typeof languageConfig.code !== 'string' ||
      !languageConfig.code.trim()
    ) {
      throw new Error('Language config code is required')
    }

    if (languageCodeSet.has(languageConfig.code)) {
      throw new Error(`Duplicate language code: ${languageConfig.code}`)
    }

    if (
      typeof languageConfig.label !== 'string' ||
      !languageConfig.label.trim()
    ) {
      throw new Error(`Language label is required: ${languageConfig.code}`)
    }

    if (!languageConfig.sidebarBuiltinTitles) {
      throw new Error(
        `Sidebar builtin titles are required: ${languageConfig.code}`
      )
    }

    for (const sidebarType of SIDEBAR_BUILTIN_TYPE_LIST) {
      if (
        !Object.prototype.hasOwnProperty.call(
          languageConfig.sidebarBuiltinTitles,
          sidebarType
        )
      ) {
        throw new Error(
          `Missing sidebar builtin title ${sidebarType}: ${languageConfig.code}`
        )
      }
    }

    languageCodeSet.add(languageConfig.code)

    if (languageConfig.isDefault) {
      if (defaultLanguageConfig) {
        throw new Error('Only one default language is allowed')
      }

      defaultLanguageConfig = languageConfig
    }
  }

  if (!defaultLanguageConfig) {
    throw new Error('Default language config is required')
  }
}

assertValidLanguageConfigList(LANGUAGE_CONFIG_LIST)

const DEFAULT_LANGUAGE_CONFIG = LANGUAGE_CONFIG_LIST.find(languageConfig => {
  return languageConfig.isDefault
})

export const SUPPORTED_LANGUAGE_OPTIONS = LANGUAGE_CONFIG_LIST.map(
  languageConfig => {
    return {
      label: languageConfig.label,
      value: languageConfig.code
    }
  }
)

export const SUPPORTED_LANGUAGE_CODES = LANGUAGE_CONFIG_LIST.map(
  languageConfig => {
    return languageConfig.code
  }
)

export const DEFAULT_LANGUAGE_CODE = DEFAULT_LANGUAGE_CONFIG.code

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

export const SIDEBAR_BUILTIN_TITLE_MAP = SIDEBAR_BUILTIN_TYPE_LIST.reduce(
  (titleMap, sidebarType) => {
    titleMap[sidebarType] = {}

    for (const languageConfig of LANGUAGE_CONFIG_LIST) {
      titleMap[sidebarType][languageConfig.code] =
        languageConfig.sidebarBuiltinTitles[sidebarType]
    }

    return titleMap
  },
  {}
)

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
  let resolveLanguageCode = item => item
  if (typeof getLanguageCode === 'function') {
    resolveLanguageCode = getLanguageCode
  }

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

  const isSupportedLanguage = SUPPORTED_LANGUAGE_OPTIONS.some(option => {
    return option.value === languageCode
  })
  if (!isSupportedLanguage) {
    return ''
  }

  return titleMap[languageCode] || ''
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
