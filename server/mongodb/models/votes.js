const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES
} = require('@wikimoe-ml/common/constants')

// 投票只读：展示标题和选项文本，禁止任何写入。
const VoteOptionSchema = new Schema(
  {
    sourceOptionId: { type: String, required: true },
    title: { type: String, default: '' },
    sort: { type: Number, default: 0 }
  },
  { _id: false }
)

const votes = new Schema(
  {
    sourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    title: { type: String, default: '' },
    options: [VoteOptionSchema],
    // 以下字段只作为只读信息展示，不参与任何投票写入
    maxSelect: { type: Number, default: 1 },
    showResultAfter: { type: Boolean, default: false },
    endTime: { type: Date, default: null },
    status: { type: Number, default: 0 },

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

votes.index({ sourceId: 1, languageCode: 1 }, { unique: true })

module.exports = mongoose.model('votes', votes)
