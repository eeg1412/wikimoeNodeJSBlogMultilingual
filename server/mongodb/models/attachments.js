const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES,
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_SOURCE_TYPE_VALUES,
  ATTACHMENT_IMPORT_ORIGIN_VALUES
} = require('@wikimoe-ml/common/constants')

// 统一登记 remote 与 localized 两类附件
// remote：原站远程附件（sourcePath/externalUrl），多语言站不复制二进制
// localized：多语言站本地上传（storagePath 指向本地文件）
const attachments = new Schema(
  {
    attachmentSourceType: {
      type: String,
      enum: ATTACHMENT_SOURCE_TYPE_VALUES,
      required: true,
      index: true
    },
    attachmentGroupKey: { type: String, default: null, index: true },

    // 远程附件：对应原站 attachments._id（若能定位）
    sourceId: { type: String, default: null, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },

    // 原站内部资源相对路径（仅 remote 且来源于原站时使用）
    sourcePath: { type: String, default: null },
    sourcePathHash: { type: String, default: null, index: true },
    // 第三方外链完整 URL
    externalUrl: { type: String, default: null },
    externalUrlHash: { type: String, default: null, index: true },

    // 展示字段
    filename: { type: String, default: '' },
    filepath: { type: String, default: '' },
    // 仅 localized 使用：本地持久化存储路径
    storagePath: { type: String, default: '' },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    filesize: { type: Number, default: 0 },
    fileHash: { type: String, default: '' },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    mimetype: { type: String, default: '', index: true },
    thumfor: { type: String, default: '' },
    thumWidth: { type: Number, default: null },
    thumHeight: { type: Number, default: null },
    albumSourceId: { type: String, default: null },
    is360Panorama: { type: Boolean, default: false },

    // 翻译站附件若由远程附件演化而来，记录原远程附件 sourceId
    derivedFromSourceId: { type: String, default: null },
    importOrigin: {
      type: String,
      enum: ATTACHMENT_IMPORT_ORIGIN_VALUES,
      required: true
    },

    sourceSnapshot: { type: Schema.Types.Mixed, default: null },
    sourceHash: { type: String, default: '', index: true },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS_VALUES,
      default: TRANSLATION_STATUS.NOT_REQUIRED,
      index: true
    },
    isManualEdited: { type: Boolean, default: false }
  },
  { timestamps: true }
)

// 有 sourceId 的远程附件：按原站附件 ID 归一
attachments.index(
  { sourceId: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $type: 'string' } }
  }
)

// 正文解析得到的原站相对路径远程附件
attachments.index(
  { sourcePathHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourcePathHash: { $type: 'string' } }
  }
)

// 正文解析得到的第三方外链远程附件
attachments.index(
  { externalUrlHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUrlHash: { $type: 'string' } }
  }
)

// 翻译站附件按 attachmentGroupKey 归组，同语言同组同类型唯一
attachments.index(
  { attachmentGroupKey: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      attachmentGroupKey: { $type: 'string' },
      attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED
    }
  }
)

module.exports = mongoose.model('attachments', attachments)
