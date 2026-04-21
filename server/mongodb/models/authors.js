const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES
} = require('@wikimoe-ml/common/constants')

// 多语言作者展示资料（与后台登录账号 adminUsers 完全解耦）
const authors = new Schema(
  {
    sourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    nickname: { type: String, default: '' },
    description: { type: String, default: '' },
    photoAttachment: {
      type: Schema.Types.ObjectId,
      ref: 'attachments',
      default: null
    },
    coverAttachment: {
      type: Schema.Types.ObjectId,
      ref: 'attachments',
      default: null
    },
    sourceSnapshot: { type: Schema.Types.Mixed, default: null },
    sourceHash: { type: String, default: '', index: true },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS_VALUES,
      default: TRANSLATION_STATUS.PENDING,
      index: true
    },
    isManualEdited: { type: Boolean, default: false }
  },
  { timestamps: true }
)

authors.index({ sourceId: 1, languageCode: 1 }, { unique: true })

module.exports = mongoose.model('authors', authors)
