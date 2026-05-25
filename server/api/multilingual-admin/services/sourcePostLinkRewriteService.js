const mongoose = require('mongoose')
const contentRefreshUtils = require('../../../utils/contentRefresh')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  getSourceSeoSettings,
  normalizeSiteUrl
} = require('../../../utils/sourceSeoSettings')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const TRANSLATION_RECORD_KIND = 'translation'
const POST_COLLECTION_NAME = 'posts'
const SOURCE_URL_REGEXP = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_URL_PUNCTUATION_REGEXP = /[.,;:!?，。！？；：、）)\]}]+$/
const PREVIEW_CONTEXT_LENGTH = 100

const POST_RELATION_FIELD_CONFIGS = [
  { field: 'author', label: '作者', collectionName: 'users', multiple: false },
  { field: 'sort', label: '分类', collectionName: 'sorts', multiple: false },
  { field: 'tags', label: '标签', collectionName: 'tags', multiple: true },
  {
    field: 'mappointList',
    label: '地点',
    collectionName: 'mappoints',
    multiple: true
  },
  {
    field: 'bangumiList',
    label: '详情页番剧',
    collectionName: 'bangumis',
    multiple: true
  },
  {
    field: 'movieList',
    label: '详情页电影',
    collectionName: 'movies',
    multiple: true
  },
  {
    field: 'gameList',
    label: '详情页游戏',
    collectionName: 'games',
    multiple: true
  },
  {
    field: 'bookList',
    label: '详情页书籍',
    collectionName: 'books',
    multiple: true
  },
  {
    field: 'postList',
    label: '详情页博文',
    collectionName: 'posts',
    multiple: true
  },
  {
    field: 'tweetList',
    label: '详情页推文',
    collectionName: 'posts',
    multiple: true
  },
  {
    field: 'eventList',
    label: '详情页事件',
    collectionName: 'events',
    multiple: true
  },
  {
    field: 'voteList',
    label: '详情页投票',
    collectionName: 'votes',
    multiple: true
  },
  {
    field: 'contentBangumiList',
    label: '正文番剧',
    collectionName: 'bangumis',
    multiple: true
  },
  {
    field: 'contentMovieList',
    label: '正文电影',
    collectionName: 'movies',
    multiple: true
  },
  {
    field: 'contentGameList',
    label: '正文游戏',
    collectionName: 'games',
    multiple: true
  },
  {
    field: 'contentBookList',
    label: '正文书籍',
    collectionName: 'books',
    multiple: true
  },
  {
    field: 'contentPostList',
    label: '正文博文',
    collectionName: 'posts',
    multiple: true
  },
  {
    field: 'contentTweetList',
    label: '正文推文',
    collectionName: 'posts',
    multiple: true
  },
  {
    field: 'contentEventList',
    label: '正文事件',
    collectionName: 'events',
    multiple: true
  },
  {
    field: 'contentVoteList',
    label: '正文投票',
    collectionName: 'votes',
    multiple: true
  }
]

const RECORD_SCAN_CONFIGS = {
  posts: {
    label: '文章',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'excerpt', label: '摘要' },
      { path: 'content', label: '正文' },
      { path: 'code', label: '插入代码' }
    ]
  },
  users: {
    label: '作者',
    fields: [
      { path: 'nickname', label: '昵称' },
      { path: 'description', label: '简介' }
    ]
  },
  sorts: {
    label: '分类',
    fields: [
      { path: 'sortname', label: '分类名' },
      { path: 'description', label: '描述' },
      { path: 'template', label: '模板' }
    ]
  },
  tags: {
    label: '标签',
    fields: [{ path: 'tagname', label: '标签名' }]
  },
  mappoints: {
    label: '地点',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'summary', label: '简介' }
    ]
  },
  bangumis: {
    label: '番剧',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'summary', label: '简评' }
    ],
    urlList: true
  },
  movies: {
    label: '电影',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'summary', label: '简评' }
    ],
    urlList: true
  },
  games: {
    label: '游戏',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'summary', label: '简评' }
    ],
    urlList: true
  },
  books: {
    label: '书籍',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'summary', label: '简评' }
    ],
    urlList: true
  },
  events: {
    label: '事件',
    fields: [
      { path: 'title', label: '标题' },
      { path: 'content', label: '内容' }
    ],
    urlList: true
  },
  votes: {
    label: '投票',
    fields: [{ path: 'title', label: '标题' }],
    voteOptions: true
  },
  gamePlatforms: {
    label: '游戏平台',
    fields: [{ path: 'name', label: '名称' }]
  },
  booktypes: {
    label: '阅读类型',
    fields: [{ path: 'name', label: '名称' }]
  },
  eventtypes: {
    label: '事件类型',
    fields: [{ path: 'name', label: '名称' }]
  }
}

const POST_LIST_FILTER_NAMES = new Set([
  'tag',
  'sort',
  'keyword',
  'bangumi',
  'book',
  'movie',
  'game',
  'mappoint'
])

function getMultilingualModel(collectionName) {
  const repository = global.$mongodDB.multilingual.repositories[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }

  return repository.model
}

function createApiFieldError(message, field) {
  return new ApiError(ERROR_CODES.CONTENT_FIELD_INVALID, message, field, 400)
}

function normalizeRequiredSiteUrl(value, message, field) {
  const siteUrl = normalizeSiteUrl(value)
  if (!siteUrl) {
    throw createApiFieldError(message, field)
  }

  return siteUrl
}

async function resolveSiteUrls(body = {}) {
  const sourceSettings = await getSourceSeoSettings()
  const sourceSiteUrl = normalizeRequiredSiteUrl(
    body.sourceSiteUrl || sourceSettings.siteUrl,
    '源站站点地址未配置，无法判断哪些链接属于源站',
    'sourceSiteUrl'
  )

  let targetSiteUrl = sourceSiteUrl
  if (body.targetSiteUrl) {
    targetSiteUrl = normalizeRequiredSiteUrl(
      body.targetSiteUrl,
      '替换目标站点地址无效，无法生成替换预览',
      'targetSiteUrl'
    )
  }

  return {
    sourceSiteUrl,
    targetSiteUrl,
    sourceBaseUrl: new URL(sourceSiteUrl),
    targetBaseUrl: new URL(targetSiteUrl)
  }
}

function parseTranslationPostInput(body = {}) {
  const id = String(body.id || '').trim()
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_ID_INVALID,
      'translation post id invalid',
      'id',
      400
    )
  }

  const input = {
    id,
    languageCode: ''
  }

  if (body.languageCode) {
    const languageCode = normalizeLanguageCode(body.languageCode)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
        undefined,
        'languageCode',
        400
      )
    }
    input.languageCode = languageCode
  }

  return input
}

function isSameOrigin(leftUrl, rightUrl) {
  return leftUrl.origin.toLowerCase() === rightUrl.origin.toLowerCase()
}

function normalizeBasePath(pathname) {
  const pathValue = String(pathname || '/').replace(/\/+$/, '')
  if (!pathValue) {
    return ''
  }
  if (pathValue === '/') {
    return ''
  }
  return pathValue
}

function removeBasePath(pathname, basePath) {
  if (!basePath) {
    return pathname || '/'
  }

  if (pathname === basePath) {
    return '/'
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length)
  }

  return null
}

function splitRoutePath(pathname) {
  return String(pathname || '/')
    .split('/')
    .filter(segment => {
      return Boolean(segment)
    })
}

function isPositiveIntegerSegment(value) {
  return /^[1-9]\d*$/.test(String(value || ''))
}

function hasPathLikeFileExtension(value) {
  return /\.[A-Za-z0-9]{2,8}$/.test(String(value || ''))
}

function isAllowedListTypeSegment(value) {
  const text = String(value || '').trim()
  if (!text) {
    return false
  }

  if (hasPathLikeFileExtension(text)) {
    return false
  }

  return true
}

function isAllowedPostListRestSegments(restSegments) {
  if (restSegments.length === 0) {
    return true
  }

  if (restSegments.length === 1) {
    return isPositiveIntegerSegment(restSegments[0])
  }

  if (restSegments.length === 2) {
    return (
      isPositiveIntegerSegment(restSegments[0]) &&
      isAllowedListTypeSegment(restSegments[1])
    )
  }

  const filterName = restSegments[0]
  if (filterName === 'archive') {
    if (restSegments.length === 3) {
      return (
        /^\d{4}$/.test(restSegments[1]) && /^\d{1,2}$/.test(restSegments[2])
      )
    }

    if (restSegments.length === 5) {
      return (
        /^\d{4}$/.test(restSegments[1]) &&
        /^\d{1,2}$/.test(restSegments[2]) &&
        isPositiveIntegerSegment(restSegments[3]) &&
        isAllowedListTypeSegment(restSegments[4])
      )
    }

    return false
  }

  if (!POST_LIST_FILTER_NAMES.has(filterName)) {
    return false
  }

  if (restSegments.length === 2) {
    return true
  }

  if (restSegments.length === 4) {
    return (
      isPositiveIntegerSegment(restSegments[2]) &&
      isAllowedListTypeSegment(restSegments[3])
    )
  }

  return false
}

function joinRoutePath(segments) {
  if (segments.length === 0) {
    return ''
  }

  return `/${segments.join('/')}`
}

function resolveSourceRoutePath(routePath, languageCode) {
  const cleanRoutePath = String(routePath || '/').replace(/\/+$/, '')
  if (!cleanRoutePath) {
    return {
      targetPath: `/${languageCode}`,
      routeType: 'list',
      routeLabel: '首页列表'
    }
  }

  if (cleanRoutePath === '/') {
    return {
      targetPath: `/${languageCode}`,
      routeType: 'list',
      routeLabel: '首页列表'
    }
  }

  const segments = splitRoutePath(cleanRoutePath)
  if (segments.length === 2) {
    const routeType = segments[0]
    if (hasPathLikeFileExtension(segments[1])) {
      return null
    }

    if (routeType === 'page') {
      return {
        targetPath: `/${languageCode}/page/${segments[1]}`,
        routeType: 'page',
        routeLabel: '页面'
      }
    }

    if (routeType === 'post' || routeType === 'blog' || routeType === 'tweet') {
      let routeLabel = '文章'
      if (routeType === 'page') {
        routeLabel = '页面'
      }
      if (routeType === 'blog') {
        routeLabel = '博文'
      }
      if (routeType === 'tweet') {
        routeLabel = '推文'
      }
      return {
        targetPath: `/${languageCode}/post/${segments[1]}`,
        routeType,
        routeLabel
      }
    }
  }

  if (segments[0] !== 'post' || segments[1] !== 'list') {
    return null
  }

  const restSegments = segments.slice(2)
  if (!isAllowedPostListRestSegments(restSegments)) {
    return null
  }

  return {
    targetPath: `/${languageCode}/post/list${joinRoutePath(restSegments)}`,
    routeType: 'list',
    routeLabel: '列表'
  }
}

function buildAbsoluteTargetUrl(targetBaseUrl, targetPath, sourceParsedUrl) {
  const targetUrl = new URL(targetBaseUrl.toString())
  const basePath = normalizeBasePath(targetBaseUrl.pathname)
  let nextPath = targetPath
  if (!nextPath.startsWith('/')) {
    nextPath = `/${nextPath}`
  }
  targetUrl.pathname = `${basePath}${nextPath}`
  targetUrl.search = sourceParsedUrl.search
  targetUrl.hash = sourceParsedUrl.hash
  return targetUrl.toString()
}

function resolveSourceUrlReplacement(urlText, context) {
  let parsedUrl = null
  try {
    parsedUrl = new URL(urlText)
  } catch (error) {
    return null
  }

  if (!isSameOrigin(parsedUrl, context.sourceBaseUrl)) {
    return null
  }

  const basePath = normalizeBasePath(context.sourceBaseUrl.pathname)
  const routePath = removeBasePath(parsedUrl.pathname, basePath)
  if (routePath === null) {
    return null
  }

  const route = resolveSourceRoutePath(routePath, context.languageCode)
  if (!route) {
    return null
  }

  return {
    sourceUrl: urlText,
    targetUrl: buildAbsoluteTargetUrl(
      context.targetBaseUrl,
      route.targetPath,
      parsedUrl
    ),
    routeType: route.routeType,
    routeLabel: route.routeLabel
  }
}

function trimUrlTrailingPunctuation(value) {
  const match = String(value || '').match(TRAILING_URL_PUNCTUATION_REGEXP)
  if (!match) {
    return {
      url: value,
      trailingText: ''
    }
  }

  const trailingText = match[0]
  return {
    url: value.slice(0, value.length - trailingText.length),
    trailingText
  }
}

function buildHighlightParts(text, ranges) {
  const parts = []
  const normalizedRanges = []
  for (const range of ranges) {
    if (!range || range.start >= range.end) {
      continue
    }
    normalizedRanges.push(range)
  }

  normalizedRanges.sort((left, right) => {
    return left.start - right.start
  })

  let cursor = 0
  for (const range of normalizedRanges) {
    if (range.start > cursor) {
      parts.push({
        text: text.slice(cursor, range.start),
        highlighted: false
      })
    }

    parts.push({
      text: text.slice(range.start, range.end),
      highlighted: true
    })
    cursor = range.end
  }

  if (cursor < text.length) {
    parts.push({
      text: text.slice(cursor),
      highlighted: false
    })
  }

  if (parts.length === 0) {
    parts.push({
      text,
      highlighted: false
    })
  }

  return parts
}

function buildContextPreviewParts(text, highlightStart, highlightEnd) {
  const contextStart = Math.max(0, highlightStart - PREVIEW_CONTEXT_LENGTH)
  const contextEnd = Math.min(
    text.length,
    highlightEnd + PREVIEW_CONTEXT_LENGTH
  )
  const snippet = text.slice(contextStart, contextEnd)
  const parts = buildHighlightParts(snippet, [
    {
      start: highlightStart - contextStart,
      end: highlightEnd - contextStart
    }
  ])

  if (contextStart > 0) {
    parts.unshift({
      text: '...',
      highlighted: false
    })
  }

  if (contextEnd < text.length) {
    parts.push({
      text: '...',
      highlighted: false
    })
  }

  return {
    value: parts
      .map(part => {
        return part.text
      })
      .join(''),
    parts
  }
}

function buildFieldMatches(value, context) {
  if (typeof value !== 'string' || !value) {
    return []
  }

  const matches = []
  const regexp = new RegExp(SOURCE_URL_REGEXP.source, SOURCE_URL_REGEXP.flags)
  let match = regexp.exec(value)
  while (match) {
    const rawUrl = match[0]
    const trimmed = trimUrlTrailingPunctuation(rawUrl)
    const replacement = resolveSourceUrlReplacement(trimmed.url, context)
    if (replacement) {
      const start = match.index
      const end = start + trimmed.url.length
      matches.push({
        start,
        end,
        sourceUrl: replacement.sourceUrl,
        targetUrl: replacement.targetUrl,
        routeType: replacement.routeType,
        routeLabel: replacement.routeLabel,
        occurrenceIndex: matches.length
      })
    }

    match = regexp.exec(value)
  }

  return matches
}

function buildSingleOccurrenceReplacement(value, matchItem) {
  if (typeof value !== 'string' || !matchItem) {
    return null
  }

  const nextValue =
    value.slice(0, matchItem.start) +
    matchItem.targetUrl +
    value.slice(matchItem.end)
  const nextEnd = matchItem.start + matchItem.targetUrl.length
  const currentPreview = buildContextPreviewParts(
    value,
    matchItem.start,
    matchItem.end
  )
  const nextPreview = buildContextPreviewParts(
    nextValue,
    matchItem.start,
    nextEnd
  )

  return {
    currentValue: currentPreview.value,
    nextValue: nextPreview.value,
    currentParts: currentPreview.parts,
    nextParts: nextPreview.parts
  }
}

function getPlainText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value)
    .replace(/<[^>]*>/g, '')
    .trim()
}

function getRecordDisplayName(collectionName, record) {
  if (!record) {
    return '-'
  }

  if (collectionName === 'posts') {
    const title = getPlainText(record.title)
    if (title) {
      return title
    }
    const excerpt = getPlainText(record.excerpt)
    if (excerpt) {
      return excerpt
    }
    if (record.alias) {
      return record.alias
    }
  }

  if (record.title) {
    return getPlainText(record.title)
  }
  if (record.name) {
    return getPlainText(record.name)
  }
  if (record.nickname) {
    return getPlainText(record.nickname)
  }
  if (record.username) {
    return getPlainText(record.username)
  }
  if (record.sortname) {
    return getPlainText(record.sortname)
  }
  if (record.tagname) {
    return getPlainText(record.tagname)
  }

  return String(record._id || '-')
}

function getFieldValue(record, fieldPath) {
  const segments = fieldPath.split('.')
  let value = record
  for (const segment of segments) {
    if (value === null || typeof value === 'undefined') {
      return undefined
    }
    value = value[segment]
  }
  return value
}

function setFieldValue(target, fieldPath, value) {
  const segments = fieldPath.split('.')
  let cursor = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {}
    }
    cursor = cursor[segment]
  }

  cursor[segments[segments.length - 1]] = value
}

function cloneSerializableValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function getScanGroupKey(scope) {
  if (scope === 'post') {
    return 'post'
  }
  return 'relations'
}

function getScanGroupLabel(scope) {
  if (scope === 'post') {
    return '文章内容'
  }
  return '关联内容'
}

function buildEntryKey(collectionName, recordId, fieldPath, occurrenceIndex) {
  return `${collectionName}:${recordId}:${fieldPath}:${occurrenceIndex}`
}

function buildPreviewEntry({
  recordItem,
  fieldPath,
  fieldLabel,
  value,
  matchItem
}) {
  const collectionName = recordItem.collectionName
  const recordId = String(recordItem.record._id)
  const config = RECORD_SCAN_CONFIGS[collectionName] || {}
  const replacement = buildSingleOccurrenceReplacement(value, matchItem)
  if (!replacement) {
    return null
  }

  return {
    key: buildEntryKey(
      collectionName,
      recordId,
      fieldPath,
      matchItem.occurrenceIndex
    ),
    scope: recordItem.scope,
    collectionName,
    collectionLabel: config.label || collectionName,
    recordId,
    recordLabel: getRecordDisplayName(collectionName, recordItem.record),
    relationLabels: recordItem.relationLabels || [],
    fieldPath,
    fieldLabel,
    occurrenceIndex: matchItem.occurrenceIndex,
    occurrenceLabel: `第 ${matchItem.occurrenceIndex + 1} 个`,
    currentValue: replacement.currentValue,
    nextValue: replacement.nextValue,
    currentParts: replacement.currentParts,
    nextParts: replacement.nextParts,
    sourceUrl: matchItem.sourceUrl,
    targetUrl: matchItem.targetUrl,
    routeType: matchItem.routeType,
    routeLabel: matchItem.routeLabel,
    match: {
      start: matchItem.start,
      end: matchItem.end,
      sourceUrl: matchItem.sourceUrl,
      targetUrl: matchItem.targetUrl,
      occurrenceIndex: matchItem.occurrenceIndex
    },
    matches: [
      {
        sourceUrl: matchItem.sourceUrl,
        targetUrl: matchItem.targetUrl,
        routeType: matchItem.routeType,
        routeLabel: matchItem.routeLabel
      }
    ],
    matchCount: 1
  }
}

function addStringFieldEntry(entries, recordItem, field, context) {
  const value = getFieldValue(recordItem.record, field.path)
  const matches = buildFieldMatches(value, context)
  if (matches.length === 0) {
    return
  }

  matches.forEach(matchItem => {
    const entry = buildPreviewEntry({
      recordItem,
      fieldPath: field.path,
      fieldLabel: field.label,
      value,
      matchItem
    })
    if (entry) {
      entries.push(entry)
    }
  })
}

function addUrlListEntries(entries, recordItem, context) {
  const urlList = Array.isArray(recordItem.record.urlList)
    ? recordItem.record.urlList
    : []
  urlList.forEach((item, index) => {
    const textMatches = buildFieldMatches(item?.text, context)
    textMatches.forEach(matchItem => {
      const entry = buildPreviewEntry({
        recordItem,
        fieldPath: `urlList.${index}.text`,
        fieldLabel: `自定义链接 ${index + 1} 文案`,
        value: item.text,
        matchItem
      })
      if (entry) {
        entries.push(entry)
      }
    })

    const urlMatches = buildFieldMatches(item?.url, context)
    urlMatches.forEach(matchItem => {
      const entry = buildPreviewEntry({
        recordItem,
        fieldPath: `urlList.${index}.url`,
        fieldLabel: `自定义链接 ${index + 1} URL`,
        value: item.url,
        matchItem
      })
      if (entry) {
        entries.push(entry)
      }
    })
  })
}

function addVoteOptionEntries(entries, recordItem, context) {
  const options = Array.isArray(recordItem.record.options)
    ? recordItem.record.options
    : []
  options.forEach((item, index) => {
    const matches = buildFieldMatches(item?.title, context)
    matches.forEach(matchItem => {
      const entry = buildPreviewEntry({
        recordItem,
        fieldPath: `options.${index}.title`,
        fieldLabel: `投票选项 ${index + 1}`,
        value: item.title,
        matchItem
      })
      if (entry) {
        entries.push(entry)
      }
    })
  })
}

function scanRecordItem(recordItem, context) {
  const config = RECORD_SCAN_CONFIGS[recordItem.collectionName]
  if (!config) {
    return []
  }

  const entries = []
  for (const field of config.fields || []) {
    addStringFieldEntry(entries, recordItem, field, context)
  }

  if (config.urlList) {
    addUrlListEntries(entries, recordItem, context)
  }

  if (config.voteOptions) {
    addVoteOptionEntries(entries, recordItem, context)
  }

  return entries
}

function getRelationIdList(post, fieldConfig) {
  const value = post[fieldConfig.field]
  if (fieldConfig.multiple) {
    if (!Array.isArray(value)) {
      return []
    }
    return value
      .map(item => {
        return String(item?._id || item || '').trim()
      })
      .filter(id => {
        return mongoose.Types.ObjectId.isValid(id)
      })
  }

  const id = String(value?._id || value || '').trim()
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return []
  }

  return [id]
}

function addRecordReference(recordReferenceMap, collectionName, id, label) {
  const key = `${collectionName}:${id}`
  if (!recordReferenceMap.has(key)) {
    recordReferenceMap.set(key, {
      collectionName,
      id,
      labels: []
    })
  }

  const reference = recordReferenceMap.get(key)
  if (label && !reference.labels.includes(label)) {
    reference.labels.push(label)
  }
}

async function collectRelatedRecordItems(post) {
  const referenceMap = new Map()
  for (const fieldConfig of POST_RELATION_FIELD_CONFIGS) {
    const idList = getRelationIdList(post, fieldConfig)
    for (const id of idList) {
      addRecordReference(
        referenceMap,
        fieldConfig.collectionName,
        id,
        fieldConfig.label
      )
    }
  }

  const referencesByCollection = {}
  for (const reference of referenceMap.values()) {
    if (reference.collectionName === 'attachments') {
      continue
    }
    if (
      reference.collectionName === POST_COLLECTION_NAME &&
      reference.id === String(post._id)
    ) {
      continue
    }
    if (!referencesByCollection[reference.collectionName]) {
      referencesByCollection[reference.collectionName] = []
    }
    referencesByCollection[reference.collectionName].push(reference)
  }

  const recordItems = []
  const collectionNames = Object.keys(referencesByCollection)
  for (const collectionName of collectionNames) {
    const references = referencesByCollection[collectionName]
    const Model = getMultilingualModel(collectionName)
    const idList = references.map(item => {
      return new mongoose.Types.ObjectId(item.id)
    })
    const recordList = await Model.find({
      _id: { $in: idList },
      languageCode: post.languageCode,
      recordKind: TRANSLATION_RECORD_KIND
    }).lean()
    const recordMap = new Map()
    recordList.forEach(record => {
      recordMap.set(String(record._id), record)
    })

    for (const reference of references) {
      const record = recordMap.get(reference.id)
      if (!record) {
        continue
      }
      recordItems.push({
        scope: 'relation',
        collectionName,
        record,
        relationLabels: reference.labels
      })
    }
  }

  return recordItems
}

async function loadTranslationPost(input) {
  const PostModel = getMultilingualModel(POST_COLLECTION_NAME)
  const post = await PostModel.findOne({
    _id: new mongoose.Types.ObjectId(input.id),
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!post) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation post not found',
      'id',
      404
    )
  }

  if (input.languageCode && input.languageCode !== post.languageCode) {
    throw new ApiError(
      ERROR_CODES.RELATION_LANGUAGE_MISMATCH,
      undefined,
      'languageCode',
      409
    )
  }

  return post
}

function groupPreviewEntries(entries) {
  const groupMap = new Map()
  for (const entry of entries) {
    const groupKey = getScanGroupKey(entry.scope)
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        label: getScanGroupLabel(entry.scope),
        entries: []
      })
    }

    groupMap.get(groupKey).entries.push(entry)
  }

  return Array.from(groupMap.values())
}

function getPreviewEntryList(preview) {
  return preview.groups.flatMap(group => {
    return group.entries
  })
}

async function buildTranslationPostSourceLinkPreview(body = {}) {
  const input = parseTranslationPostInput(body)
  const post = await loadTranslationPost(input)
  const siteUrls = await resolveSiteUrls(body)
  const context = {
    ...siteUrls,
    languageCode: post.languageCode
  }

  const recordItems = [
    {
      scope: 'post',
      collectionName: POST_COLLECTION_NAME,
      record: post,
      relationLabels: ['当前文章']
    }
  ]
  const relatedRecordItems = await collectRelatedRecordItems(post)
  relatedRecordItems.forEach(item => {
    recordItems.push(item)
  })

  const entries = []
  for (const recordItem of recordItems) {
    const recordEntries = scanRecordItem(recordItem, context)
    recordEntries.forEach(entry => {
      entries.push(entry)
    })
  }

  const defaultSelectedKeys = entries.map(entry => {
    return entry.key
  })

  return {
    postId: String(post._id),
    languageCode: post.languageCode,
    sourceSiteUrl: siteUrls.sourceSiteUrl,
    targetSiteUrl: siteUrls.targetSiteUrl,
    groups: groupPreviewEntries(entries),
    defaultSelectedKeys,
    totalFieldCount: entries.length,
    totalMatchCount: entries.reduce((total, entry) => {
      return total + entry.matchCount
    }, 0)
  }
}

function normalizeSelectedKeys(value) {
  if (!Array.isArray(value)) {
    throw createApiFieldError('请选择要替换的源站链接', 'selectedKeys')
  }

  const selectedKeys = []
  for (const item of value) {
    const key = String(item || '').trim()
    if (!key) {
      continue
    }
    if (!selectedKeys.includes(key)) {
      selectedKeys.push(key)
    }
  }

  if (selectedKeys.length === 0) {
    throw createApiFieldError('请选择至少一条源站链接', 'selectedKeys')
  }

  return selectedKeys
}

function buildSelectedFieldNextValue(value, entries) {
  if (typeof value !== 'string') {
    throw createApiFieldError('源站链接内容已变化', 'selectedKeys')
  }

  const sortedEntries = entries.slice().sort((left, right) => {
    return left.match.start - right.match.start
  })
  let nextValue = ''
  let cursor = 0

  for (const entry of sortedEntries) {
    const match = entry.match || {}
    if (
      !Number.isInteger(match.start) ||
      !Number.isInteger(match.end) ||
      match.start < cursor ||
      match.end > value.length ||
      match.start >= match.end
    ) {
      throw createApiFieldError(
        '源站链接命中项已变化，请重新预览',
        'selectedKeys'
      )
    }

    const currentUrl = value.slice(match.start, match.end)
    if (currentUrl !== match.sourceUrl) {
      throw createApiFieldError(
        '源站链接命中项已变化，请重新预览',
        'selectedKeys'
      )
    }

    nextValue += value.slice(cursor, match.start)
    nextValue += match.targetUrl
    cursor = match.end
  }

  nextValue += value.slice(cursor)
  return nextValue
}

function addEntryToUpdateMap(updateMap, entry) {
  const recordKey = `${entry.collectionName}:${entry.recordId}`
  if (!updateMap.has(recordKey)) {
    updateMap.set(recordKey, {
      collectionName: entry.collectionName,
      recordId: entry.recordId,
      fieldEntries: new Map(),
      fieldPaths: []
    })
  }

  const updateItem = updateMap.get(recordKey)
  if (!updateItem.fieldEntries.has(entry.fieldPath)) {
    updateItem.fieldEntries.set(entry.fieldPath, [])
  }
  updateItem.fieldEntries.get(entry.fieldPath).push(entry)
  if (!updateItem.fieldPaths.includes(entry.fieldPath)) {
    updateItem.fieldPaths.push(entry.fieldPath)
  }
}

async function buildRecordUpdateData(collectionName, recordId, fieldEntries) {
  const Model = getMultilingualModel(collectionName)
  const record = await Model.findOne({
    _id: new mongoose.Types.ObjectId(recordId),
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      'translation record not found',
      'recordId',
      404
    )
  }

  const values = {}
  for (const [fieldPath, entries] of fieldEntries) {
    const currentValue = getFieldValue(record, fieldPath)
    const nextValue = buildSelectedFieldNextValue(currentValue, entries)
    setFieldValue(values, fieldPath, nextValue)
  }

  const updateData = {}
  for (const fieldName of Object.keys(values)) {
    if (fieldName === 'urlList') {
      const urlList = Array.isArray(record.urlList)
        ? cloneSerializableValue(record.urlList)
        : []
      const patches = values.urlList || {}
      for (const indexText of Object.keys(patches)) {
        const index = Number(indexText)
        if (!Number.isInteger(index) || index < 0 || !urlList[index]) {
          throw createApiFieldError('自定义链接位置无效', 'urlList')
        }
        Object.assign(urlList[index], patches[indexText])
      }
      updateData.urlList = urlList
      continue
    }

    if (fieldName === 'options') {
      const options = Array.isArray(record.options)
        ? cloneSerializableValue(record.options)
        : []
      const patches = values.options || {}
      for (const indexText of Object.keys(patches)) {
        const index = Number(indexText)
        if (!Number.isInteger(index) || index < 0 || !options[index]) {
          throw createApiFieldError('投票选项位置无效', 'options')
        }
        Object.assign(options[index], patches[indexText])
      }
      updateData.options = options
      continue
    }

    updateData[fieldName] = values[fieldName]
  }

  if (collectionName === POST_COLLECTION_NAME) {
    updateData.lastChangDate = new Date()
  }

  return updateData
}

async function applyRecordUpdates(updateMap) {
  const updatedRecords = []
  for (const updateItem of updateMap.values()) {
    const updateData = await buildRecordUpdateData(
      updateItem.collectionName,
      updateItem.recordId,
      updateItem.fieldEntries
    )
    if (Object.keys(updateData).length === 0) {
      continue
    }

    const Model = getMultilingualModel(updateItem.collectionName)
    await Model.updateOne(
      {
        _id: new mongoose.Types.ObjectId(updateItem.recordId),
        recordKind: TRANSLATION_RECORD_KIND
      },
      { $set: updateData }
    )

    updatedRecords.push({
      collectionName: updateItem.collectionName,
      recordId: updateItem.recordId,
      fields: updateItem.fieldPaths
    })
  }

  return updatedRecords
}

async function applyTranslationPostSourceLinkReplacement(body = {}) {
  const preview = await buildTranslationPostSourceLinkPreview(body)
  const selectedKeys = normalizeSelectedKeys(body.selectedKeys || body.fields)
  const entryMap = new Map()
  getPreviewEntryList(preview).forEach(entry => {
    entryMap.set(entry.key, entry)
  })

  const updateMap = new Map()
  for (const key of selectedKeys) {
    const entry = entryMap.get(key)
    if (!entry) {
      throw createApiFieldError(
        `源站链接条目不存在或已变化：${key}`,
        'selectedKeys'
      )
    }
    addEntryToUpdateMap(updateMap, entry)
  }

  const updatedRecords = await applyRecordUpdates(updateMap)
  if (updatedRecords.length > 0) {
    await contentRefreshUtils.refreshArticlePublishing(preview.languageCode)
  }

  const translationPostService = require('./translationPostService')
  const detail = await translationPostService.getTranslationPostDetail(
    preview.postId
  )

  return {
    post: detail.post,
    detail,
    updatedRecords,
    updatedFieldCount: selectedKeys.length,
    updatedRecordCount: updatedRecords.length,
    languageCode: preview.languageCode
  }
}

module.exports = {
  buildTranslationPostSourceLinkPreview,
  applyTranslationPostSourceLinkReplacement
}
