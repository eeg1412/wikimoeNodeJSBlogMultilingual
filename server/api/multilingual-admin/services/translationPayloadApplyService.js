const crypto = require('crypto')
const mongoose = require('mongoose')
const contentRefreshUtils = require('../../../utils/contentRefresh')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_TYPES,
  TRANSLATION_JOB_TASK_ROLES,
  TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS
} = require('../../../utils/translationJobConstants')
const relationService = require('./relationService')
const translationPostService = require('./translationPostService')
const relationArrayFieldSyncUtils = require('./relationArrayFieldSyncUtils')
const coverImageAdoptionService = require('./coverImageAdoptionService')
const {
  STRUCTURED_RICH_TEXT_VALUE_TYPE,
  renderRichTextDocumentNode
} = require('../utils/richTextDocumentUtils')

const TRANSLATION_RECORD_KIND = 'translation'
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const URL_LIST_TEXT_FIELD_NAME = 'urlList.text'
const APPLY_ALLOWED_STATUSES = new Set([
  TRANSLATION_JOB_STATUS.WAITING_REVIEW,
  TRANSLATION_JOB_STATUS.REJECTED,
  TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED,
  TRANSLATION_JOB_STATUS.FULLY_ADOPTED
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

function toOptionalObjectId(value) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }
  if (value && typeof value.toHexString === 'function') {
    return new mongoose.Types.ObjectId(value.toHexString())
  }

  const text = normalizeIdentityValue(value)
  if (!text || !mongoose.Types.ObjectId.isValid(text)) {
    return null
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

// 字符串数组字段（label [String]）目标值归一化，保持每个元素为独立字符串。
function normalizeStringListValue(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map(item => {
    if (typeof item === 'string') {
      return item
    }
    if (item === null || typeof item === 'undefined') {
      return ''
    }
    return String(item)
  })
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

function addIdentityCandidate(candidateList, value) {
  const text = normalizeIdentityValue(value)
  if (!text || candidateList.includes(text)) {
    return
  }
  candidateList.push(text)
}

function addRelationSourceIdFromEntryKey(
  candidateList,
  entryKey,
  collectionName
) {
  const keyText = normalizeIdentityValue(entryKey)
  if (!keyText || !collectionName) {
    return
  }
  const parts = keyText.split(':')
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === collectionName) {
      addIdentityCandidate(candidateList, parts[index + 1])
      return
    }
  }
}

function addRelationSourceIdFromEntryId(candidateList, entryId) {
  const idText = normalizeIdentityValue(entryId)
  const match = idText.match(/^relation\.[^.]+\.([a-f\d]{24})(\.|$)/i)
  if (!match) {
    return
  }
  addIdentityCandidate(candidateList, match[1])
}

function collectRelationSourceIdentityCandidates(entry = {}) {
  const candidateList = []
  const collectionName = normalizeIdentityValue(entry.collectionName)
  addRelationSourceIdFromEntryKey(
    candidateList,
    entry.originalEntryKey,
    collectionName
  )
  addRelationSourceIdFromEntryKey(candidateList, entry.entryKey, collectionName)
  addRelationSourceIdFromEntryId(candidateList, entry.id)
  addIdentityCandidate(candidateList, entry.sourceId)
  addIdentityCandidate(candidateList, entry.sourceRecordId)
  addIdentityCandidate(candidateList, entry.recordId)
  return candidateList
}

function buildMissingRelationRecordErrorMessage(entry = {}, languageCode) {
  const collectionName = normalizeIdentityValue(entry.collectionName)
  const fieldName = normalizeIdentityValue(entry.fieldName)
  const relationField = normalizeIdentityValue(entry.relationField)
  const label = normalizeIdentityValue(entry.label || entry.recordLabel)
  const sourceIdentityCandidates =
    collectRelationSourceIdentityCandidates(entry).join(', ') || '无'
  const detailList = [
    `目标语言：${languageCode}`,
    `集合：${collectionName || '未知'}`,
    `字段：${fieldName || '未知'}`,
    `源内容身份：${sourceIdentityCandidates}`
  ]
  if (relationField) {
    detailList.push(`关联字段：${relationField}`)
  }
  if (label) {
    detailList.push(`条目：${label}`)
  }
  return `目标语言关联内容不存在，无法采纳该翻译条目。${detailList.join('；')}。通常是目标语言版本缺少从源快照复制出的关联记录，或任务结果里的关联身份已过期；请先同步/创建该关联内容后再采纳。`
}

function buildIdentityQueryCandidates(identityValues) {
  const candidates = []
  identityValues.forEach(value => {
    buildSourceIdCandidates(value).forEach(candidate => {
      const candidateKey = String(candidate)
      const exists = candidates.some(item => String(item) === candidateKey)
      if (!exists) {
        candidates.push(candidate)
      }
    })
  })
  return candidates
}

function buildRelationRecordIdCandidates(entry = {}) {
  const idValues = []
  addIdentityCandidate(idValues, entry.targetRecordId)
  addIdentityCandidate(idValues, entry.recordId)
  return buildIdentityQueryCandidates(idValues)
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

  if (Number.isInteger(Number(entry.labelIndex))) {
    return `${fieldName}.${Number(entry.labelIndex)}`
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
  const sourceId = collectRelationSourceIdentityCandidates(entry)[0]
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
  const sourceIdentityCandidates =
    collectRelationSourceIdentityCandidates(entry)
  const sourceIdCandidates = buildIdentityQueryCandidates(
    sourceIdentityCandidates
  )
  if (!collectionName || sourceIdCandidates.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '翻译条目缺少关联内容身份',
      'sourceId',
      400
    )
  }

  const Model = getRelationRecordModel(collectionName)
  const recordIdCandidates = buildRelationRecordIdCandidates(entry)
  if (recordIdCandidates.length > 0) {
    const recordById = await Model.findOne({
      _id: { $in: recordIdCandidates },
      languageCode,
      recordKind: TRANSLATION_RECORD_KIND
    }).lean()
    if (recordById) {
      return recordById
    }
  }

  const record = await Model.findOne({
    sourceId: { $in: sourceIdCandidates },
    languageCode,
    recordKind: TRANSLATION_RECORD_KIND
  }).lean()

  if (!record) {
    throw new ApiError(
      ERROR_CODES.CONTENT_NOT_FOUND,
      buildMissingRelationRecordErrorMessage(entry, languageCode),
      'sourceId',
      404,
      {
        languageCode,
        collectionName: entry.collectionName || '',
        relationField: entry.relationField || '',
        fieldName: entry.fieldName || '',
        sourceIdentityCandidates: sourceIdentityCandidates.map(item =>
          String(item)
        )
      }
    )
  }

  return record
}

// 读取目标记录当前值（用于采纳前的冲突哈希）。数组型字段全量重建后，目标可能尚无源新增的
// index（如源新增了一条 URL / 投票选项），此时当前值视为空串，不再抛“目标项不存在”。
function getCurrentEntryValue(entry, record) {
  if (entry.collectionName === 'votes' && entry.fieldName === 'options.title') {
    const optionList = Array.isArray(record.options) ? record.options : []
    const optionId = normalizeIdentityValue(entry.optionId)
    if (optionId) {
      const matchedOption = optionList.find(
        option => String(option._id || '') === optionId
      )
      if (matchedOption) {
        return matchedOption.title || ''
      }
    }
    const optionIndex = Number(entry.optionIndex)
    if (Number.isInteger(optionIndex) && optionList[optionIndex]) {
      return optionList[optionIndex].title || ''
    }
    return ''
  }

  if (entry.fieldName === URL_LIST_TEXT_FIELD_NAME) {
    const urlList = Array.isArray(record.urlList) ? record.urlList : []
    const urlIndex = Number(entry.urlIndex)
    if (Number.isInteger(urlIndex) && urlList[urlIndex]) {
      return urlList[urlIndex].text || ''
    }
    return ''
  }

  if (Number.isInteger(Number(entry.labelIndex))) {
    const stringList = normalizeStringListValue(record[entry.fieldName])
    return stringList[Number(entry.labelIndex)] || ''
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

// 数组型字段（label / urlList / options）的“字段级分组键”（不含 index）。同一记录同一字段的
// 全部元素共享该键，用于“整组采纳”。
function getEntryArrayFieldGroupKey(entry = {}) {
  const isArrayFieldEntry =
    Number.isInteger(Number(entry.labelIndex)) ||
    Number.isInteger(Number(entry.urlIndex)) ||
    Number.isInteger(Number(entry.optionIndex))
  if (!isArrayFieldEntry) {
    return ''
  }
  const sourceId = normalizeIdentityValue(entry.sourceId)
  if (entry.scope === 'relation') {
    return [
      'relation',
      entry.relationField || '',
      entry.collectionName || '',
      sourceId,
      entry.fieldName || ''
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

// 整组采纳：用户勾选了某数组字段的任一元素，就把该字段的全部元素一并采纳，保证按源结构
// 全量重建（源有多少同步多少），不会只采纳被勾选的那一条而留下不一致的目标数组。
function expandArrayFieldSelection(selectedEntries, allEntries) {
  const selectedGroupKeys = new Set()
  selectedEntries.forEach(entry => {
    const groupKey = getEntryArrayFieldGroupKey(entry)
    if (groupKey) {
      selectedGroupKeys.add(groupKey)
    }
  })
  if (selectedGroupKeys.size === 0) {
    return selectedEntries
  }

  const seenEntryKeys = new Set(
    selectedEntries.map(entry => entry && entry.entryKey).filter(Boolean)
  )
  const expandedEntries = selectedEntries.slice()
  allEntries.forEach(entry => {
    if (!entry || !entry.entryKey || entry.aiSkipReason) {
      return
    }
    if (seenEntryKeys.has(entry.entryKey)) {
      return
    }
    const groupKey = getEntryArrayFieldGroupKey(entry)
    if (groupKey && selectedGroupKeys.has(groupKey)) {
      expandedEntries.push(entry)
      seenEntryKeys.add(entry.entryKey)
    }
  })
  return expandedEntries
}

function isSelectablePreviewEntry(entry) {
  if (!entry || !entry.entryKey || entry.aiSkipReason) {
    return false
  }

  if (entry.entryType !== 'coverImageTranslation') {
    return true
  }

  if (entry.status !== 'generated') {
    return false
  }

  return Boolean(entry.artifactId && entry.generatedCoverUrl)
}

function getSelectableEntryKeys(job) {
  const entries = Array.isArray(job.result?.previewEntries)
    ? job.result.previewEntries
    : []
  return new Set(
    entries.filter(isSelectablePreviewEntry).map(entry => entry.entryKey)
  )
}

function buildSourcePostApplyPayload(job, selectedEntries) {
  const selectedEntryMap = new Map()
  selectedEntries.forEach(entry => {
    if (!entry?.entryKey) {
      return
    }
    selectedEntryMap.set(entry.entryKey, entry)
  })
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
    const selectedPayloadEntries = (item.result.payload.entries || [])
      .map(entry => {
        if (!entry?.entryKey) {
          return null
        }
        return selectedEntryMap.get(entry.entryKey) || null
      })
      .filter(Boolean)
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
  const totalEntryKeys = getSelectableEntryKeys(job)
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
  adminSnapshot,
  admin,
  applyBatchId,
  publish,
  skipContentRefresh
}) {
  const results = buildSourcePostApplyPayload(job, selectedEntries).map(
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

  const sourceSnapshotId =
    job.source?.snapshotId || job.result?.sourceSnapshotId
  const applyResult = await translationPostService.applySourcePostAiImport(
    {
      sourceId: job.source?.postId,
      sourceLanguageCode: job.source?.languageCode,
      sourceSnapshotId,
      overwriteSourceSnapshot:
        !sourceSnapshotId && job.source?.overwriteSnapshot === true,
      results
    },
    {
      admin,
      skipContentRefresh: skipContentRefresh === true
    }
  )
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
    refreshedLanguages: Array.isArray(applyResult?.refreshedLanguages)
      ? applyResult.refreshedLanguages
      : [],
    ...statusResult
  }
}

function getSourcePostImportCoverSourceSnapshotId(job, entry) {
  const entrySourceSnapshotId = toOptionalObjectId(entry?.sourceSnapshotId)
  if (entrySourceSnapshotId) {
    return String(entrySourceSnapshotId)
  }

  // 源文章 AI 导入时，封面图预览条目（尤其是根文章封面）本身往往不携带 sourceSnapshotId
  // （快照在任务执行中才生成/确定）。此时回退到任务级源快照 job.source.snapshotId /
  // job.result.sourceSnapshotId，并按源身份匹配，避免在“采纳全部”时因缺少 ID 直接报错。
  const rootSourceSnapshotId = toOptionalObjectId(
    job?.source?.snapshotId || job?.result?.sourceSnapshotId
  )
  if (!rootSourceSnapshotId) {
    return ''
  }

  const rootSourceId = toOptionalObjectId(job?.source?.postId)
  const entrySourceId = toOptionalObjectId(entry?.sourceId)
  const entrySourcePostId = toOptionalObjectId(entry?.sourcePostId)
  const entrySourceCandidates = [entrySourceId, entrySourcePostId].filter(
    Boolean
  )
  // 条目没有任何源身份信息时，默认归属根源文章，使用任务级源快照。
  if (entrySourceCandidates.length === 0) {
    return String(rootSourceSnapshotId)
  }

  const rootIdentitySet = new Set()
  if (rootSourceId) {
    rootIdentitySet.add(String(rootSourceId))
  }
  rootIdentitySet.add(String(rootSourceSnapshotId))

  const matchesRootSource = entrySourceCandidates.some(candidate => {
    return rootIdentitySet.has(String(candidate))
  })
  if (matchesRootSource) {
    return String(rootSourceSnapshotId)
  }

  return ''
}

async function createOrGetSourcePostImportCoverTargetPost(job, entry) {
  const targetPostId = toOptionalObjectId(entry?.targetPostId)
  if (targetPostId) {
    return String(targetPostId)
  }

  const languageCode = normalizeIdentityValue(
    entry?.languageCode || job.target?.languageCode
  )
  if (!languageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      '封面图条目缺少目标语言',
      'entry.languageCode',
      400
    )
  }

  const sourceSnapshotId = getSourcePostImportCoverSourceSnapshotId(job, entry)
  if (!sourceSnapshotId) {
    return ''
  }

  try {
    const createResult = await translationPostService.createTranslationPost(
      {
        sourceSnapshotId,
        languageCode,
        copyMode: 'source'
      },
      { skipContentRefresh: true }
    )
    return String(createResult.translationPostId)
  } catch (error) {
    if (
      error?.name === 'ApiError' &&
      error.code === ERROR_CODES.TRANSLATION_EXISTS &&
      error.extra?.translationPostId
    ) {
      return String(error.extra.translationPostId)
    }
    throw error
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
    payload.options = relationArrayFieldSyncUtils.rebuildVoteOptionsFromSource(
      record.options,
      entry.sourceOptionList,
      entry.optionIndex,
      value
    )
  } else if (entry.fieldName === URL_LIST_TEXT_FIELD_NAME) {
    payload.urlList = relationArrayFieldSyncUtils.rebuildUrlListFromSource(
      record.urlList,
      entry.sourceUrlList,
      entry.urlIndex,
      value
    )
  } else if (Number.isInteger(Number(entry.labelIndex))) {
    payload[entry.fieldName] =
      relationArrayFieldSyncUtils.rebuildStringListFromSource(
        record[entry.fieldName],
        entry.sourceLabelList,
        entry.labelIndex,
        value
      )
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
      { skipContentRefresh: true, allowVoteOptionStructureReplace: true }
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

  const totalEntryKeys = getSelectableEntryKeys(job)
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

// 子任务采纳成功后重算其所属家族的 parent/root 聚合状态。单独采纳一个子任务（非“家族采纳全部”）
// 时也要让父级/祖父级跟着更新，否则会出现“子任务已完全采纳、父级仍待审核”。家族级“采纳全部”
// 会在末尾统一重算，因此通过 skipFamilyRecompute 跳过逐子任务重复重算。
async function recomputeFamilyAfterChildApply(job, skipFamilyRecompute) {
  if (skipFamilyRecompute === true) {
    return
  }
  const taskRelation = job.taskRelation || {}
  if (taskRelation.role !== TRANSLATION_JOB_TASK_ROLES.CHILD) {
    return
  }
  const rootId = taskRelation.rootId
  if (!rootId) {
    return
  }
  const translationJobService = require('./translationJobService')
  await translationJobService.recomputeFamilyAggregateStatus(String(rootId))
}

async function applyTranslationJobPayload(body = {}, options = {}) {
  const jobId = toObjectId(body.id || body.jobId, 'id', true)
  const selectedEntryKeys = normalizeSelectedEntryKeys(body.selectedEntryKeys)
  const force = body.force === true
  const forceOverwriteApplied = body.forceOverwriteApplied === true || force
  const forceReason = normalizeIdentityValue(body.forceReason)
  let publish = body.publish === true
  // 家族级"采纳全部"会逐子任务调用本函数，为避免每个子任务都重复刷新缓存/RSS/Sitemap，
  // 调用方可置 skipContentRefresh=true，由家族层在最后按去重语言统一刷新一次。
  const skipContentRefresh = body.skipContentRefresh === true
  // 家族级"采纳全部"在末尾统一重算家族聚合状态，逐子任务调用时可置 skipFamilyRecompute=true
  // 跳过重复重算；单独采纳单个子任务时不置该标志，由本函数在采纳后重算家族，保证父级跟随更新。
  const skipFamilyRecompute = body.skipFamilyRecompute === true
  const applyBatchId =
    normalizeIdentityValue(body.applyBatchId) || crypto.randomUUID()
  const adminSnapshot = normalizeAdminSnapshot(options.admin)
  const JobModel = getTranslationJobModel()
  const job = await JobModel.findOne({ _id: jobId }).lean()

  if (!job) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }

  // 创建任务时勾选"保存后发布"的语言子任务（request.options.publishOnApply=true），
  // 采纳时无论采纳页是否再次勾选发布，都按创建时的选择自动发布该语言译文。
  if (job.request?.options?.publishOnApply === true) {
    publish = true
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
  // 整组采纳：把被勾选数组字段的其余元素一并纳入，保证按源结构全量重建目标数组。
  const expandedSelectedEntries = expandArrayFieldSelection(
    selectedEntries,
    previewEntries
  )
  const selectedCoverImageEntries = expandedSelectedEntries.filter(entry => {
    return entry?.entryType === 'coverImageTranslation'
  })
  const selectedContentEntries = expandedSelectedEntries.filter(entry => {
    return entry?.entryType !== 'coverImageTranslation'
  })

  if (job.jobType === TRANSLATION_JOB_TYPES.SOURCE_POST_AI_IMPORT) {
    const appliedEntries = []
    let contentRefreshedLanguages = []
    if (selectedContentEntries.length > 0) {
      const contentApplyResult = await applySourcePostTranslationJob({
        job,
        selectedEntries: selectedContentEntries,
        adminSnapshot,
        admin: options.admin,
        applyBatchId,
        publish,
        skipContentRefresh
      })
      if (Array.isArray(contentApplyResult?.refreshedLanguages)) {
        contentRefreshedLanguages = contentApplyResult.refreshedLanguages
      }
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
      const targetPostId = await createOrGetSourcePostImportCoverTargetPost(
        job,
        entry
      )
      const result = await coverImageAdoptionService.adoptCoverImage(
        {
          jobId: job._id,
          artifactId: entry.artifactId,
          entryKey: entry.entryKey,
          targetPostId,
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
    await recomputeFamilyAfterChildApply(job, skipFamilyRecompute)
    return {
      applied: true,
      applyBatchId,
      appliedEntryKeys: appliedEntries.map(entry => entry.entryKey),
      appliedCount: appliedEntries.length,
      refreshedLanguages: contentRefreshedLanguages,
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
    if (!skipContentRefresh) {
      await contentRefreshUtils.refreshArticlePublishing(languageCode)
    }
  }

  const statusResult = await updateJobStatusAfterApply(job._id)
  await recomputeFamilyAfterChildApply(job, skipFamilyRecompute)

  return {
    applied: true,
    applyBatchId,
    appliedEntryKeys: appliedEntries.map(entry => entry.entryKey),
    appliedCount: appliedEntries.length,
    refreshedLanguages: Array.from(refreshedLanguageCodeSet),
    ...statusResult
  }
}

// 家族级"采纳全部"：UI 上对父任务聚合统一采纳，程序上逐个可采纳子任务依次 apply。
// 部分子任务失败时已成功的保留，失败项可在前端单独重试采纳；最后重算家族聚合状态。
async function applyTranslationFamilyPayload(body = {}, options = {}) {
  const translationJobService = require('./translationJobService')
  const familyAnchorId = toObjectId(body.id || body.jobId, 'id', true)
  const JobModel = getTranslationJobModel()
  const anchorJob = await JobModel.findOne({ _id: familyAnchorId }).lean()
  if (!anchorJob) {
    throw new ApiError(ERROR_CODES.TRANSLATION_JOB_NOT_FOUND)
  }
  const rootId =
    anchorJob.taskRelation && anchorJob.taskRelation.rootId
      ? anchorJob.taskRelation.rootId
      : anchorJob._id

  // 仅采纳"可人工采纳"的子任务（单语言翻译 + 封面图整理），名词整理执行即生效不参与。
  const adoptableChildren = await JobModel.find({
    'taskRelation.rootId': toObjectId(rootId),
    'taskRelation.role': TRANSLATION_JOB_TASK_ROLES.CHILD,
    'taskRelation.childKind': { $in: TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS }
  })
    .sort({ 'taskRelation.orderIndex': 1 })
    .lean()

  const selectionMap = new Map()
  if (Array.isArray(body.childSelections)) {
    body.childSelections.forEach(selection => {
      if (!selection || !selection.jobId) {
        return
      }
      selectionMap.set(
        String(selection.jobId),
        normalizeSelectedEntryKeys(selection.selectedEntryKeys)
      )
    })
  }
  const applyAll = body.applyAll === true
  const applyBatchId =
    normalizeIdentityValue(body.applyBatchId) || crypto.randomUUID()

  const childResults = []
  let successCount = 0
  let failCount = 0
  let skippedCount = 0
  // 收集所有子任务采纳过程中受影响的语言，最后统一按去重语言刷新一次缓存/RSS/Sitemap，
  // 避免逐子任务重复重置（尤其源语言会被反复刷新）。
  const refreshedLanguageSet = new Set()
  for (const child of adoptableChildren) {
    let selectedEntryKeys = selectionMap.get(String(child._id))
    if (applyAll && (!selectedEntryKeys || selectedEntryKeys.length === 0)) {
      const previewEntries = Array.isArray(child.result?.previewEntries)
        ? child.result.previewEntries
        : []
      selectedEntryKeys = previewEntries
        .filter(entry => entry && entry.entryKey && !entry.aiSkipReason)
        .map(entry => entry.entryKey)
    }
    if (!selectedEntryKeys || selectedEntryKeys.length === 0) {
      continue
    }
    if (!APPLY_ALLOWED_STATUSES.has(child.status)) {
      skippedCount += 1
      childResults.push({
        jobId: String(child._id),
        applied: false,
        skipped: true,
        reason: `当前状态不允许采纳：${child.status}`
      })
      continue
    }
    try {
      const result = await applyTranslationJobPayload(
        {
          id: child._id,
          selectedEntryKeys,
          force: body.force === true,
          publish: body.publish === true,
          applyBatchId,
          skipContentRefresh: true,
          skipFamilyRecompute: true
        },
        options
      )
      childResults.push({ jobId: String(child._id), ...result })
      if (Array.isArray(result.refreshedLanguages)) {
        result.refreshedLanguages.forEach(languageCode => {
          const normalized = String(languageCode || '').trim()
          if (normalized) {
            refreshedLanguageSet.add(normalized)
          }
        })
      }
      if (result.applied) {
        successCount += 1
      } else {
        failCount += 1
      }
    } catch (error) {
      failCount += 1
      childResults.push({
        jobId: String(child._id),
        applied: false,
        error: {
          code: error && error.code ? error.code : ERROR_CODES.INTERNAL_ERROR,
          message: error && error.message ? error.message : String(error)
        }
      })
    }
  }

  // 重算 parent/root 聚合状态（全部成功=完全采纳，部分=部分采纳）。
  await translationJobService.recomputeFamilyAggregateStatus(String(rootId))

  // 统一按去重语言刷新一次缓存/RSS/Sitemap（每种语言只刷一次，源语言也只刷一次）。
  const contentRefreshUtils = require('../../../utils/contentRefresh')
  for (const languageCode of refreshedLanguageSet) {
    try {
      await contentRefreshUtils.refreshArticlePublishing(languageCode)
    } catch (error) {
      console.error(
        '家族采纳后刷新内容失败：',
        languageCode,
        error && error.message ? error.message : error
      )
    }
  }

  return {
    familyId: String(rootId),
    applyBatchId,
    childResults,
    successCount,
    failCount,
    skippedCount,
    refreshedLanguages: Array.from(refreshedLanguageSet)
  }
}

module.exports = {
  applyTranslationJobPayload,
  applyTranslationFamilyPayload,
  buildTranslationJobReviewSnapshot,
  buildEntryKey,
  createValueHash
}
