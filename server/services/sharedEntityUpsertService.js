const {
  Authors,
  Sorts,
  Tags,
  Mappoints,
  Attachments,
  Bangumis,
  Movies,
  Games,
  Books,
  Events,
  Votes,
  Posts
} = require('../mongodb/models')
const {
  TRANSLATION_STATUS,
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_IMPORT_ORIGIN,
  POST_STATUS_DRAFT
} = require('@wikimoe-ml/common/constants')
const { stableObjectHash, sha256Hex } = require('@wikimoe-ml/common/utils/hash')

function computeHash(snapshot) {
  if (snapshot === null || snapshot === undefined) return ''
  return stableObjectHash(snapshot)
}

/**
 * 记录 outdated 告警到 warnings 数组
 */
function pushOutdatedWarning(warnings, entityType, sourceId) {
  if (!Array.isArray(warnings)) return
  warnings.push({
    code: 'SHARED_ENTITY_OUTDATED',
    entityType,
    sourceId,
    message:
      '共享实体 ' +
      entityType +
      '/' +
      sourceId +
      ' 源内容已变更，已标记为 outdated。'
  })
}

/**
 * 通用：按 (sourceId, languageCode) 唯一键 upsert。
 * 规则：
 *  - 新建：translationStatus = initialStatus
 *  - 已存在且 hash 相同：noop
 *  - 已存在且 hash 不同：
 *      approved → outdated 告警但不覆盖 title/name 字段的人工结果
 *      stub     → 变为 pending，同时写入 snapshot 的基础字段
 *      其它     → 更新 snapshot/hash，保持 status
 * 返回 { doc, status: 'created'|'noop'|'outdated'|'updated'|'stub-upgraded' }
 */
async function baseUpsert(Model, identity, snapshot, options) {
  const opts = options || {}
  const initialStatus = opts.initialStatus || TRANSLATION_STATUS.PENDING
  const baseFields = opts.baseFields || {}
  const warnings = opts.warnings
  const entityType = opts.entityType || Model.modelName
  const hash = computeHash(snapshot)

  const existing = await Model.findOne(identity).exec()

  if (!existing) {
    if (snapshot === null || snapshot === undefined) {
      // stub 建档
      const stubDoc = new Model(
        Object.assign({}, identity, baseFields, {
          sourceSnapshot: null,
          sourceHash: '',
          translationStatus: TRANSLATION_STATUS.STUB,
          isManualEdited: false
        })
      )
      await stubDoc.save()
      return { doc: stubDoc, status: 'created-stub' }
    }
    const newDoc = new Model(
      Object.assign({}, identity, baseFields, {
        sourceSnapshot: snapshot,
        sourceHash: hash,
        translationStatus: initialStatus,
        isManualEdited: false
      })
    )
    await newDoc.save()
    return { doc: newDoc, status: 'created' }
  }

  if (snapshot === null || snapshot === undefined) {
    // 只是来注册/引用已有实体
    return { doc: existing, status: 'noop' }
  }

  if (existing.sourceHash === hash) {
    return { doc: existing, status: 'noop' }
  }

  // hash 不同
  existing.sourceSnapshot = snapshot
  existing.sourceHash = hash

  if (existing.translationStatus === TRANSLATION_STATUS.STUB) {
    Object.assign(existing, baseFields)
    existing.translationStatus = initialStatus
    await existing.save()
    return { doc: existing, status: 'stub-upgraded' }
  }

  if (existing.translationStatus === TRANSLATION_STATUS.APPROVED) {
    existing.translationStatus = TRANSLATION_STATUS.OUTDATED
    await existing.save()
    pushOutdatedWarning(warnings, entityType, String(identity.sourceId))
    return { doc: existing, status: 'outdated' }
  }

  // pending / ai_draft / manual_draft / not_required / outdated → 仅更新 snapshot
  await existing.save()
  return { doc: existing, status: 'updated' }
}

/* ========== 各实体的 upsert ========== */

async function upsertAuthor(authorInput, languageCode, ctx) {
  if (!authorInput || !authorInput.sourceId) return null
  const { sourceId, payload } = authorInput
  const res = await baseUpsert(Authors, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields: payload
      ? {
          nickname: payload.nickname || '',
          description: payload.description || ''
        }
      : {},
    warnings: ctx && ctx.warnings,
    entityType: 'author'
  })
  return res.doc._id
}

async function upsertTag(tagInput, languageCode, ctx) {
  if (!tagInput || !tagInput.sourceId) return null
  const { sourceId, payload } = tagInput
  const res = await baseUpsert(Tags, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields: payload
      ? {
          tagname: payload.tagname || '',
          lastusetime: payload.lastusetime || null
        }
      : {},
    warnings: ctx && ctx.warnings,
    entityType: 'tag'
  })
  return res.doc._id
}

async function upsertMappoint(mpInput, languageCode, ctx) {
  if (!mpInput || !mpInput.sourceId) return null
  const { sourceId, payload } = mpInput
  const res = await baseUpsert(Mappoints, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields: payload
      ? {
          title: payload.title || '',
          summary: payload.summary || '',
          longitude: payload.longitude || 0,
          latitude: payload.latitude || 0,
          zIndex: payload.zIndex || 0,
          status: payload.status || 0
        }
      : {},
    warnings: ctx && ctx.warnings,
    entityType: 'mappoint'
  })
  return res.doc._id
}

async function upsertSort(sortInput, languageCode, ctx) {
  if (!sortInput || !sortInput.sourceId) return null
  const { sourceId, payload, parentSourceId } = sortInput
  const baseFields = payload
    ? {
        sortname: payload.sortname || '',
        alias: payload.alias || null,
        description: payload.description || '',
        template: payload.template || '',
        taxis: payload.taxis || 0,
        parentSourceId: parentSourceId || null
      }
    : { parentSourceId: parentSourceId || null }
  const res = await baseUpsert(Sorts, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields,
    warnings: ctx && ctx.warnings,
    entityType: 'sort'
  })
  // 父级 sort 仅做 stub 登记（详细数据需要通过管理页或后续导入补齐）
  if (parentSourceId) {
    const parentRes = await baseUpsert(
      Sorts,
      { sourceId: parentSourceId, languageCode },
      null,
      { warnings: ctx && ctx.warnings, entityType: 'sort' }
    )
    if (
      res.doc.parent == null ||
      String(res.doc.parent) !== String(parentRes.doc._id)
    ) {
      res.doc.parent = parentRes.doc._id
      await res.doc.save()
    }
  } else if (res.doc.parent) {
    res.doc.parent = null
    await res.doc.save()
  }
  return res.doc._id
}

function relatedEntityModel(kind) {
  switch (kind) {
    case 'bangumi':
      return Bangumis
    case 'movie':
      return Movies
    case 'game':
      return Games
    case 'book':
      return Books
    case 'event':
      return Events
    default:
      return null
  }
}

async function upsertRelatedEntity(kind, entityInput, languageCode, ctx) {
  if (!entityInput || !entityInput.sourceId) return null
  const Model = relatedEntityModel(kind)
  if (!Model) return null
  const { sourceId, payload, translatableFields, title, name } = entityInput
  const baseFields = payload
    ? {
        title: title || '',
        name: name || '',
        payload: payload,
        translatableFields: translatableFields || []
      }
    : {}
  const res = await baseUpsert(Model, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields,
    warnings: ctx && ctx.warnings,
    entityType: kind
  })
  return res.doc._id
}

async function upsertVote(voteInput, languageCode, ctx) {
  if (!voteInput || !voteInput.sourceId) return null
  const { sourceId, payload } = voteInput
  const baseFields = payload
    ? {
        title: payload.title || '',
        options: Array.isArray(payload.options) ? payload.options : [],
        maxSelect: payload.maxSelect || 1,
        showResultAfter: !!payload.showResultAfter,
        endTime: payload.endTime || null,
        status: payload.status || 0
      }
    : {}
  const res = await baseUpsert(Votes, { sourceId, languageCode }, payload, {
    initialStatus: TRANSLATION_STATUS.PENDING,
    baseFields,
    warnings: ctx && ctx.warnings,
    entityType: 'vote'
  })
  return res.doc._id
}

/* ========== 附件相关 ========== */

async function upsertRemoteAttachmentBySourceId(
  attachmentInput,
  languageCode,
  ctx
) {
  if (!attachmentInput || !attachmentInput.sourceId) return null
  const { sourceId, payload } = attachmentInput
  const baseFields = payload
    ? {
        filename: payload.filename || '',
        filepath: payload.filepath || '',
        name: payload.name || '',
        description: payload.description || '',
        filesize: payload.filesize || 0,
        fileHash: payload.fileHash || '',
        width: payload.width || null,
        height: payload.height || null,
        mimetype: payload.mimetype || '',
        thumfor: payload.thumfor || '',
        thumWidth: payload.thumWidth || null,
        thumHeight: payload.thumHeight || null,
        albumSourceId: payload.albumSourceId || null,
        is360Panorama: !!payload.is360Panorama
      }
    : {}
  // 若 filepath 存在且是相对路径，登记 sourcePath + sourcePathHash
  if (payload && payload.filepath && payload.filepath.charAt(0) === '/') {
    baseFields.sourcePath = payload.filepath
    baseFields.sourcePathHash = sha256Hex(payload.filepath)
  }
  const identity = {
    sourceId,
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
  }
  const res = await baseUpsert(Attachments, identity, payload, {
    initialStatus: TRANSLATION_STATUS.NOT_REQUIRED,
    baseFields: Object.assign(
      { importOrigin: ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT },
      baseFields
    ),
    warnings: ctx && ctx.warnings,
    entityType: 'attachment'
  })
  return res.doc._id
}

async function upsertRemoteAttachmentByRelativePath(
  relativePath,
  languageCode
) {
  if (!relativePath) return null
  const sourcePathHash = sha256Hex(relativePath)
  const identity = {
    sourcePathHash,
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
  }
  const existing = await Attachments.findOne(identity).exec()
  if (existing) return existing._id

  const doc = new Attachments({
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
    sourceId: null,
    languageCode,
    sourcePath: relativePath,
    sourcePathHash,
    filename: relativePath.split('/').pop() || '',
    filepath: relativePath,
    importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
    sourceSnapshot: { sourcePath: relativePath },
    sourceHash: sourcePathHash,
    translationStatus: TRANSLATION_STATUS.NOT_REQUIRED
  })
  await doc.save()
  return doc._id
}

async function upsertRemoteAttachmentByExternalUrl(externalUrl, languageCode) {
  if (!externalUrl) return null
  const externalUrlHash = sha256Hex(externalUrl)
  const identity = {
    externalUrlHash,
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
  }
  const existing = await Attachments.findOne(identity).exec()
  if (existing) return existing._id

  const doc = new Attachments({
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
    sourceId: null,
    languageCode,
    externalUrl,
    externalUrlHash,
    filename: externalUrl.split('/').pop() || '',
    filepath: externalUrl,
    importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
    sourceSnapshot: { externalUrl: externalUrl },
    sourceHash: externalUrlHash,
    translationStatus: TRANSLATION_STATUS.NOT_REQUIRED
  })
  await doc.save()
  return doc._id
}

/* ========== 关联文章（postList/tweetList & contentPostList/Tweet）stub ========== */

async function upsertPostStub(relatedPost, languageCode, ctx) {
  if (!relatedPost || !relatedPost.sourceId) return null
  const { sourceId, type, payload } = relatedPost
  const existing = await Posts.findOne({ sourceId, languageCode }).exec()
  if (existing) {
    return existing._id
  }
  // 创建 stub post：必要字段给默认值
  const stub = new Posts({
    sourceId,
    sourceAlias: payload && payload.alias ? payload.alias : null,
    groupSourceId: sourceId,
    languageCode,
    type: type === 2 ? 2 : 1,
    title: '',
    excerpt: '',
    content: '',
    alias: null,
    date: payload && payload.date ? payload.date : Date.now(),
    status: POST_STATUS_DRAFT,
    allowRemark: false,
    sourceSnapshot: payload || null,
    sourceHash: computeHash(payload || null),
    translationStatus: TRANSLATION_STATUS.STUB,
    isManualEdited: false
  })
  try {
    await stub.save()
  } catch (err) {
    // 竞态下可能被并发写入；重新查询
    if (err && err.code === 11000) {
      const existed = await Posts.findOne({ sourceId, languageCode }).exec()
      if (existed) return existed._id
    }
    throw err
  }
  if (ctx && Array.isArray(ctx.warnings)) {
    ctx.warnings.push({
      code: 'RELATED_POST_STUB_CREATED',
      sourceId,
      message: '关联文章 ' + sourceId + ' 不存在译文，已创建 stub。'
    })
  }
  return stub._id
}

/* ========== 批量便捷封装 ========== */

async function upsertMany(list, fn, languageCode, ctx) {
  if (!Array.isArray(list) || list.length === 0) return []
  const ids = []
  for (let i = 0; i < list.length; i++) {
    const id = await fn(list[i], languageCode, ctx)
    if (id) ids.push(id)
  }
  return ids
}

module.exports = {
  upsertAuthor,
  upsertSort,
  upsertTag,
  upsertMappoint,
  upsertRelatedEntity,
  upsertVote,
  upsertRemoteAttachmentBySourceId,
  upsertRemoteAttachmentByRelativePath,
  upsertRemoteAttachmentByExternalUrl,
  upsertPostStub,
  upsertMany
}
