import {
  buildSourceToTargetTranslationEntries,
  buildTranslationExportEntries
} from '@/utils/translationJson'
import { normalizeTagRecord } from '@/utils/tagName'

export const AUTHOR_RELATION_FIELD = {
  label: '作者',
  field: 'author',
  collectionName: 'users',
  multiple: false
}

export const BASE_RELATION_FIELDS = [
  { label: '分类', field: 'sort', collectionName: 'sorts', multiple: false },
  { label: '标签', field: 'tags', collectionName: 'tags', multiple: true },
  {
    label: '地点',
    field: 'mappointList',
    collectionName: 'mappoints',
    multiple: true
  },
  {
    label: '媒体内容',
    field: 'coverImages',
    collectionName: 'attachments',
    multiple: true
  }
]

export const TWEET_CONTENT_RELATION_FIELDS = [
  {
    label: '关联活动',
    field: 'contentEventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联投票',
    field: 'contentVoteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联博文',
    field: 'contentPostList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'tweetContent'
  },
  {
    label: '关联推文',
    field: 'contentTweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'tweetContent'
  },
  {
    label: '关联番剧',
    field: 'contentBangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联电影',
    field: 'contentMovieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联书籍',
    field: 'contentBookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联游戏',
    field: 'contentGameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'tweetContent'
  }
]

export const DETAIL_RELATION_FIELDS = [
  {
    label: '相关活动',
    field: 'eventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关投票',
    field: 'voteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关博文',
    field: 'postList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'detail'
  },
  {
    label: '相关推文',
    field: 'tweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'detail'
  },
  {
    label: '相关番剧',
    field: 'bangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关电影',
    field: 'movieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关书籍',
    field: 'bookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关游戏',
    field: 'gameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'detail'
  }
]

export const ALL_POST_RELATION_FIELDS = [
  AUTHOR_RELATION_FIELD,
  ...BASE_RELATION_FIELDS,
  ...TWEET_CONTENT_RELATION_FIELDS,
  ...DETAIL_RELATION_FIELDS
]

const POST_SUBMIT_FIELDS = [
  'title',
  'date',
  'content',
  'excerpt',
  'alias',
  'type',
  'top',
  'sortop',
  'status',
  'allowRemark',
  'template',
  'code',
  'author',
  'sort',
  'tags',
  'mappointList',
  'coverImages',
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList'
]

const SOURCE_IDENTITY_RELATION_FIELDS = [
  'author',
  'sort',
  'tags',
  'mappointList',
  'coverImages',
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList',
  'parent',
  'gamePlatform',
  'booktype',
  'eventtype'
]

function getRecordId(record) {
  if (!record) {
    return null
  }
  if (typeof record === 'object') {
    return record._id || null
  }
  return record
}

function getRecordIdList(records) {
  if (!Array.isArray(records)) {
    return []
  }
  return records.map(getRecordId).filter(Boolean)
}

function cloneValue(value) {
  if (value === null || typeof value === 'undefined') {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function normalizeEntryIdentityValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function getEntryDeduplicationFieldKey(entry = {}) {
  const fieldName = normalizeEntryIdentityValue(entry.fieldName)
  if (!fieldName) {
    return ''
  }
  if (entry.collectionName === 'votes' && fieldName === 'options.title') {
    const optionIndex = Number(entry.optionIndex)
    if (!Number.isInteger(optionIndex)) {
      return ''
    }
    return `${fieldName}.${optionIndex}`
  }
  return fieldName
}

export function buildTranslationEntryDeduplicationKey(
  entry = {},
  context = {}
) {
  const fieldKey = getEntryDeduplicationFieldKey(entry)
  if (!fieldKey) {
    return ''
  }

  if (entry.scope === 'post') {
    const sourcePostId = normalizeEntryIdentityValue(context.sourcePostId)
    if (!sourcePostId) {
      return ''
    }
    return ['posts', sourcePostId, fieldKey].join(':')
  }

  if (entry.scope !== 'relation' && entry.scope !== 'parentRelation') {
    return ''
  }

  const collectionName = normalizeEntryIdentityValue(entry.collectionName)
  const sourceId = normalizeEntryIdentityValue(entry.sourceId)
  if (!collectionName || !sourceId) {
    return ''
  }

  return [collectionName, sourceId, fieldKey].join(':')
}

function normalizePreviewRecord(value, context, seen = new Map()) {
  if (!value || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizePreviewRecord(item, context, seen))
  }

  const id = value._id ? String(value._id) : ''
  const seenKey = id || JSON.stringify(Object.keys(value).sort())
  if (id && seen.has(seenKey)) {
    return seen.get(seenKey)
  }

  const record = cloneValue(value)
  if (id) {
    record.sourceId = record.sourceId || id
  }
  record.languageCode = context.languageCode
  record.sourceLanguageCode = context.sourceLanguageCode
  record.sourceSnapshotId = context.sourceSnapshotId
  record.translationGroupId = context.translationGroupId
  record.snapshotVersion = context.snapshotVersion
  if (id) {
    seen.set(seenKey, record)
  }

  SOURCE_IDENTITY_RELATION_FIELDS.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(record, fieldName)) {
      record[fieldName] = normalizePreviewRecord(
        record[fieldName],
        context,
        seen
      )
    }
  })

  return record
}

export function buildPreviewPostFromSource({
  sourcePost,
  sourceLanguageCode,
  languageCode,
  previewId,
  snapshotVersion = 1
}) {
  const sourceId = String(sourcePost?.sourceId || sourcePost?._id || '')
  const sourceSnapshotId = previewId || `preview-source-${sourceId}`
  const context = {
    languageCode,
    sourceLanguageCode,
    sourceSnapshotId,
    translationGroupId: sourceSnapshotId,
    snapshotVersion
  }
  const post = normalizePreviewRecord(sourcePost, context)
  post.id = previewId || `preview-post-${languageCode}-${sourceId}`
  post._id = post.id
  post.sourceId = sourceId
  post.languageCode = languageCode
  post.sourceLanguageCode = sourceLanguageCode
  post.sourceSnapshotId = sourceSnapshotId
  post.translationGroupId = sourceSnapshotId
  post.snapshotVersion = snapshotVersion
  return post
}

export function createPostRelationRecords() {
  const records = {}
  ALL_POST_RELATION_FIELDS.forEach(field => {
    records[field.field] = []
  })
  return records
}

export function buildRelationRecordsFromPost(post = {}) {
  const records = createPostRelationRecords()
  records.author = post.author ? [post.author] : []
  records.sort = post.sort ? [post.sort] : []
  ALL_POST_RELATION_FIELDS.forEach(field => {
    if (field.field === 'author' || field.field === 'sort') {
      return
    }
    const recordList = Array.isArray(post[field.field]) ? post[field.field] : []
    records[field.field] =
      field.field === 'tags' ? recordList.map(normalizeTagRecord) : recordList
  })
  return records
}

export function buildPostTranslationEntries(post = {}, options = {}) {
  const form = {
    ...post,
    id: post._id,
    languageCode: post.languageCode || post.sourceLanguageCode,
    sourceLanguageCode: post.sourceLanguageCode
  }
  return buildTranslationExportEntries({
    form,
    relationFields: ALL_POST_RELATION_FIELDS,
    relationRecords: buildRelationRecordsFromPost(post),
    includeEmpty: Boolean(options.includeEmpty)
  })
}

export function attachTranslationEntryPreviewRows(
  entries,
  currentEntries,
  sourceEntries
) {
  const currentEntryMap = new Map(
    currentEntries.map(entry => [entry.id, entry])
  )
  const sourceEntryMap = new Map(sourceEntries.map(entry => [entry.id, entry]))

  return entries.map(entry => {
    const currentEntry = currentEntryMap.get(entry.id)
    const sourceEntry = sourceEntryMap.get(entry.id)
    return {
      ...entry,
      currentPreviewText:
        currentEntry?.previewText || entry.currentPreviewText || '',
      currentPreviewRawValue:
        currentEntry?.previewRawValue || entry.currentPreviewRawValue || '',
      sourcePreviewText:
        sourceEntry?.previewText || entry.sourcePreviewText || '',
      sourcePreviewRawValue:
        sourceEntry?.previewRawValue || entry.sourcePreviewRawValue || ''
    }
  })
}

export function buildSourceMappedTranslationEntries(sourcePost, targetPost) {
  const sourceEntries = buildPostTranslationEntries(sourcePost)
  const currentEntries = buildPostTranslationEntries(targetPost)
  const targetEntries = buildPostTranslationEntries(targetPost, {
    includeEmpty: true
  })
  const mappedResult = buildSourceToTargetTranslationEntries({
    sourceEntries,
    targetEntries
  })
  return {
    ...mappedResult,
    sourceEntries,
    currentEntries,
    targetEntries,
    entries: attachTranslationEntryPreviewRows(
      mappedResult.entries,
      currentEntries,
      sourceEntries
    )
  }
}

export function buildTranslationPostForm(post = {}) {
  return {
    id: post._id,
    languageCode: post.languageCode,
    sourceLanguageCode: post.sourceLanguageCode,
    sourceSnapshotId: post.sourceSnapshotId || '',
    snapshotVersion: post.snapshotVersion,
    type: Number(post.type || 1)
  }
}

export function buildTranslationPostSubmitData({
  post,
  postPatch = {},
  publish = false
}) {
  const submitData = {
    id: post._id,
    languageCode: post.languageCode,
    confirmReview: true
  }

  POST_SUBMIT_FIELDS.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(post, fieldName)) {
      submitData[fieldName] = post[fieldName]
    }
  })

  submitData.author = getRecordId(post.author)
  submitData.sort = getRecordId(post.sort)
  ALL_POST_RELATION_FIELDS.forEach(field => {
    if (!field.multiple || field.field === 'author' || field.field === 'sort') {
      return
    }
    submitData[field.field] = getRecordIdList(post[field.field])
  })

  if (
    Object.prototype.hasOwnProperty.call(post, 'editorVersion') &&
    post.editorVersion !== null &&
    typeof post.editorVersion !== 'undefined'
  ) {
    submitData.editorVersion = Number(post.editorVersion || 5)
  }

  Object.assign(submitData, postPatch)

  if (publish) {
    submitData.status = 1
  }

  return submitData
}
