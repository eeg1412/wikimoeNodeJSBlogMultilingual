const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES
} = require('@wikimoe-ml/common/constants')

const sorts = new Schema(
  {
    sourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    sortname: { type: String, default: '' },
    alias: { type: String, default: null, index: true },
    description: { type: String, default: '' },
    template: { type: String, default: '' },
    taxis: { type: Number, default: 0, index: true },
    // 层级父级：先按 sourceId 建树，再回填本地 parent ObjectId
    parentSourceId: { type: String, default: null, index: true },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'sorts',
      default: null,
      index: true
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

sorts.index({ sourceId: 1, languageCode: 1 }, { unique: true })
sorts.index(
  { languageCode: 1, alias: 1 },
  {
    unique: true,
    partialFilterExpression: { alias: { $type: 'string', $ne: '' } }
  }
)

module.exports = mongoose.model('sorts', sorts)
