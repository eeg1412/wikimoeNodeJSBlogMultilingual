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
  TranslationMemories
} = require('../mongodb/models')
const {
  authorUpdateSchema,
  sortUpdateSchema,
  tagUpdateSchema,
  mappointUpdateSchema,
  attachmentUpdateSchema,
  relatedEntityUpdateSchema
} = require('@wikimoe-ml/common/validation')
const { TRANSLATION_STATUS } = require('@wikimoe-ml/common/constants')
const { translateSegments } = require('./translationService')
const { AppError, badRequest, notFound } = require('../utils/errors')
const cacheManager = require('../utils/cache')

// 点记法读写嵌套 payload 字段
function readPath(obj, path) {
  if (!obj || !path) return undefined
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}
function writePath(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

// 实体注册表
const REGISTRY = {
  author: {
    model: Authors,
    labelField: 'nickname',
    translatableFields: ['nickname', 'description'],
    updateSchema: authorUpdateSchema,
    populate: [{ path: 'photoAttachment' }, { path: 'coverAttachment' }]
  },
  sort: {
    model: Sorts,
    labelField: 'sortname',
    translatableFields: ['sortname', 'description', 'template'],
    updateSchema: sortUpdateSchema,
    populate: []
  },
  tag: {
    model: Tags,
    labelField: 'tagname',
    translatableFields: ['tagname'],
    updateSchema: tagUpdateSchema,
    populate: []
  },
  mappoint: {
    model: Mappoints,
    labelField: 'title',
    translatableFields: ['title', 'summary'],
    updateSchema: mappointUpdateSchema,
    populate: []
  },
  attachment: {
    model: Attachments,
    labelField: 'name',
    translatableFields: ['name', 'description'],
    updateSchema: attachmentUpdateSchema,
    populate: []
  },
  bangumi: {
    model: Bangumis,
    isRelated: true,
    labelField: 'title',
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  },
  movie: {
    model: Movies,
    isRelated: true,
    labelField: 'title',
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  },
  game: {
    model: Games,
    isRelated: true,
    labelField: 'title',
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  },
  book: {
    model: Books,
    isRelated: true,
    labelField: 'title',
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  },
  event: {
    model: Events,
    isRelated: true,
    labelField: 'title',
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  },
  vote: {
    model: Votes,
    isRelated: true,
    labelField: 'title',
    // 投票只读：仅允许审批/修正文本翻译，不允许改票/期限
    updateSchema: relatedEntityUpdateSchema,
    populate: []
  }
}

function getRegistry(type) {
  const reg = REGISTRY[type]
  if (!reg) throw badRequest('未知实体类型 ' + type)
  return reg
}

// 解析该实体当前译文的字段映射 { path: text }
// - 非 related：直接读 doc 的 translatableFields
// - related：读 payload + translatableFields 数组；vote 另外读 options[].title
function collectTranslatableTexts(type, doc) {
  const reg = getRegistry(type)
  const out = {}
  if (!reg.isRelated) {
    for (const f of reg.translatableFields) {
      out[f] = typeof doc[f] === 'string' ? doc[f] : ''
    }
    return out
  }
  // related：payload + translatableFields
  const payload = doc.payload || {}
  const fields = Array.isArray(doc.translatableFields)
    ? doc.translatableFields
    : []
  for (const f of fields) {
    const v = readPath(payload, f)
    out['payload.' + f] = typeof v === 'string' ? v : ''
  }
  // votes：options[i].title
  if (type === 'vote' && Array.isArray(doc.options)) {
    doc.options.forEach((op, i) => {
      out[`options.${i}.title`] =
        op && typeof op.title === 'string' ? op.title : ''
    })
    out.title = typeof doc.title === 'string' ? doc.title : ''
  }
  return out
}

function writeTranslatableText(type, doc, path, value) {
  if (path.startsWith('payload.')) {
    if (!doc.payload || typeof doc.payload !== 'object') doc.payload = {}
    writePath(doc.payload, path.slice('payload.'.length), value)
    doc.markModified('payload')
    return
  }
  if (path.startsWith('options.')) {
    const parts = path.split('.')
    const idx = parseInt(parts[1], 10)
    const key = parts[2]
    if (!Array.isArray(doc.options) || !doc.options[idx]) return
    doc.options[idx][key] = value
    doc.markModified('options')
    return
  }
  doc[path] = value
}

async function listEntities(type, query) {
  const reg = getRegistry(type)
  const filter = {}
  if (query.languageCode) filter.languageCode = query.languageCode
  if (query.translationStatus)
    filter.translationStatus = query.translationStatus
  if (query.keyword) {
    const re = new RegExp(
      String(query.keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    const orFields = reg.isRelated
      ? ['title', 'name', 'sourceId']
      : [reg.labelField, 'sourceId']
    filter.$or = orFields.map(f => ({ [f]: re }))
  }
  const page = query.page || 1
  const limit = query.limit || 20
  const [list, total] = await Promise.all([
    reg.model
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    reg.model.countDocuments(filter)
  ])
  return { list, total, page, limit, labelField: reg.labelField }
}

async function getEntity(type, id) {
  const reg = getRegistry(type)
  let q = reg.model.findById(id)
  for (const p of reg.populate) q = q.populate(p)
  const doc = await q.lean()
  if (!doc) throw notFound('实体不存在')
  return doc
}

async function updateEntity(type, body) {
  const reg = getRegistry(type)
  const { value, error } = reg.updateSchema.validate(body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const { _id, ...rest } = value
  const doc = await reg.model.findById(_id)
  if (!doc) throw notFound('实体不存在')

  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined) continue
    if (reg.isRelated && k === 'payload') {
      doc.payload = Object.assign({}, doc.payload || {}, v)
      doc.markModified('payload')
      continue
    }
    doc[k] = v
  }
  if (rest.translationStatus === undefined) {
    // 默认：任何人工编辑都迁移到 manual_draft（除非客户端显式传递状态）
    if (doc.translationStatus !== TRANSLATION_STATUS.APPROVED) {
      doc.translationStatus = TRANSLATION_STATUS.MANUAL_DRAFT
    }
  }
  doc.isManualEdited = true
  await doc.save()
  if (doc.languageCode) {
    cacheManager.invalidateLanguage(doc.languageCode)
  }
  return doc.toObject()
}

async function approveEntity(type, id) {
  const reg = getRegistry(type)
  const doc = await reg.model.findById(id)
  if (!doc) throw notFound('实体不存在')
  doc.translationStatus = TRANSLATION_STATUS.APPROVED
  await doc.save()
  if (doc.languageCode) {
    cacheManager.invalidateLanguage(doc.languageCode)
  }
  return doc.toObject()
}

/**
 * AI 翻译指定字段集合并写回（翻译记忆复用逻辑在 translationService 内）。
 * fields 为空时默认翻译所有可翻译字段。
 */
async function translateEntityFields(type, id, fields, adminId) {
  const reg = getRegistry(type)
  const doc = await reg.model.findById(id)
  if (!doc) throw notFound('实体不存在')

  const all = collectTranslatableTexts(type, doc)
  const targets =
    Array.isArray(fields) && fields.length ? fields : Object.keys(all)

  const segments = []
  targets.forEach((path, idx) => {
    const text = all[path]
    if (typeof text !== 'string' || !text.trim()) return
    segments.push({
      segmentId: 'seg_' + idx,
      text,
      _path: path
    })
  })

  if (!segments.length) {
    return {
      translated: {},
      stats: { memoryHits: 0, aiCalls: 0, aiSegments: 0 }
    }
  }

  const { translations, stats } = await translateSegments({
    segments: segments.map(s => ({ segmentId: s.segmentId, text: s.text })),
    targetLanguageCode: doc.languageCode,
    fieldKind: 'entity:' + type,
    entityType: type,
    entityId: String(doc._id),
    fieldPath: targets.join(','),
    operatorAdminId: adminId || null
  })

  const translated = {}
  for (const s of segments) {
    const t = translations[s.segmentId]
    if (typeof t === 'string') {
      writeTranslatableText(type, doc, s._path, t)
      translated[s._path] = t
    }
  }

  if (doc.translationStatus !== TRANSLATION_STATUS.APPROVED) {
    doc.translationStatus = TRANSLATION_STATUS.AI_DRAFT
  }
  doc.isManualEdited = false
  await doc.save()
  return { translated, stats, doc: doc.toObject() }
}

async function listTranslationMemories(query) {
  const filter = {}
  if (query.targetLanguageCode)
    filter.targetLanguageCode = query.targetLanguageCode
  if (query.fieldKind) filter.fieldKind = query.fieldKind
  if (query.approved === 'true') filter.approved = true
  else if (query.approved === 'false') filter.approved = false
  if (query.keyword) {
    const re = new RegExp(
      String(query.keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    filter.$or = [{ sourceText: re }, { translatedText: re }]
  }
  const page = query.page || 1
  const limit = query.limit || 20
  const [list, total] = await Promise.all([
    TranslationMemories.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TranslationMemories.countDocuments(filter)
  ])
  return { list, total, page, limit }
}

async function deleteTranslationMemory(id) {
  const doc = await TranslationMemories.findByIdAndDelete(id)
  if (!doc) throw notFound('翻译记忆不存在')
  return true
}

module.exports = {
  REGISTRY,
  listEntities,
  getEntity,
  updateEntity,
  approveEntity,
  translateEntityFields,
  listTranslationMemories,
  deleteTranslationMemory,
  collectTranslatableTexts
}
