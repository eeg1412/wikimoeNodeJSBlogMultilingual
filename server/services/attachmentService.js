const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose')
const { Attachments } = require('../mongodb/models')
const env = require('../config/env')
const {
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_IMPORT_ORIGIN,
  TRANSLATION_STATUS
} = require('@wikimoe-ml/common/constants')
const { sha256Hex } = require('@wikimoe-ml/common/utils')
const {
  isSourceRelativePath
} = require('@wikimoe-ml/common/utils/sourceUrlNormalizer')
const { badRequest, notFound, conflict } = require('../utils/errors')

const STORAGE_ROOT = path.resolve(
  __dirname,
  '..',
  env.LOCAL_ATTACHMENT_STORAGE_DIR
)

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function buildLocalizedSubPath() {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return path.posix.join(y, m)
}

function toPublicPath(relativeFsPath) {
  const prefix = env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH.replace(/\/+$/, '')
  const unix = relativeFsPath.split(path.sep).join('/')
  return `${prefix}/${unix.replace(/^\/+/, '')}`
}

function hashOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function normalizeInputSourcePath(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (trimmed.charAt(0) !== '/') return null
  return trimmed
}

/**
 * 列表查询：按 attachmentSourceType/languageCode/keyword/mimetypePrefix 过滤
 */
async function listAttachments(query) {
  const filter = {}
  if (query.ids) {
    const ids = String(query.ids)
      .split(',')
      .map(s => s.trim())
      .filter(s => mongoose.isValidObjectId(s))
    if (!ids.length) {
      return { list: [], total: 0, page: 1, limit: query.limit || 20 }
    }
    filter._id = { $in: ids }
  }
  if (query.attachmentSourceType) {
    filter.attachmentSourceType = query.attachmentSourceType
  }
  if (query.languageCode) {
    filter.languageCode = query.languageCode
  }
  if (query.translationStatus) {
    filter.translationStatus = query.translationStatus
  }
  if (query.mimetypePrefix) {
    filter.mimetype = { $regex: '^' + query.mimetypePrefix }
  }
  if (query.keyword) {
    const kw = query.keyword.trim()
    if (kw) {
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [
        { filename: re },
        { name: re },
        { description: re },
        { sourcePath: re },
        { externalUrl: re }
      ]
    }
  }

  const page = query.page || 1
  const limit = query.limit || 20
  const [list, total] = await Promise.all([
    Attachments.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Attachments.countDocuments(filter)
  ])
  return { list, total, page, limit }
}

/**
 * 本地上传：存文件到 LOCAL_ATTACHMENT_STORAGE_DIR/YYYY/MM/<hash>.<ext>
 * 同 fileHash+languageCode+localized 唯一 → 冲突返回现有记录
 */
async function uploadLocalizedAttachment({
  buffer,
  originalName,
  mimetype,
  languageCode,
  width,
  height,
  name,
  description
}) {
  if (!buffer || !buffer.length) {
    throw badRequest('上传文件为空')
  }
  const fileHash = hashOf(buffer)

  const existing = await Attachments.findOne({
    fileHash,
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED
  })
  if (existing) {
    return { attachment: existing.toObject(), reused: true }
  }

  const subDir = buildLocalizedSubPath()
  const ext = path.extname(originalName || '') || guessExtFromMime(mimetype)
  const fileName = `${fileHash}${ext}`
  const relPath = path.join(subDir, fileName)
  const absPath = path.join(STORAGE_ROOT, relPath)
  ensureDir(path.dirname(absPath))
  fs.writeFileSync(absPath, buffer)

  const publicPath = toPublicPath(relPath)

  const attachmentGroupKey = fileHash

  const doc = await Attachments.create({
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED,
    attachmentGroupKey,
    sourceId: null,
    languageCode,
    sourcePath: null,
    sourcePathHash: null,
    externalUrl: null,
    externalUrlHash: null,
    filename: originalName || fileName,
    filepath: publicPath,
    storagePath: publicPath,
    name: name || '',
    description: description || '',
    filesize: buffer.length,
    fileHash,
    width: width || null,
    height: height || null,
    mimetype: mimetype || '',
    thumfor: '',
    importOrigin: ATTACHMENT_IMPORT_ORIGIN.LOCALIZED_UPLOAD,
    translationStatus: TRANSLATION_STATUS.NOT_REQUIRED,
    isManualEdited: true
  })

  return { attachment: doc.toObject(), reused: false }
}

function guessExtFromMime(mimetype) {
  if (!mimetype) return ''
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg'
  }
  return map[mimetype] || ''
}

/**
 * 登记一个 remote 附件（编辑器中输入原站资源路径或第三方 URL 时）
 */
async function registerRemoteAttachment(input) {
  const {
    sourcePath,
    externalUrl,
    languageCode,
    filename,
    name,
    description,
    mimetype,
    width,
    height
  } = input

  if (sourcePath) {
    const normalized = normalizeInputSourcePath(sourcePath)
    if (!normalized) {
      throw badRequest('sourcePath 无效')
    }
    if (!isSourceRelativePath(normalized.split('?')[0].split('#')[0])) {
      throw badRequest('sourcePath 不在原站白名单前缀内')
    }
    const sourcePathHash = sha256Hex(normalized)
    const existing = await Attachments.findOne({
      sourcePathHash,
      languageCode,
      attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
    })
    if (existing) {
      return { attachment: existing.toObject(), reused: true }
    }
    const doc = await Attachments.create({
      attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
      sourceId: null,
      languageCode,
      sourcePath: normalized,
      sourcePathHash,
      externalUrl: null,
      externalUrlHash: null,
      filename: filename || path.basename(normalized),
      filepath: normalized,
      storagePath: '',
      name: name || '',
      description: description || '',
      filesize: 0,
      fileHash: '',
      width: width || null,
      height: height || null,
      mimetype: mimetype || '',
      thumfor: '',
      importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
      translationStatus: TRANSLATION_STATUS.NOT_REQUIRED,
      isManualEdited: true
    })
    return { attachment: doc.toObject(), reused: false }
  }

  // externalUrl 分支
  const externalUrlHash = sha256Hex(externalUrl)
  const existing = await Attachments.findOne({
    externalUrlHash,
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
  })
  if (existing) {
    return { attachment: existing.toObject(), reused: true }
  }
  const doc = await Attachments.create({
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
    sourceId: null,
    languageCode,
    sourcePath: null,
    sourcePathHash: null,
    externalUrl,
    externalUrlHash,
    filename: filename || '',
    filepath: externalUrl,
    storagePath: '',
    name: name || '',
    description: description || '',
    filesize: 0,
    fileHash: '',
    width: width || null,
    height: height || null,
    mimetype: mimetype || '',
    thumfor: '',
    importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
    translationStatus: TRANSLATION_STATUS.NOT_REQUIRED,
    isManualEdited: true
  })
  return { attachment: doc.toObject(), reused: false }
}

async function getAttachment(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw badRequest('非法的附件 ID')
  }
  const doc = await Attachments.findById(id).lean()
  if (!doc) throw notFound('附件不存在')
  return doc
}

async function updateAttachmentMeta(id, patch) {
  const doc = await Attachments.findById(id)
  if (!doc) throw notFound('附件不存在')
  const allowed = ['name', 'description', 'filename', 'width', 'height']
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      doc[key] = patch[key]
    }
  }
  doc.isManualEdited = true
  await doc.save()
  return doc.toObject()
}

async function deleteAttachment(id) {
  const doc = await Attachments.findById(id)
  if (!doc) throw notFound('附件不存在')
  // 仅允许删 localized 实体文件；remote 允许删登记
  if (
    doc.attachmentSourceType === ATTACHMENT_SOURCE_TYPE.LOCALIZED &&
    doc.storagePath
  ) {
    const prefix = env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH.replace(/\/+$/, '')
    const rel = doc.storagePath.replace(prefix, '').replace(/^\/+/, '')
    const abs = path.join(STORAGE_ROOT, rel)
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs)
    } catch (_) {}
  }
  await doc.deleteOne()
  return { _id: id }
}

module.exports = {
  listAttachments,
  uploadLocalizedAttachment,
  registerRemoteAttachment,
  getAttachment,
  updateAttachmentMeta,
  deleteAttachment
}
