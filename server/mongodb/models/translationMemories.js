const mongoose = require('mongoose')

const { Schema } = mongoose
const { SUPPORTED_LANGUAGE_CODES } = require('../../../common/constants/app')

const translationMemoriesSchema = new Schema(
  {
    sourceTextHash: {
      type: String,
      required: true,
      trim: true
    },
    sourceText: {
      type: String,
      required: true
    },
    targetLanguageCode: {
      type: String,
      required: true,
      enum: SUPPORTED_LANGUAGE_CODES,
      index: true
    },
    fieldKind: {
      type: String,
      required: true,
      trim: true
    },
    translatedText: {
      type: String,
      required: true
    },
    provider: {
      type: String,
      default: 'google-genai'
    },
    model: {
      type: String,
      default: null
    },
    approved: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

translationMemoriesSchema.index(
  { sourceTextHash: 1, targetLanguageCode: 1, fieldKind: 1 },
  { unique: true }
)

module.exports = mongoose.model(
  'translationMemories',
  translationMemoriesSchema
)
