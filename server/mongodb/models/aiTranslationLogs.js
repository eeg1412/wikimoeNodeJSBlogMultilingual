const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')

const aiTranslationLogs = new Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    fieldPath: { type: String, default: '' },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    sourceHash: { type: String, default: '' },
    requestPayload: { type: Schema.Types.Mixed, default: null },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    normalizedResult: { type: Schema.Types.Mixed, default: null },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    promptVersion: { type: String, default: '' },
    tokenUsage: { type: Schema.Types.Mixed, default: null },
    success: { type: Boolean, default: false, index: true },
    errorMessage: { type: String, default: '' },
    operatorAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'adminUsers',
      default: null,
      index: true
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('aiTranslationLogs', aiTranslationLogs)
