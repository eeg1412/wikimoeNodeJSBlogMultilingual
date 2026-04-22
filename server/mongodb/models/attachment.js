import mongoose from 'mongoose'
import {
  TRANSLATION_STATUS,
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_IMPORT_ORIGIN
} from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)
const attachmentSourceTypeEnum = Object.values(ATTACHMENT_SOURCE_TYPE)
const importOriginEnum = Object.values(ATTACHMENT_IMPORT_ORIGIN)

const attachmentSchema = new mongoose.Schema(
  {
    /** 'remote' | 'localized' */
    attachmentSourceType: {
      type: String,
      required: true,
      enum: attachmentSourceTypeEnum
    },
    /**
     * 同一概念媒体的不同语言版本归组键
     * 原站同步 remote 附件使用原 attachment sourceId，
     * 翻译站 localized 附件使用手动或系统生成的 groupKey
     */
    attachmentGroupKey: { type: String, required: true },
    /** 原站实体 ID（remote 必填） */
    sourceId: { type: String, default: '' },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    /** 原站内部资源相对路径（remote 且来源原站时使用） */
    sourcePath: { type: String, default: '' },
    sourcePathHash: { type: String, default: '' },
    /** 第三方外链完整 URL（remote 且来源第三方时使用） */
    externalUrl: { type: String, default: '' },
    externalUrlHash: { type: String, default: '' },
    filename: { type: String, default: '' },
    /** 公开访问相对路径，不保存完整原站 URL */
    filepath: { type: String, default: '' },
    /** 翻译站附件本地存储相对路径 */
    storagePath: { type: String, default: '' },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    filesize: { type: Number, default: 0 },
    fileHash: { type: String, default: '' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    mimetype: { type: String, default: '' },
    thumfor: { type: String, default: '' },
    thumWidth: { type: Number, default: 0 },
    thumHeight: { type: Number, default: 0 },
    albumSourceId: { type: String, default: '' },
    is360Panorama: { type: Boolean, default: false },
    /** 若翻译站附件由远程附件演化而来，记录原远程附件 sourceId */
    derivedFromSourceId: { type: String, default: '' },
    importOrigin: {
      type: String,
      enum: importOriginEnum,
      default: 'htmlDiscovered'
    },
    sourceSnapshot: { type: Object, default: null },
    sourceHash: { type: String, default: '' },
    translationStatus: {
      type: String,
      enum: translationStatusEnum,
      default: TRANSLATION_STATUS.NOT_REQUIRED
    },
    isManualEdited: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

// 有 sourceId 的原站 remote 附件
attachmentSchema.index(
  { sourceId: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $type: 'string', $gt: '' } }
  }
)
// 从正文中解析出的无 sourceId 原站资源
attachmentSchema.index(
  { sourcePathHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourcePathHash: { $type: 'string', $gt: '' } }
  }
)
// 第三方外链资源
attachmentSchema.index(
  { externalUrlHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUrlHash: { $type: 'string', $gt: '' } }
  }
)
// 翻译站附件的语言版本归组
attachmentSchema.index(
  { attachmentGroupKey: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      attachmentSourceType: 'localized',
      attachmentGroupKey: { $type: 'string', $gt: '' }
    }
  }
)

export default mongoose.model('Attachment', attachmentSchema)
