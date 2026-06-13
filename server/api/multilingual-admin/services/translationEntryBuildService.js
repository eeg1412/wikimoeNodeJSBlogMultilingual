const mongoose = require('mongoose')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_TYPES
} = require('../../../utils/translationJobConstants')
const importPostSourceService = require('./importPostSourceService')
const translationPostService = require('./translationPostService')
const {
  STRUCTURED_RICH_TEXT_VALUE_TYPE,
  getRichTextDocumentPreviewText,
  renderRichTextDocumentNode,
  serializeRichTextHtmlToDocument
} = require('../utils/richTextDocumentUtils')

const TRANSLATION_RECORD_KIND = 'translation'
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const URL_LIST_TEXT_FIELD_NAME = 'urlList.text'
const DETAIL_RELATION_FIELD_SET = new Set([
  'eventList',
  'voteList',
  'postList',
  'tweetList',
  'bangumiList',
  'movieList',
  'bookList',
  'gameList'
])

const POST_TRANSLATION_FIELDS = [
  {
    name: 'title',
    label: '标题',
    valueType: 'plainText',
    supportedTypes: [1, 3]
  },
  {
    name: 'content',
    label: '文章内容',
    valueType: STRUCTURED_RICH_TEXT_VALUE_TYPE,
    supportedTypes: [1, 3]
  },
  {
    name: 'excerpt',
    label: '摘要',
    valueType: 'plainText',
    supportedTypes: [1, 2, 3]
  },
  {
    name: 'code',
    label: '插入 code',
    valueType: 'plainText',
    supportedTypes: [1, 3],
    optional: true
  }
]

const POST_RELATION_FIELDS = [
  { label: '作者', field: 'author', collectionName: 'users' },
  { label: '分类', field: 'sort', collectionName: 'sorts' },
  { label: '标签', field: 'tags', collectionName: 'tags' },
  { label: '地点', field: 'mappointList', collectionName: 'mappoints' },
  { label: '媒体内容', field: 'coverImages', collectionName: 'attachments' },
  { label: '关联活动', field: 'contentEventList', collectionName: 'events' },
  { label: '关联投票', field: 'contentVoteList', collectionName: 'votes' },
  {
    label: '关联博文',
    field: 'contentPostList',
    collectionName: 'posts',
    postType: 1
  },
  {
    label: '关联推文',
    field: 'contentTweetList',
    collectionName: 'posts',
    postType: 2
  },
  {
    label: '关联番剧',
    field: 'contentBangumiList',
    collectionName: 'bangumis'
  },
  { label: '关联电影', field: 'contentMovieList', collectionName: 'movies' },
  { label: '关联书籍', field: 'contentBookList', collectionName: 'books' },
  { label: '关联游戏', field: 'contentGameList', collectionName: 'games' },
  { label: '相关活动', field: 'eventList', collectionName: 'events' },
  { label: '相关投票', field: 'voteList', collectionName: 'votes' },
  {
    label: '相关博文',
    field: 'postList',
    collectionName: 'posts',
    postType: 1
  },
  {
    label: '相关推文',
    field: 'tweetList',
    collectionName: 'posts',
    postType: 2
  },
  { label: '相关番剧', field: 'bangumiList', collectionName: 'bangumis' },
  { label: '相关电影', field: 'movieList', collectionName: 'movies' },
  { label: '相关书籍', field: 'bookList', collectionName: 'books' },
  { label: '相关游戏', field: 'gameList', collectionName: 'games' }
]

const RELATION_TRANSLATION_FIELDS = {
  users: [
    { name: 'nickname', label: '昵称' },
    { name: 'description', label: '说明' }
  ],
  sorts: [
    { name: 'sortname', label: '分类名' },
    { name: 'description', label: '说明' }
  ],
  tags: [{ name: 'tagname', label: '标签名' }],
  mappoints: [
    { name: 'title', label: '地点标题' },
    { name: 'summary', label: '摘要' }
  ],
  bangumis: [
    { name: 'title', label: '番剧标题' },
    { name: 'summary', label: '简介' },
    { name: 'urlList', label: '自定义链接', type: 'urlList' },
    { name: 'label', label: '标签' }
  ],
  movies: [
    { name: 'title', label: '电影标题' },
    { name: 'summary', label: '简介' },
    { name: 'urlList', label: '自定义链接', type: 'urlList' },
    { name: 'label', label: '标签' }
  ],
  games: [
    { name: 'title', label: '游戏标题' },
    { name: 'summary', label: '简介' },
    { name: 'urlList', label: '自定义链接', type: 'urlList' },
    { name: 'label', label: '标签' }
  ],
  gamePlatforms: [{ name: 'name', label: '平台名' }],
  books: [
    { name: 'title', label: '书籍标题' },
    { name: 'summary', label: '简介' },
    { name: 'urlList', label: '自定义链接', type: 'urlList' },
    { name: 'label', label: '标签' }
  ],
  booktypes: [{ name: 'name', label: '类型名' }],
  events: [
    { name: 'title', label: '活动标题' },
    { name: 'content', label: '内容', type: 'richText' },
    { name: 'urlList', label: '自定义链接', type: 'urlList' }
  ],
  eventtypes: [{ name: 'name', label: '类型名' }],
  posts: [
    { name: 'title', label: '标题' },
    { name: 'excerpt', label: '摘要/推文' }
  ],
  votes: [
    { name: 'options', label: '选项', type: 'voteOptions' },
    { name: 'title', label: '投票标题' }
  ],
  attachments: [
    { name: 'name', label: '媒体名称' },
    { name: 'description', label: '描述' }
  ]
}

const PARENT_RELATION_FIELDS = {
  sorts: [
    {
      name: 'parent',
      label: '父级分类',
      relationCollectionName: 'sorts',
      parentEditableFieldNames: ['sortname', 'description']
    }
  ],
  games: [
    {
      name: 'gamePlatform',
      label: '所属平台',
      relationCollectionName: 'gamePlatforms',
      parentEditableFieldNames: ['name', 'color']
    }
  ],
  books: [
    {
      name: 'booktype',
      label: '所属类型',
      relationCollectionName: 'booktypes',
      parentEditableFieldNames: ['name', 'color']
    }
  ],
  events: [
    {
      name: 'eventtype',
      label: '活动类型',
      relationCollectionName: 'eventtypes',
      parentEditableFieldNames: ['name', 'color']
    }
  ]
}

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).replace(/\r\n?/g, '\n').trim()
}

function cloneSerializableValue(value) {
  if (typeof value === 'undefined') {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

function buildPreviewHtml(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return renderRichTextDocumentNode(value)
  }
  if (valueType !== LEGACY_RICH_TEXT_VALUE_TYPE) {
    return ''
  }
  return normalizeString(value)
}

function normalizeEntryValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return serializeRichTextHtmlToDocument(value).document
  }
  return normalizeString(value)
}

function hasMeaningfulEntryValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    const previewText = getRichTextDocumentPreviewText(value)
    if (previewText) {
      return true
    }
    return Array.isArray(value?.children) && value.children.length > 0
  }
  return hasMeaningfulValue(value)
}

function buildPreviewText(value, valueType) {
  let previewText = ''
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    previewText = getRichTextDocumentPreviewText(value)
  } else {
    previewText = normalizeString(value)
  }

  if (previewText.length > 120) {
    return `${previewText.slice(0, 120)}...`
  }
  return previewText
}

function buildPreviewRawValue(value, valueType) {
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return JSON.stringify(value, null, 2)
  }
  return value
}

function getRepositoryModel(collectionName) {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.[collectionName]
  if (!repository || !repository.model) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      `repository is not ready: ${collectionName}`,
      'collectionName',
      503
    )
  }
  return repository.model
}

function toObjectId(value, field, required = false) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }
  if (value && typeof value.toHexString === 'function') {
    return new mongoose.Types.ObjectId(value.toHexString())
  }
  const text = normalizeString(value)
  if (!text) {
    if (required) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        `${field} 不能为空`,
        field,
        400
      )
    }
    return null
  }
  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ID_INVALID,
      `${field} 格式错误`,
      field,
      400
    )
  }
  return new mongoose.Types.ObjectId(text)
}

function hasMeaningfulValue(value) {
  return normalizeString(value) !== ''
}

function buildDisplayName(record = {}, collectionName = '') {
  const fieldList = [
    'title',
    'nickname',
    'sortname',
    'tagname',
    'name',
    'label',
    'alias',
    'email'
  ]
  for (const fieldName of fieldList) {
    const value = normalizeString(record[fieldName])
    if (value) {
      return value
    }
  }
  return `${collectionName || '内容'}:${normalizeString(record._id)}`
}

function normalizeSourceIdentity(record = {}) {
  return normalizeString(record.sourceId || record._id)
}

function buildEntry(baseData, includeEmpty) {
  const value = normalizeEntryValue(baseData.value, baseData.valueType)
  if (!includeEmpty && !hasMeaningfulEntryValue(value, baseData.valueType)) {
    return null
  }

  return {
    ...baseData,
    value,
    previewText: buildPreviewText(value, baseData.valueType),
    previewRawValue: buildPreviewRawValue(value, baseData.valueType),
    previewHtml: buildPreviewHtml(value, baseData.valueType)
  }
}

function createPostEntries(post, includeEmpty) {
  const postType = Number(post.type || 0)
  const entries = []
  POST_TRANSLATION_FIELDS.forEach(fieldConfig => {
    if (!fieldConfig.supportedTypes.includes(postType)) {
      return
    }
    let label = fieldConfig.label
    if (fieldConfig.name === 'excerpt' && postType === 2) {
      label = '推文正文'
    }
    const entry = buildEntry(
      {
        id: `post.${fieldConfig.name}`,
        scope: 'post',
        fieldName: fieldConfig.name,
        fieldLabel: label,
        label,
        groupLabel: '文章正文',
        groupCategory: '文章字段',
        groupTitle: '文章正文',
        valueType: fieldConfig.valueType,
        value: post[fieldConfig.name],
        aiTranslationSkip: post.aiTranslationSkip === true,
        optional: Boolean(fieldConfig.optional)
      },
      includeEmpty
    )
    if (entry) {
      entries.push(entry)
    }
  })
  return entries
}

function getPostRelationRecords(detail, post, relationField) {
  const directValue = post?.[relationField.field]
  if (Array.isArray(directValue)) {
    return directValue.filter(Boolean)
  }
  if (directValue && typeof directValue === 'object') {
    return [directValue]
  }

  const topLevelValue = detail?.[relationField.field]
  if (Array.isArray(topLevelValue)) {
    return topLevelValue.filter(Boolean)
  }
  if (topLevelValue && typeof topLevelValue === 'object') {
    return [topLevelValue]
  }

  const groupList = [detail?.recommendRelations, detail?.contentRelations]
  for (const group of groupList) {
    const value = group?.[relationField.field]
    if (Array.isArray(value)) {
      return value.filter(Boolean)
    }
    if (value && typeof value === 'object') {
      return [value]
    }
  }

  return []
}

function getRelationScopeMeta(relationField = {}) {
  if (relationField.relationScope === 'tweetContent') {
    return {
      relationScope: 'tweetContent',
      relationScopeLabel: '推文内',
      groupCategory: '推文内关联内容',
      groupLabel: `推文内关联内容 / ${relationField.label}`
    }
  }

  if (relationField.relationScope === 'detail') {
    return {
      relationScope: 'detail',
      relationScopeLabel: '详情页',
      groupCategory: '详情页相关内容',
      groupLabel: `详情页相关内容 / ${relationField.label}`
    }
  }

  if (String(relationField.field || '').startsWith('content')) {
    return {
      relationScope: 'tweetContent',
      relationScopeLabel: '推文内',
      groupCategory: '推文内关联内容',
      groupLabel: `推文内关联内容 / ${relationField.label}`
    }
  }

  if (DETAIL_RELATION_FIELD_SET.has(relationField.field)) {
    return {
      relationScope: 'detail',
      relationScopeLabel: '详情页',
      groupCategory: '详情页相关内容',
      groupLabel: `详情页相关内容 / ${relationField.label}`
    }
  }

  return {
    relationScope: 'base',
    relationScopeLabel: '',
    groupCategory: '关联内容',
    groupLabel: `关联内容 / ${relationField.label}`
  }
}

function createVoteOptionEntries(
  relationField,
  record,
  editField,
  includeEmpty
) {
  const options = Array.isArray(record.options) ? record.options : []
  const recordLabel = buildDisplayName(record, relationField.collectionName)
  const relationScopeMeta = getRelationScopeMeta(relationField)
  return options
    .map((option, index) => {
      return buildEntry(
        {
          id: `relation.${relationField.field}.${record._id}.options.${option._id || index}.title`,
          scope: 'relation',
          relationField: relationField.field,
          collectionName: relationField.collectionName,
          recordId: normalizeString(record._id),
          recordKind: record.recordKind,
          sourceRecordId: normalizeString(record._id),
          sourceId: normalizeSourceIdentity(record),
          sourceSnapshotId: normalizeString(record.sourceSnapshotId),
          relationScope: relationScopeMeta.relationScope,
          relationScopeLabel: relationScopeMeta.relationScopeLabel,
          relationTypeLabel: relationField.label,
          recordLabel,
          fieldName: 'options.title',
          fieldLabel: `${editField.label} #${index + 1}`,
          optionId: normalizeString(option._id),
          optionIndex: index,
          optionList: cloneSerializableValue(options),
          label: `${recordLabel} / ${editField.label} #${index + 1}`,
          groupLabel: relationScopeMeta.groupLabel,
          groupCategory: relationScopeMeta.groupCategory,
          groupTitle: relationField.label,
          valueType: 'plainText',
          value: option.title,
          aiTranslationSkip: record.aiTranslationSkip === true
        },
        includeEmpty
      )
    })
    .filter(Boolean)
}

function normalizeUrlListValue(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map(item => ({
    text: item?.text || '',
    url: item?.url || ''
  }))
}

function createUrlListEntries(relationField, record, editField, includeEmpty) {
  const urlList = normalizeUrlListValue(record[editField.name])
  const recordLabel = buildDisplayName(record, relationField.collectionName)
  const relationScopeMeta = getRelationScopeMeta(relationField)
  return urlList
    .map((item, index) => {
      return buildEntry(
        {
          id: `relation.${relationField.field}.${record._id}.urlList.${index}.text`,
          scope: 'relation',
          relationField: relationField.field,
          collectionName: relationField.collectionName,
          recordId: normalizeString(record._id),
          recordKind: record.recordKind,
          sourceRecordId: normalizeString(record._id),
          sourceId: normalizeSourceIdentity(record),
          sourceSnapshotId: normalizeString(record.sourceSnapshotId),
          relationScope: relationScopeMeta.relationScope,
          relationScopeLabel: relationScopeMeta.relationScopeLabel,
          relationTypeLabel: relationField.label,
          recordLabel,
          fieldName: URL_LIST_TEXT_FIELD_NAME,
          fieldLabel: `${editField.label} #${index + 1}`,
          urlIndex: index,
          urlList: cloneSerializableValue(urlList),
          label: `${recordLabel} / ${editField.label} #${index + 1}`,
          groupLabel: relationScopeMeta.groupLabel,
          groupCategory: relationScopeMeta.groupCategory,
          groupTitle: relationField.label,
          valueType: 'plainText',
          value: item.text,
          aiTranslationSkip: record.aiTranslationSkip === true
        },
        includeEmpty
      )
    })
    .filter(Boolean)
}

function createRelationFieldEntry(
  relationField,
  record,
  editField,
  includeEmpty
) {
  const recordLabel = buildDisplayName(record, relationField.collectionName)
  const relationScopeMeta = getRelationScopeMeta(relationField)
  let valueType = 'plainText'
  if (editField.type === 'richText') {
    valueType = STRUCTURED_RICH_TEXT_VALUE_TYPE
  }
  return buildEntry(
    {
      id: `relation.${relationField.field}.${record._id}.${editField.name}`,
      scope: 'relation',
      relationField: relationField.field,
      collectionName: relationField.collectionName,
      recordId: normalizeString(record._id),
      recordKind: record.recordKind,
      postType: Number(record.type || relationField.postType || 0),
      sourceRecordId: normalizeString(record._id),
      sourceId: normalizeSourceIdentity(record),
      sourceSnapshotId: normalizeString(record.sourceSnapshotId),
      relationScope: relationScopeMeta.relationScope,
      relationScopeLabel: relationScopeMeta.relationScopeLabel,
      relationTypeLabel: relationField.label,
      recordLabel,
      fieldName: editField.name,
      fieldLabel: editField.label,
      label: `${recordLabel} / ${editField.label}`,
      groupLabel: relationScopeMeta.groupLabel,
      groupCategory: relationScopeMeta.groupCategory,
      groupTitle: relationField.label,
      valueType,
      value: record[editField.name],
      aiTranslationSkip: record.aiTranslationSkip === true
    },
    includeEmpty
  )
}

function createRelationEntriesForRecord(relationField, record, includeEmpty) {
  const fieldList =
    RELATION_TRANSLATION_FIELDS[relationField.collectionName] || []
  const entries = []
  fieldList.forEach(editField => {
    if (editField.type === 'voteOptions') {
      entries.push(
        ...createVoteOptionEntries(
          relationField,
          record,
          editField,
          includeEmpty
        )
      )
      return
    }
    if (editField.type === 'urlList') {
      entries.push(
        ...createUrlListEntries(relationField, record, editField, includeEmpty)
      )
      return
    }
    const entry = createRelationFieldEntry(
      relationField,
      record,
      editField,
      includeEmpty
    )
    if (entry) {
      entries.push(entry)
    }
  })
  return entries
}

function getParentRelationFields(collectionName) {
  return PARENT_RELATION_FIELDS[collectionName] || []
}

function getParentTranslationFields(parentRelationField) {
  const fieldList =
    RELATION_TRANSLATION_FIELDS[parentRelationField.relationCollectionName] ||
    []
  const editableFieldNameList =
    parentRelationField.parentEditableFieldNames || []
  if (editableFieldNameList.length === 0) {
    return fieldList
  }
  return fieldList.filter(field => {
    return editableFieldNameList.includes(field.name)
  })
}

function createParentRelationEntry(
  parentRelationField,
  parentRecord,
  editField,
  includeEmpty
) {
  const parentLabel = buildDisplayName(
    parentRecord,
    parentRelationField.relationCollectionName
  )
  return buildEntry(
    {
      id: `parent.${parentRelationField.relationCollectionName}.${parentRecord._id}.${editField.name}`,
      scope: 'parentRelation',
      collectionName: parentRelationField.relationCollectionName,
      recordId: normalizeString(parentRecord._id),
      recordKind: parentRecord.recordKind,
      sourceRecordId: normalizeString(parentRecord._id),
      sourceId: normalizeSourceIdentity(parentRecord),
      sourceSnapshotId: normalizeString(parentRecord.sourceSnapshotId),
      relationTypeLabel: parentRelationField.label,
      recordLabel: parentLabel,
      fieldName: editField.name,
      fieldLabel: editField.label,
      label: `${parentLabel} / ${editField.label}`,
      groupLabel: `父级关联 / ${parentRelationField.label}`,
      groupCategory: '父级关联',
      groupTitle: parentRelationField.label,
      valueType: 'plainText',
      value: parentRecord[editField.name],
      aiTranslationSkip: parentRecord.aiTranslationSkip === true,
      optional: Boolean(editField.translationOptional)
    },
    includeEmpty
  )
}

function appendParentRelationEntries({
  entries,
  exportedParentIdSet,
  parentRelationFieldList,
  record,
  includeEmpty
}) {
  parentRelationFieldList.forEach(parentRelationField => {
    const parentRecord = record[parentRelationField.name]
    if (
      !parentRecord ||
      typeof parentRecord !== 'object' ||
      !parentRecord._id
    ) {
      return
    }

    getParentTranslationFields(parentRelationField).forEach(editField => {
      const parentEntryId = `parent.${parentRelationField.relationCollectionName}.${parentRecord._id}.${editField.name}`
      if (exportedParentIdSet.has(parentEntryId)) {
        return
      }
      const entry = createParentRelationEntry(
        parentRelationField,
        parentRecord,
        editField,
        includeEmpty
      )
      if (!entry) {
        return
      }
      exportedParentIdSet.add(parentEntryId)
      entries.push(entry)
    })
  })
}

function createPostRelationEntries(detail, includeEmpty) {
  const post = detail.post || {}
  const entries = []
  const exportedParentIdSet = new Set()
  POST_RELATION_FIELDS.forEach(relationField => {
    const parentRelationFieldList = getParentRelationFields(
      relationField.collectionName
    )
    getPostRelationRecords(detail, post, relationField).forEach(record => {
      if (!record || !record._id) {
        return
      }
      entries.push(
        ...createRelationEntriesForRecord(relationField, record, includeEmpty)
      )
      appendParentRelationEntries({
        entries,
        exportedParentIdSet,
        parentRelationFieldList,
        record,
        includeEmpty
      })
    })
  })
  return entries
}

function buildPostTranslationEntries(detail, includeEmpty = false) {
  const post = detail.post || {}
  return [
    ...createPostEntries(post, includeEmpty),
    ...createPostRelationEntries(detail, includeEmpty)
  ]
}

function buildRecordTranslationEntries(
  record,
  collectionName,
  includeEmpty = false
) {
  const entries = createRelationEntriesForRecord(
    {
      field: 'record',
      label: '内容字段',
      collectionName
    },
    record,
    includeEmpty
  )
  appendParentRelationEntries({
    entries,
    exportedParentIdSet: new Set(),
    parentRelationFieldList: getParentRelationFields(collectionName),
    record,
    includeEmpty
  })
  return entries
}

function getEntryFieldKey(entry = {}) {
  if (entry.fieldName === 'options.title') {
    return `${entry.fieldName}.${entry.optionIndex}`
  }
  if (entry.fieldName === URL_LIST_TEXT_FIELD_NAME) {
    return `${entry.fieldName}.${entry.urlIndex}`
  }
  return entry.fieldName || ''
}

function buildStableEntryKey(entry, context = {}) {
  const fieldKey = getEntryFieldKey(entry)
  if (!fieldKey) {
    return ''
  }

  if (entry.scope === 'post') {
    const sourcePostId = normalizeString(context.sourcePostId)
    if (!sourcePostId) {
      return ''
    }
    return ['posts', sourcePostId, fieldKey].join(':')
  }

  if (entry.scope !== 'relation' && entry.scope !== 'parentRelation') {
    return ''
  }

  const sourceId = normalizeString(entry.sourceId)
  const collectionName = normalizeString(entry.collectionName)
  if (!sourceId || !collectionName) {
    return ''
  }

  return [collectionName, sourceId, fieldKey].join(':')
}

function buildRelationEntryMatchKey(entry, sourceId) {
  if (entry.scope === 'relation') {
    return [
      'relation',
      entry.relationField || '',
      entry.collectionName || '',
      sourceId,
      getEntryFieldKey(entry)
    ].join(':')
  }

  if (entry.scope === 'parentRelation') {
    return [
      'parentRelation',
      entry.collectionName || '',
      sourceId,
      entry.fieldName || ''
    ].join(':')
  }

  return ''
}

function buildTranslationEntryMatchKeys(entry) {
  if (entry.scope === 'post') {
    return [`post:${entry.fieldName}`]
  }

  const sourceId = normalizeString(entry.sourceId)
  if (!sourceId) {
    return []
  }

  const key = buildRelationEntryMatchKey(entry, sourceId)
  if (!key) {
    return []
  }
  return [key]
}

function normalizeMappedEntryOptions(options = {}) {
  return {
    allowAiKeepOriginalJudgement: options.allowAiKeepOriginalJudgement === true
  }
}

function buildMappedSourceEntry(sourceEntry, targetEntry, options = {}) {
  const normalizedOptions = normalizeMappedEntryOptions(options)
  const value = cloneSerializableValue(sourceEntry.value)
  const mappedEntry = {
    ...targetEntry,
    currentValue: cloneSerializableValue(targetEntry.value),
    value,
    previewText: sourceEntry.previewText,
    previewRawValue: sourceEntry.previewRawValue,
    currentPreviewText: targetEntry.previewText,
    currentPreviewRawValue: targetEntry.previewRawValue,
    currentPreviewHtml: targetEntry.previewHtml || '',
    sourcePreviewText: sourceEntry.previewText,
    sourcePreviewRawValue: sourceEntry.previewRawValue,
    sourcePreviewHtml: sourceEntry.previewHtml || ''
  }
  if (
    normalizedOptions.allowAiKeepOriginalJudgement &&
    sourceEntry.scope !== 'post' &&
    sourceEntry.valueType !== 'richTextDocument'
  ) {
    mappedEntry.skipAllowed = true
  }
  return mappedEntry
}

function buildMappedEntries(sourceEntries, targetEntries, options = {}) {
  const normalizedOptions = normalizeMappedEntryOptions(options)
  const targetEntryMap = new Map()
  targetEntries.forEach(entry => {
    buildTranslationEntryMatchKeys(entry).forEach(key => {
      targetEntryMap.set(key, entry)
    })
  })

  const entries = []
  const skippedEntries = []
  sourceEntries.forEach(sourceEntry => {
    const keyList = buildTranslationEntryMatchKeys(sourceEntry)
    if (sourceEntry.scope !== 'post' && keyList.length === 0) {
      skippedEntries.push({
        reason: 'missingSourceId',
        entry: sourceEntry
      })
      return
    }

    const targetEntry = keyList
      .map(key => targetEntryMap.get(key))
      .find(Boolean)
    if (!targetEntry) {
      skippedEntries.push({
        reason: 'missingTarget',
        entry: sourceEntry
      })
      return
    }

    if (sourceEntry.valueType !== targetEntry.valueType) {
      skippedEntries.push({
        reason: 'typeMismatch',
        entry: sourceEntry,
        targetEntry
      })
      return
    }

    entries.push(
      buildMappedSourceEntry(sourceEntry, targetEntry, normalizedOptions)
    )
  })

  return { entries, skippedEntries }
}

function filterRequestedEntries(entries, selectedEntryKeys, context = {}) {
  if (!Array.isArray(selectedEntryKeys) || selectedEntryKeys.length === 0) {
    return entries
  }

  const selectedSet = new Set(
    selectedEntryKeys.map(normalizeString).filter(Boolean)
  )
  return entries.filter(entry => {
    const matchKeys = buildTranslationEntryMatchKeys(entry)
    const stableEntryKey = buildStableEntryKey(entry, context)
    return (
      selectedSet.has(entry.id) ||
      selectedSet.has(stableEntryKey) ||
      matchKeys.some(key => selectedSet.has(key))
    )
  })
}

async function getTranslationRecord(collectionName, id, expectedRecordKind) {
  const Model = getRepositoryModel(collectionName)
  const objectId = toObjectId(id, 'contentId', true)
  const query = { _id: objectId }
  if (expectedRecordKind) {
    query.recordKind = expectedRecordKind
  }
  const record = await Model.findOne(query).lean()
  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '内容记录不存在',
      'contentId',
      404
    )
  }
  return record
}

// 以当前文章内容为翻译基底：用目标语言版本的当前条目作为待翻译值，并附带源条目作为参考。
// 用于"翻译用文章 = 当前文章"模式，与单篇 AI 翻译弹窗的当前模式语义一致。
function buildCurrentBaseEntries(sourceEntries, currentEntries, options = {}) {
  const normalizedOptions = normalizeMappedEntryOptions(options)
  const sourceEntryMap = new Map()
  sourceEntries.forEach(entry => {
    buildTranslationEntryMatchKeys(entry).forEach(key => {
      sourceEntryMap.set(key, entry)
    })
  })

  const entries = []
  currentEntries.forEach(currentEntry => {
    const keyList = buildTranslationEntryMatchKeys(currentEntry)
    const sourceEntry = keyList
      .map(key => sourceEntryMap.get(key))
      .find(Boolean)
    const value = cloneSerializableValue(currentEntry.value)
    const entry = {
      ...currentEntry,
      currentValue: value,
      value,
      previewText: currentEntry.previewText,
      previewRawValue: currentEntry.previewRawValue,
      currentPreviewText: currentEntry.previewText,
      currentPreviewRawValue: currentEntry.previewRawValue,
      currentPreviewHtml: currentEntry.previewHtml || '',
      sourcePreviewText: sourceEntry ? sourceEntry.previewText : '',
      sourcePreviewRawValue: sourceEntry ? sourceEntry.previewRawValue : '',
      sourcePreviewHtml: sourceEntry ? sourceEntry.previewHtml || '' : ''
    }
    if (
      normalizedOptions.allowAiKeepOriginalJudgement &&
      currentEntry.scope !== 'post' &&
      currentEntry.valueType !== 'richTextDocument'
    ) {
      entry.skipAllowed = true
    }
    entries.push(entry)
  })

  return { entries, skippedEntries: [] }
}

async function buildPostJobEntries(job) {
  let sourceDetail = null
  if (job.source.snapshotId) {
    sourceDetail = await importPostSourceService.getSourcePostDetail(
      job.source.snapshotId
    )
  } else {
    sourceDetail = await importPostSourceService.getSourceDatabasePostDetail({
      id: job.source.postId,
      sourceLanguageCode: job.source.languageCode
    })
  }
  const targetDetail = await translationPostService.getTranslationPostDetail(
    job.target.postId
  )
  const sourceEntries = buildPostTranslationEntries(sourceDetail)
  const baseMode = normalizeString(job.request?.baseMode) || 'source'
  let mappedResult = null
  let targetEntryCount = 0
  if (baseMode === 'current') {
    const currentEntries = buildPostTranslationEntries(targetDetail, false)
    targetEntryCount = currentEntries.length
    mappedResult = buildCurrentBaseEntries(sourceEntries, currentEntries, {
      allowAiKeepOriginalJudgement: true
    })
  } else {
    const targetEntries = buildPostTranslationEntries(targetDetail, true)
    targetEntryCount = targetEntries.length
    mappedResult = buildMappedEntries(sourceEntries, targetEntries, {
      allowAiKeepOriginalJudgement: true
    })
  }
  const sourcePostId = normalizeString(sourceDetail.post?.sourceId)
  const entries = filterRequestedEntries(
    mappedResult.entries,
    job.request?.selectedEntryKeys,
    { sourcePostId }
  )

  return {
    entries,
    skippedEntries: mappedResult.skippedEntries,
    sourceEntryCount: sourceEntries.length,
    targetEntryCount
  }
}

async function buildContentJobEntries(job) {
  const collectionName = job.source.collectionName || job.target.collectionName
  if (!collectionName) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '通用内容翻译任务缺少 collectionName',
      'collectionName',
      400
    )
  }

  const sourceRecord = await getTranslationRecord(
    collectionName,
    job.source.contentId || job.source.postId,
    job.source.contentId ? null : undefined
  )
  const targetRecord = await getTranslationRecord(
    collectionName,
    job.target.contentId || job.target.postId,
    TRANSLATION_RECORD_KIND
  )
  const sourceEntries = buildRecordTranslationEntries(
    sourceRecord,
    collectionName
  )
  const targetEntries = buildRecordTranslationEntries(
    targetRecord,
    collectionName,
    true
  )
  const mappedResult = buildMappedEntries(sourceEntries, targetEntries, {
    allowAiKeepOriginalJudgement: true
  })
  const sourcePostId = normalizeString(
    sourceRecord.sourceId || sourceRecord._id
  )
  const entries = filterRequestedEntries(
    mappedResult.entries,
    job.request?.selectedEntryKeys,
    { sourcePostId }
  )

  return {
    entries,
    skippedEntries: mappedResult.skippedEntries,
    sourceEntryCount: sourceEntries.length,
    targetEntryCount: targetEntries.length
  }
}

async function buildTranslationJobEntries(job) {
  if (job.jobType === TRANSLATION_JOB_TYPES.POST_AI_TRANSLATION) {
    return await buildPostJobEntries(job)
  }

  if (job.jobType === TRANSLATION_JOB_TYPES.CONTENT_AI_TRANSLATION) {
    return await buildContentJobEntries(job)
  }

  throw new ApiError(
    ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
    `当前任务类型不能构建翻译条目：${job.jobType}`,
    'jobType',
    400,
    { retryable: false }
  )
}

module.exports = {
  buildTranslationJobEntries,
  buildPostTranslationEntries,
  buildRecordTranslationEntries,
  buildTranslationEntryMatchKeys,
  buildMappedEntries,
  buildStableEntryKey
}
