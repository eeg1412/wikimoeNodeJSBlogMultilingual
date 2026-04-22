import mongoose from 'mongoose'

const aiTranslationLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    fieldPath: { type: String, default: '' },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    sourceHash: { type: String, default: '' },
    requestPayload: { type: Object, default: null },
    responsePayload: { type: Object, default: null },
    normalizedResult: { type: Object, default: null },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    promptVersion: { type: String, default: '' },
    tokenUsage: { type: Object, default: null },
    success: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    operatorAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

aiTranslationLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
aiTranslationLogSchema.index({ languageCode: 1, createdAt: -1 })

export default mongoose.model('AiTranslationLog', aiTranslationLogSchema)
