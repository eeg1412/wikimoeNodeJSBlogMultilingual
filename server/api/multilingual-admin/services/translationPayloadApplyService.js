const crypto = require('crypto')
const mongoose = require('mongoose')
const contentRefreshUtils = require('../../../utils/contentRefresh')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_TYPES
} = require('../../../utils/translationJobConstants')
const relationService = require('./relationService')
const translationPostService = require('./translationPostService')
const coverImageAdoptionService = require('./coverImageAdoptionService')

const TRANSLATION_RECORD_KIND = 'translation'
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'
const URL_LIST_TEXT_FIELD_NAME = 'urlList.text'
const APPLY_ALLOWED_STATUSES = new Set([
  TRANSLATION_JOB_STATUS.WAITING_REVIEW,
  TRANSLATION_JOB_STATUS.REJECTED,
  TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED,
  TRANSLATION_JOB_STATUS.FULLY_ADOPTED
])
const VOID_HTML_TAG_SET = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

function getTranslationJobModel() {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.translationJobs
  if (!repository || !repository.model) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'translationJobs model is not ready',
      'translationJobs',
      503
    )
  }

  return repository.model
}

function getPostModel() {
  const repository = global.$mongodDB?.multilingual?.repositories?.posts
  if (!repository || !repository.model) {
    throw new ApiError(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      'posts model is not ready',
      'posts',
      503
    )
  }

  return repository.model
}

function getRelationRecordModel(collectionName) {
  if (!relationService.ALLOWED_COLLECTION_NAMES.has(collectionName)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'collectionName is not supported',
      'collectionName',
      400
    )
  }

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

function normalizeIdentityValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  return String(value).trim()
}

function toObjectId(value, field, required = false) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }
  if (value && typeof value.toHexString === 'function') {
    return new mongoose.Types.ObjectId(value.toHexString())
  }

  const text = normalizeIdentityValue(value)
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

function normalizeAdminSnapshot(admin) {
  if (!admin || !admin._id) {
    return null
  }

  return {
    id: toObjectId(admin._id, 'admin.id'),
    username: normalizeIdentityValue(
      admin.username || admin.name || admin.email
    ),
    displayName: normalizeIdentityValue(
      admin.displayName || admin.nickName || admin.nickname || admin.name
    )
  }
}

function cloneSerializableValue(value) {
  if (typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  const keys = Object.keys(value).sort()
  return `{${keys
    .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

function createValueHash(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')
}

function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, '&quot;').replace(/\n/g, '&#10;')
}

function renderRichTextDocumentNode(node) {
  if (!node || typeof node !== 'object') {
    return ''
  }

  if (node.type === 'root') {
    const children = Array.isArray(node.children) ? node.children : []
    return children.map(renderRichTextDocumentNode).join('')
  }

  if (node.type === 'text') {
    return escapeHtmlText(node.text || '')
  }

  if (node.type !== 'element' || !node.tag) {
    return ''
  }

  const attrs = {
    ...(node.attrs || {}),
    ...(node.translatableAttrs || {})
  }
  const attrText = Object.keys(attrs)
    .filter(key => attrs[key] !== null && typeof attrs[key] !== 'undefined')
    .map(key => ` ${key}="${escapeHtmlAttribute(attrs[key])}"`)
    .join('')
  if (VOID_HTML_TAG_SET.has(node.tag)) {
    return `<${node.tag}${attrText}>`
  }

  const children = Array.isArray(node.children) ? node.children : []
  return `<${node.tag}${attrText}>${children
    .map(renderRichTextDocumentNode)
    .join('')}</${node.tag}>`
}

function normalizeAiEntryValue(entry) {
  if (entry.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return renderRichTextDocumentNode(entry.value)
  }

  return entry.value
}

function buildPreviewHtmlValue(value, valueType) {
  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return normalizePreviewTextValue(value)
  }
  if (valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return renderRichTextDocumentNode(value)
  }
  return ''
}

function normalizePreviewTextValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return stableStringify(value)
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

function buildSourceIdCandidates(sourceId) {
  const text = normalizeIdentityValue(sourceId)
  if (!text) {
    return []
  }

  const candidates = [text]
  if (mongoose.Types.ObjectId.isValid(text)) {
    candidates.push(new mongoose.Types.ObjectId(text))
  }
  return candidates
}

function buildEntryFieldKey(entry = {}) {
  const fieldName = normalizeIdentityValue(entry.fieldName)
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

  if (fieldName === URL_LIST_TEXT_FIELD_NAME) {
    const urlIndex = Number(entry.urlIndex)
    if (!Number.isInteger(urlIndex)) {
      return ''
    }
    return `${fieldName}.${urlIndex}`
  }

  return fieldName
}

function buildEntryKey(entry, translationPost) {
  if (!entry || typeof entry !== 'object') {
    return ''
  }

  const fieldKey = buildEntryFieldKey(entry)
  if (!fieldKey) {
    return ''
  }

  if (entry.scope === 'post') {
    const sourceId = normalizeIdentityValue(translationPost?.sourceId)
    if (!sourceId) {
      return ''
    }
    return ['posts', sourceId, fieldKey].join(':')
  }

  if (entry.scope !== 'relation' && entry.scope !== 'parentRelation') {
    return ''
  }

  const collectionName = normalizeIdentityValue(entry.collectionName)
  const sourceId = normalizeIdentityValue(entry.sourceId)
  if (!collectionName || !sourceId) {
    return ''
  }

  return [collectionName, sourceId, fieldKey].join(':')
}

async function getTranslationPostById(postId) {
  const id = toObjectId(postId, 'target.postId', true)
  const PostModel = getPostModel()
  const post = await PostModel.findOne({
    _id: id,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!post) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标翻译文章不存在',
      'target.postId',
      404
    )
  }

  return post
}

async function getTranslationRecordById(
  collectionName,
  recordId,
  languageCode
) {
  const id = toObjectId(recordId, 'target.contentId', true)
  const Model = getRelationRecordModel(collectionName)
  const record = await Model.findOne({
    _id: id,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标翻译内容不存在',
      'target.contentId',
      404
    )
  }

  if (languageCode && record.languageCode !== languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      '目标内容语言与任务不匹配',
      'target.languageCode',
      409
    )
  }

  return record
}

function assertTranslationPostMatchesJob(post, job) {
  if (
    job.target?.languageCode &&
    post.languageCode !== job.target.languageCode
  ) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      '目标文章语言与任务不匹配',
      'target.languageCode',
      409
    )
  }

  if (
    job.source?.snapshotId &&
    post.sourceSnapshotId &&
    String(post.sourceSnapshotId) !== String(job.source.snapshotId)
  ) {
    throw new ApiError(
      ERROR_CODES.SOURCE_SNAPSHOT_NOT_FOUND,
      '目标文章源快照与任务不匹配',
      'source.snapshotId',
      409
    )
  }

  if (
    job.source?.snapshotVersion !== null &&
    typeof job.source?.snapshotVersion !== 'undefined' &&
    post.snapshotVersion &&
    Number(post.snapshotVersion) !== Number(job.source.snapshotVersion)
  ) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '目标文章源快照版本已变化',
      'source.snapshotVersion',
      409
    )
  }
}

async function getTranslationTargetContext(job) {
  if (job.target?.postId) {
    const translationPost = await getTranslationPostById(job.target.postId)
    assertTranslationPostMatchesJob(translationPost, job)
    return {
      languageCode: translationPost.languageCode,
      translationPost,
      rootRecord: translationPost,
      rootCollectionName: 'posts'
    }
  }

  if (job.target?.contentId && job.target?.collectionName) {
    const rootRecord = await getTranslationRecordById(
      job.target.collectionName,
      job.target.contentId,
      job.target.languageCode
    )
    return {
      languageCode: rootRecord.languageCode,
      translationPost: null,
      rootRecord,
      rootCollectionName: job.target.collectionName
    }
  }

  throw new ApiError(
    ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
    '后台翻译任务缺少可采纳的目标内容',
    'target',
    400
  )
}

async function findTranslationRelationRecord(entry, languageCode) {
  const collectionName = normalizeIdentityValue(entry.collectionName)
  const sourceIdCandidates = buildSourceIdCandidates(entry.sourceId)
  if (!collectionName || sourceIdCandidates.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '翻译条目缺少关联内容身份',
      'sourceId',
      400
    )
  }

  const Model = getRelationRecordModel(collectionName)
  const record = await Model.findOne({
    sourceId: { $in: sourceIdCandidates },
    languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      '目标语言关联内容不存在',
      'sourceId',
      404
    )
  }

  return record
}

function getVoteOptionIndex(record, entry) {
  const optionList = Array.isArray(record.options) ? record.options : []
  const optionId = normalizeIdentityValue(entry.optionId)
  if (optionId) {
    const index = optionList.findIndex(
      option => String(option._id || '') === optionId
    )
    if (index >= 0) {
      return index
    }
  }

  const optionIndex = Number(entry.optionIndex)
  if (
    Number.isInteger(optionIndex) &&
    optionIndex >= 0 &&
    optionList[optionIndex]
  ) {
    return optionIndex
  }

  throw new ApiError(
    ERROR_CODES.CONTENT_NOT_FOUND,
    '目标语言投票选项不存在',
    'options',
    404
  )
}

function getUrlListIndex(record, entry) {
  const urlList = Array.isArray(record.urlList) ? record.urlList : []
  const urlIndex = Number(entry.urlIndex)
  if (Number.isInteger(urlIndex) && urlIndex >= 0 && urlList[urlIndex]) {
    return urlIndex
  }

  throw new ApiError(
    ERROR_CODES.CONTENT_NOT_FOUND,
    '目标语言关联内容链接项不存在',
    'urlList',
    404
  )
}

function getCurrentEntryValue(entry, record) {
  if (entry.collectionName === 'votes' && entry.fieldName === 'options.title') {
    const optionIndex = getVoteOptionIndex(record, entry)
    return record.options[optionIndex]?.title || ''
  }

  if (entry.fieldName === URL_LIST_TEXT_FIELD_NAME) {
    const urlIndex = getUrlListIndex(record, entry)
    return record.urlList[urlIndex]?.text || ''
  }

  return record[entry.fieldName]
}

function buildReviewEntry(entry, context) {
  if (entry.scope === 'post' && !context.translationPost) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '通用内容任务不能采纳文章字段条目',
      'entry.scope',
      400
    )
  }

  const currentValue = getCurrentEntryValue(entry, context.record)
  const entryKey = buildEntryKey(entry, context.translationPost)
  if (!entryKey) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      `无法生成稳定条目键：${entry.label || entry.id || entry.fieldName}`,
      'entryKey',
      400,
      { retryable: false }
    )
  }

  return {
    ...cloneSerializableValue(entry),
    entryKey,
    fieldKey: buildEntryFieldKey(entry),
    sourceId: normalizeIdentityValue(entry.sourceId || context.record.sourceId),
    sourceSnapshotId: normalizeIdentityValue(
      entry.sourceSnapshotId || context.record.sourceSnapshotId
    ),
    targetRecordId: String(context.record._id),
    currentPreviewText:
      normalizePreviewTextValue(entry.currentPreviewText) ||
      normalizePreviewTextValue(currentValue),
    currentPreviewRawValue:
      normalizePreviewTextValue(entry.currentPreviewRawValue) ||
      normalizePreviewTextValue(currentValue),
    currentPreviewHtml:
      normalizePreviewTextValue(entry.currentPreviewHtml) ||
      buildPreviewHtmlValue(currentValue, entry.valueType),
    sourcePreviewText: normalizePreviewTextValue(entry.sourcePreviewText),
    sourcePreviewRawValue: normalizePreviewTextValue(
      entry.sourcePreviewRawValue
    ),
    sourcePreviewHtml:
      normalizePreviewTextValue(entry.sourcePreviewHtml) ||
      buildPreviewHtmlValue(entry.sourcePreviewRawValue, entry.valueType),
    nextPreviewText:
      normalizePreviewTextValue(entry.nextPreviewText) ||
      normalizePreviewTextValue(normalizeAiEntryValue(entry)),
    nextPreviewRawValue:
      normalizePreviewTextValue(entry.nextPreviewRawValue) ||
      normalizePreviewTextValue(normalizeAiEntryValue(entry)),
    nextPreviewHtml:
      normalizePreviewTextValue(entry.nextPreviewHtml) ||
      buildPreviewHtmlValue(entry.value, entry.valueType),
    targetValueHashAtCompletion: createValueHash(currentValue),
    targetValueSnapshotAtCompletion: currentValue
  }
}

async function buildTranslationJobReviewSnapshot(job, payload) {
  if (!payload || !Array.isArray(payload.entries)) {
    throw new ApiError(
      ERROR_CODES.AI_TRANSLATION_FAILED,
      '后台翻译结果缺少 payload.entries',
      'payload.entries',
      502,
      { retryable: true }
    )
  }

  const targetContext = await getTranslationTargetContext(job)
  const previewEntries = []

  for (const entry of payload.entries) {
    if (!entry || typeof entry !== 'object' || entry.aiSkipReason) {
      previewEntries.push(cloneSerializableValue(entry))
      continue
    }

    if (entry.scope === 'post') {
      previewEntries.push(
        buildReviewEntry(entry, {
          record: targetContext.translationPost,
          translationPost: targetContext.translationPost
        })
      )
      continue
    }

    const record = await findTranslationRelationRecord(
      entry,
      targetContext.languageCode
    )
    previewEntries.push(
      buildReviewEntry(entry, {
        record,
        translationPost: targetContext.translationPost
      })
    )
  }

  return previewEntries
}

function normalizeSelectedEntryKeys(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      'selectedEntryKeys 不能为空',
      'selectedEntryKeys',
      400
    )
  }

  const list = []
  value.forEach((item, index) => {
    const entryKey = normalizeIdentityValue(item)
    if (!entryKey) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        `selectedEntryKeys[${index}] 不能为空`,
        `selectedEntryKeys[${index}]`,
        400
      )
    }
    if (!list.includes(entryKey)) {
      list.push(entryKey)
    }
  })

  return list
}

function buildEntryMap(entries = []) {
  const map = new Map()
  entries.forEach(entry => {
    if (entry && entry.entryKey && !entry.aiSkipReason) {
      map.set(entry.entryKey, entry)
    }
  })
  return map
}

function buildSourcePostApplyPayload(job, selectedEntryKeys) {
  const selectedKeySet = new Set(selectedEntryKeys)
  const languageResultList = Array.isArray(job.result?.languageResults)
    ? job.result.languageResults
    : []
  const languageMap = new Map()

  languageResultList.forEach(item => {
    const languageCode = normalizeIdentityValue(item.languageCode)
    if (!languageCode || !item.result?.payload) {
      return
    }
    if (!languageMap.has(languageCode)) {
      languageMap.set(languageCode, {
        languageCode,
        payload: {
          ...item.result.payload,
          entries: []
        },
        relatedPostResults: []
      })
    }
    const selectedPayloadEntries = (item.result.payload.entries || []).filter(
      entry => {
        return entry?.entryKey && selectedKeySet.has(entry.entryKey)
      }
    )
    if (selectedPayloadEntries.length === 0) {
      return
    }
    const languageItem = languageMap.get(languageCode)
    const payload = {
      ...item.result.payload,
      entries: selectedPayloadEntries
    }
    if (item.isRoot) {
      languageItem.payload = payload
      return
    }
    languageItem.relatedPostResults.push({
      sourceId: item.sourceId,
      payload
    })
  })

  return Array.from(languageMap.values()).filter(item => {
    return item.payload.entries.length > 0 || item.relatedPostResults.length > 0
  })
}

function buildSourcePostAdoptionEntry(entry, adminSnapshot, applyBatchId) {
  return {
    entryKey: entry.entryKey,
    scope: entry.scope || '',
    collectionName:
      entry.scope === 'post' ? 'posts' : entry.collectionName || '',
    sourceId: toObjectId(entry.sourceId, 'entry.sourceId'),
    recordId: toObjectId(entry.targetRecordId, 'entry.targetRecordId'),
    fieldName: entry.fieldName || '',
    fieldKey: entry.fieldKey || buildEntryFieldKey(entry),
    optionIndex: Number.isInteger(Number(entry.optionIndex))
      ? Number(entry.optionIndex)
      : null,
    urlIndex: Number.isInteger(Number(entry.urlIndex))
      ? Number(entry.urlIndex)
      : null,
    applied: true,
    appliedAt: new Date(),
    appliedBy: adminSnapshot,
    applyBatchId,
    sourceSnapshotVersionAtApply: null,
    currentValueHashAtApply: '',
    forced: false,
    forceReason: '',
    conflict: null
  }
}

async function updateSourcePostJobAdoption({
  job,
  selectedEntries,
  adminSnapshot,
  applyBatchId
}) {
  const JobModel = getTranslationJobModel()
  const existingEntryMap = getAppliedEntryMap(job)
  selectedEntries.forEach(entry => {
    existingEntryMap.set(
      entry.entryKey,
      buildSourcePostAdoptionEntry(entry, adminSnapshot, applyBatchId)
    )
  })
  const selectableEntries = (job.result?.previewEntries || []).filter(entry => {
    return entry && entry.entryKey && !entry.aiSkipReason
  })
  const totalEntryKeys = new Set(selectableEntries.map(entry => entry.entryKey))
  const appliedEntryKeys = new Set(
    Array.from(existingEntryMap.values())
      .filter(
        entry => entry && entry.applied && totalEntryKeys.has(entry.entryKey)
      )
      .map(entry => entry.entryKey)
  )
  let nextStatus = TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED
  if (totalEntryKeys.size > 0 && appliedEntryKeys.size >= totalEntryKeys.size) {
    nextStatus = TRANSLATION_JOB_STATUS.FULLY_ADOPTED
  }

  await JobModel.updateOne(
    { _id: job._id },
    {
      $set: {
        status: nextStatus,
        'queueControl.active': false,
        'progress.percent': 100,
        'adoption.entries': Array.from(existingEntryMap.values()),
        'adoption.adoptedBy': adminSnapshot,
        'adoption.adoptedAt': new Date(),
        'adoption.lastApplyBatchId': applyBatchId,
        updatedBy: adminSnapshot
      }
    }
  )

  return {
    status: nextStatus,
    appliedCount: appliedEntryKeys.size,
    totalCount: totalEntryKeys.size
  }
}

async function applySourcePostTranslationJob({
  job,
  selectedEntries,
  selectedEntryKeys,
  adminSnapshot,
  applyBatchId,
  publish
}) {
  const results = buildSourcePostApplyPayload(job, selectedEntryKeys).map(
    item => {
      return {
        ...item,
        publish,
        relatedPostResults: item.relatedPostResults.map(relatedItem => ({
          ...relatedItem,
          publish
        }))
      }
    }
  )
  if (results.length === 0) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '没有可采纳的生成并 AI 翻译结果',
      'selectedEntryKeys',
      400
    )
  }

  const applyResult = await translationPostService.applySourcePostAiImport({
    sourceId: job.source?.postId,
    sourceLanguageCode: job.source?.languageCode,
    results
  })
  const statusResult = await updateSourcePostJobAdoption({
    job,
    selectedEntries,
    adminSnapshot,
    applyBatchId
  })

  return {
    applied: true,
    applyBatchId,
    appliedEntryKeys: selectedEntries.map(entry => entry.entryKey),
    appliedCount: selectedEntries.length,
    sourcePostApplyResult: applyResult,
    ...statusResult
  }
}

function buildAggregateApplyJobForLanguage(job, languageCode) {
  const targetInfo = job.result?.translationPostMap?.[languageCode]
  if (!targetInfo?.translationPostId) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
      '任务结果缺少目标语言翻译文章 ID',
      'translationPostMap',
      400
    )
  }

  return {
    ...job,
    source: {
      ...job.source,
      snapshotId: job.source?.snapshotId || job.result?.sourceSnapshotId || null
    },
    target: {
      ...job.target,
      postId: targetInfo.translationPostId,
      languageCode
    }
  }
}

function buildApplyGroupsForSelectedEntries(job, selectedEntries) {
  if (job.target?.postId || job.target?.contentId) {
    return [
      {
        applyJob: job,
        selectedEntries
      }
    ]
  }

  const groupMap = new Map()
  selectedEntries.forEach(entry => {
    const languageCode = normalizeIdentityValue(entry.languageCode)
    if (!languageCode) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '聚合任务条目缺少目标语言',
        'entry.languageCode',
        400
      )
    }
    if (!groupMap.has(languageCode)) {
      groupMap.set(languageCode, {
        applyJob: buildAggregateApplyJobForLanguage(job, languageCode),
        selectedEntries: []
      })
    }
    groupMap.get(languageCode).selectedEntries.push(entry)
  })

  return Array.from(groupMap.values())
}

async function buildApplyContexts(job, selectedEntries) {
  const groups = buildApplyGroupsForSelectedEntries(job, selectedEntries)
  const contexts = []
  for (const group of groups) {
    contexts.push({
      ...group,
      targetContext: await getTranslationTargetContext(group.applyJob)
    })
  }

  return contexts
}

function getAppliedEntryMap(job) {
  const map = new Map()
  const entries =
    job.adoption && Array.isArray(job.adoption.entries)
      ? job.adoption.entries
      : []
  entries.forEach(entry => {
    if (entry && entry.entryKey) {
      map.set(entry.entryKey, entry)
    }
  })
  return map
}

async function getCurrentRecordForEntry(entry, targetContext) {
  if (entry.scope === 'post') {
    return await getTranslationPostById(
      entry.targetRecordId || targetContext.translationPost._id
    )
  }

  if (entry.targetRecordId) {
    return await getTranslationRecordById(
      entry.collectionName,
      entry.targetRecordId,
      targetContext.languageCode
    )
  }

  return await findTranslationRelationRecord(entry, targetContext.languageCode)
}

function buildConflict(entry, code, message, extra = {}) {
  return {
    entryKey: entry.entryKey,
    label: entry.label || '',
    scope: entry.scope || '',
    collectionName: entry.collectionName || '',
    fieldName: entry.fieldName || '',
    code,
    message,
    ...extra
  }
}

async function collectApplyConflicts({
  job,
  selectedEntries,
  targetContext,
  force,
  forceOverwriteApplied
}) {
  const appliedEntryMap = getAppliedEntryMap(job)
  const conflicts = []

  for (const entry of selectedEntries) {
    const appliedEntry = appliedEntryMap.get(entry.entryKey)
    if (appliedEntry?.applied && !forceOverwriteApplied) {
      conflicts.push(
        buildConflict(
          entry,
          'ALREADY_APPLIED',
          '该条目已经采纳，继续会覆盖当前内容',
          {
            appliedAt: appliedEntry.appliedAt || null,
            appliedBy: appliedEntry.appliedBy || null
          }
        )
      )
      continue
    }

    if (!entry.targetValueHashAtCompletion) {
      if (!force) {
        conflicts.push(
          buildConflict(
            entry,
            'BASELINE_HASH_MISSING',
            '任务结果缺少完成时目标内容 hash，不能直接写入'
          )
        )
      }
      continue
    }

    const currentRecord = await getCurrentRecordForEntry(entry, targetContext)
    const currentValue = getCurrentEntryValue(entry, currentRecord)
    const currentValueHash = createValueHash(currentValue)
    if (currentValueHash !== entry.targetValueHashAtCompletion && !force) {
      conflicts.push(
        buildConflict(
          entry,
          'TARGET_VALUE_CHANGED',
          '目标内容已被其他操作修改',
          {
            targetValueHashAtCompletion: entry.targetValueHashAtCompletion,
            currentValueHash
          }
        )
      )
    }
  }

  return conflicts
}

function buildAdoptionRecord({
  entry,
  record,
  targetContext,
  adminSnapshot,
  applyBatchId,
  sourceSnapshotVersionAtApply,
  currentValueHashAtApply,
  forced,
  forceReason
}) {
  const sourceId = toObjectId(
    entry.sourceId ||
      record.sourceId ||
      targetContext.translationPost?.sourceId,
    'entry.sourceId'
  )
  const recordId = toObjectId(record._id, 'record._id', true)
  return {
    entryKey: entry.entryKey,
    scope: entry.scope || '',
    collectionName:
      entry.scope === 'post' ? 'posts' : entry.collectionName || '',
    sourceId,
    recordId,
    fieldName: entry.fieldName || '',
    fieldKey: entry.fieldKey || buildEntryFieldKey(entry),
    optionIndex: Number.isInteger(Number(entry.optionIndex))
      ? Number(entry.optionIndex)
      : null,
    urlIndex: Number.isInteger(Number(entry.urlIndex))
      ? Number(entry.urlIndex)
      : null,
    applied: true,
    appliedAt: new Date(),
    appliedBy: adminSnapshot,
    applyBatchId,
    sourceSnapshotVersionAtApply,
    currentValueHashAtApply,
    forced: forced === true,
    forceReason: forceReason || '',
    conflict: null
  }
}

async function markEntryApplied(jobId, adoptionRecord, adminSnapshot) {
  const JobModel = getTranslationJobModel()
  const updateResult = await JobModel.updateOne(
    {
      _id: jobId,
      'adoption.entries.entryKey': adoptionRecord.entryKey
    },
    {
      $set: {
        'adoption.entries.$': adoptionRecord,
        'adoption.adoptedBy': adminSnapshot,
        'adoption.adoptedAt': adoptionRecord.appliedAt,
        'adoption.lastApplyBatchId': adoptionRecord.applyBatchId,
        updatedBy: adminSnapshot
      }
    }
  )

  if (updateResult.matchedCount > 0) {
    return
  }

  await JobModel.updateOne(
    { _id: jobId },
    {
      $push: {
        'adoption.entries': adoptionRecord
      },
      $set: {
        'adoption.adoptedBy': adminSnapshot,
        'adoption.adoptedAt': adoptionRecord.appliedAt,
        'adoption.lastApplyBatchId': adoptionRecord.applyBatchId,
        updatedBy: adminSnapshot
      }
    }
  )
}

function buildPostUpdateBody(entry, translationPost, publish) {
  const body = {
    id: translationPost._id,
    languageCode: translationPost.languageCode,
    confirmReview: true,
    aiTranslationSkip: true,
    [entry.fieldName]: normalizeAiEntryValue(entry)
  }
  if (publish === true) {
    body.status = 1
  }
  return body
}

function buildRelationUpdateBody(entry, record, languageCode) {
  const value = normalizeAiEntryValue(entry)
  const payload = {
    aiTranslationSkip: true
  }

  if (entry.collectionName === 'votes' && entry.fieldName === 'options.title') {
    const options = Array.isArray(record.options)
      ? cloneSerializableValue(record.options)
      : []
    const optionIndex = getVoteOptionIndex(record, entry)
    options[optionIndex].title = value
    payload.options = options
  } else if (entry.fieldName === URL_LIST_TEXT_FIELD_NAME) {
    const urlList = normalizeUrlListValue(record.urlList)
    const urlIndex = getUrlListIndex(record, entry)
    urlList[urlIndex].text = value
    payload.urlList = urlList
  } else {
    payload[entry.fieldName] = value
  }

  return {
    collectionName: entry.collectionName,
    id: record._id,
    languageCode,
    payload
  }
}

async function applySingleEntry({
  job,
  entry,
  targetContext,
  adminSnapshot,
  applyBatchId,
  publish,
  force,
  forceReason
}) {
  const recordBeforeApply = await getCurrentRecordForEntry(entry, targetContext)
  const currentValueHashAtApply = createValueHash(
    getCurrentEntryValue(entry, recordBeforeApply)
  )

  if (entry.scope === 'post') {
    await translationPostService.updateTranslationPost(
      buildPostUpdateBody(entry, recordBeforeApply, publish),
      { skipContentRefresh: true }
    )
  } else {
    await relationService.updateRelation(
      buildRelationUpdateBody(
        entry,
        recordBeforeApply,
        targetContext.languageCode
      ),
      { skipContentRefresh: true }
    )
  }

  const adoptionRecord = buildAdoptionRecord({
    entry,
    record: recordBeforeApply,
    targetContext,
    adminSnapshot,
    applyBatchId,
    sourceSnapshotVersionAtApply:
      job.source?.snapshotVersion ||
      targetContext.translationPost?.snapshotVersion ||
      null,
    currentValueHashAtApply,
    forced: force,
    forceReason
  })
  await markEntryApplied(job._id, adoptionRecord, adminSnapshot)
  return adoptionRecord
}

async function updateJobStatusAfterApply(jobId) {
  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne({ _id: jobId }).lean()
  if (!job) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  const entries = Array.isArray(job.result?.previewEntries)
    ? job.result.previewEntries.filter(
        entry => entry && entry.entryKey && !entry.aiSkipReason
      )
    : []
  const totalEntryKeys = new Set(entries.map(entry => entry.entryKey))
  const appliedEntryKeys = new Set(
    (job.adoption?.entries || [])
      .filter(
        entry => entry && entry.applied && totalEntryKeys.has(entry.entryKey)
      )
      .map(entry => entry.entryKey)
  )
  let nextStatus = TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED
  if (totalEntryKeys.size > 0 && appliedEntryKeys.size >= totalEntryKeys.size) {
    nextStatus = TRANSLATION_JOB_STATUS.FULLY_ADOPTED
  }

  await JobModel.updateOne(
    { _id: jobId },
    {
      $set: {
        status: nextStatus,
        'queueControl.active': false,
        'progress.percent': 100
      }
    }
  )

  return {
    status: nextStatus,
    appliedCount: appliedEntryKeys.size,
    totalCount: totalEntryKeys.size
  }
}

async function applyTranslationJobPayload(body = {}, options = {}) {
  const jobId = toObjectId(body.id || body.jobId, 'id', true)
  const selectedEntryKeys = normalizeSelectedEntryKeys(body.selectedEntryKeys)
  const force = body.force === true
  const forceOverwriteApplied = body.forceOverwriteApplied === true || force
  const forceReason = normalizeIdentityValue(body.forceReason)
  const publish = body.publish === true
  const applyBatchId =
    normalizeIdentityValue(body.applyBatchId) || crypto.randomUUID()
  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne({ _id: jobId }).lean()

  if (!job) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  if (!APPLY_ALLOWED_STATUSES.has(job.status)) {
    throw new ApiError(
      ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
      `当前状态不允许采纳：${job.status}`,
      'status',
      400
    )
  }

  const previewEntries = Array.isArray(job.result?.previewEntries)
    ? job.result.previewEntries
    : []
  const entryMap = buildEntryMap(previewEntries)
  const selectedEntries = selectedEntryKeys.map(entryKey => {
    const entry = entryMap.get(entryKey)
    if (!entry) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        `任务结果中不存在条目：${entryKey}`,
        'selectedEntryKeys',
        400
      )
    }
    return entry
  })
  const selectedCoverImageEntries = selectedEntries.filter(entry => {
    return entry?.entryType === 'coverImageTranslation'
  })
  const selectedContentEntries = selectedEntries.filter(entry => {
    return entry?.entryType !== 'coverImageTranslation'
  })

  if (job.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    const appliedEntries = []
    if (selectedContentEntries.length > 0) {
      const contentApplyResult = await applySourcePostTranslationJob({
        job,
        selectedEntries: selectedContentEntries,
        selectedEntryKeys: selectedContentEntries.map(entry => entry.entryKey),
        adminSnapshot,
        applyBatchId,
        publish
      })
      appliedEntries.push(
        ...selectedContentEntries.map(entry => {
          return {
            entryKey: entry.entryKey
          }
        })
      )
      if (selectedCoverImageEntries.length === 0) {
        return {
          ...contentApplyResult,
          appliedEntryKeys: appliedEntries.map(entry => entry.entryKey),
          appliedCount: appliedEntries.length
        }
      }
    }
    for (const entry of selectedCoverImageEntries) {
      if (!entry?.artifactId) {
        throw new ApiError(
          ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
          '封面图条目缺少 artifactId，不能采纳',
          'artifactId',
          400
        )
      }
      const result = await coverImageAdoptionService.adoptCoverImage(
        {
          jobId: job._id,
          artifactId: entry.artifactId,
          entryKey: entry.entryKey,
          targetPostId: entry.targetPostId,
          languageCode: entry.languageCode,
          applyBatchId
        },
        {
          admin: options.admin
        }
      )
      if (result?.adoptionEntry?.entryKey) {
        appliedEntries.push({ entryKey: result.adoptionEntry.entryKey })
      }
    }
    const statusResult = await updateJobStatusAfterApply(job._id)
    return {
      applied: true,
      applyBatchId,
      appliedEntryKeys: appliedEntries.map(entry => entry.entryKey),
      appliedCount: appliedEntries.length,
      ...statusResult
    }
  }

  const applyContexts = await buildApplyContexts(job, selectedContentEntries)
  const conflicts = []
  for (const context of applyContexts) {
    conflicts.push(
      ...(await collectApplyConflicts({
        job: context.applyJob,
        selectedEntries: context.selectedEntries,
        targetContext: context.targetContext,
        force,
        forceOverwriteApplied
      }))
    )
  }
  if (conflicts.length > 0) {
    return {
      applied: false,
      conflicts,
      conflictCount: conflicts.length
    }
  }

  const appliedEntries = []
  const alreadyAppliedInBatch = new Set(
    (job.adoption?.entries || [])
      .filter(
        entry => entry && entry.applied && entry.applyBatchId === applyBatchId
      )
      .map(entry => entry.entryKey)
  )

  const refreshedLanguageCodeSet = new Set()
  for (const context of applyContexts) {
    for (const entry of context.selectedEntries) {
      if (alreadyAppliedInBatch.has(entry.entryKey)) {
        continue
      }
      const adoptionRecord = await applySingleEntry({
        job: context.applyJob,
        entry,
        targetContext: context.targetContext,
        adminSnapshot,
        applyBatchId,
        publish,
        force,
        forceReason
      })
      appliedEntries.push(adoptionRecord)
    }
    if (context.targetContext.languageCode) {
      refreshedLanguageCodeSet.add(context.targetContext.languageCode)
    }
  }

  for (const entry of selectedCoverImageEntries) {
    if (!entry?.artifactId) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_FIELD_INVALID,
        '封面图条目缺少 artifactId，不能采纳',
        'artifactId',
        400
      )
    }
    const result = await coverImageAdoptionService.adoptCoverImage(
      {
        jobId: job._id,
        artifactId: entry.artifactId,
        entryKey: entry.entryKey,
        targetPostId: entry.targetPostId,
        languageCode: entry.languageCode,
        applyBatchId
      },
      {
        admin: options.admin
      }
    )
    if (result?.adoptionEntry) {
      appliedEntries.push(result.adoptionEntry)
    }
  }

  for (const languageCode of refreshedLanguageCodeSet) {
    await contentRefreshUtils.refreshArticlePublishing(languageCode)
  }

  const statusResult = await updateJobStatusAfterApply(job._id)

  return {
    applied: true,
    applyBatchId,
    appliedEntryKeys: appliedEntries.map(entry => entry.entryKey),
    appliedCount: appliedEntries.length,
    ...statusResult
  }
}

module.exports = {
  applyTranslationJobPayload,
  buildTranslationJobReviewSnapshot,
  buildEntryKey,
  createValueHash
}
