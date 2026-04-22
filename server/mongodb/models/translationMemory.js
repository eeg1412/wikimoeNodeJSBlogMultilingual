import mongoose from 'mongoose'

const translationMemorySchema = new mongoose.Schema(
  {
    sourceTextHash: { type: String, required: true },
    sourceText: { type: String, required: true },
    targetLanguageCode: {
      type: String,
      required: true,
      enum: ['en', 'jp', 'tw']
    },
    fieldKind: { type: String, required: true },
    translatedText: { type: String, default: '' },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    approved: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

translationMemorySchema.index(
  { sourceTextHash: 1, targetLanguageCode: 1, fieldKind: 1 },
  { unique: true }
)

export default mongoose.model('TranslationMemory', translationMemorySchema)
