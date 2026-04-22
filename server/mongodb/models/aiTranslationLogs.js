const mongoose = require('mongoose')

const { Schema } = mongoose
const { SUPPORTED_LANGUAGE_CODES } = require('../../../common/constants/app')

const aiTranslationLogsSchema = new Schema(
  {
    entityType: {
      type: String,
      required: true
    },
    entityId: {
      type: String,
      required: true
    },
    fieldPath: {
      type: String,
      required: true
    },
    languageCode: {
      type: String,
      required: true,
      enum: SUPPORTED_LANGUAGE_CODES,
      index: true
    },
    sourceHash: {
      type: String,
      default: null
    },
    requestPayload: {
      type: Schema.Types.Mixed,
      default: null
    },
    responsePayload: {
      type: Schema.Types.Mixed,
      default: null
    },
    normalizedResult: {
      type: Schema.Types.Mixed,
      default: null
    },
    provider: {
      type: String,
      default: 'google-genai'
    },
    model: {
      type: String,
      default: null
    },
    promptVersion: {
      type: String,
      default: null
    },
    tokenUsage: {
      type: Schema.Types.Mixed,
      default: null
    },
    success: {
      type: Boolean,
      default: false
    },
    errorMessage: {
      type: String,
      default: null
    },
    operatorAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'adminUsers',
      default: null
    }
  },
  { timestamps: true }
)

aiTranslationLogsSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

module.exports = mongoose.model('aiTranslationLogs', aiTranslationLogsSchema)
