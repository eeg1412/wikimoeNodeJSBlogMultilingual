const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES
} = require('@wikimoe-ml/common/constants')

const mappoints = new Schema(
  {
    sourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    // 经纬度、zIndex、status 不翻译，只同步原值
    longitude: { type: Number, default: 0 },
    latitude: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    status: { type: Number, default: 0, index: true },
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

mappoints.index({ sourceId: 1, languageCode: 1 }, { unique: true })

module.exports = mongoose.model('mappoints', mappoints)
