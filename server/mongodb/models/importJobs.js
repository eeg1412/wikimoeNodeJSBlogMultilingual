const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  IMPORT_JOB_STATUS_VALUES,
  IMPORT_JOB_STAGE_VALUES
} = require('@wikimoe-ml/common/constants')

const importJobs = new Schema(
  {
    sourceIdentifier: { type: String, required: true, index: true },
    sourceResolvedId: { type: String, default: null, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    operatorAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'adminUsers',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: IMPORT_JOB_STATUS_VALUES,
      required: true,
      index: true
    },
    stage: {
      type: String,
      enum: IMPORT_JOB_STAGE_VALUES,
      default: null
    },
    sourcePayload: { type: Schema.Types.Mixed, default: null },
    sourcePayloadHash: { type: String, default: '', index: true },
    resultPostId: {
      type: Schema.Types.ObjectId,
      ref: 'posts',
      default: null
    },
    warnings: { type: Array, default: [] },
    errorList: { type: Array, default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

importJobs.index({ sourceResolvedId: 1, languageCode: 1, status: 1 })

module.exports = mongoose.model('importJobs', importJobs)
