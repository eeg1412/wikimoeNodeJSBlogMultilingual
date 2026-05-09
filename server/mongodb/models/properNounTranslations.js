var mongoose = require('mongoose')
var Schema = mongoose.Schema
const { SUPPORTED_LANGUAGE_CODES } = require('../../utils/language')

const TRANSLATION_SOURCES = [
  'manual',
  'internetSearchAi',
  'aiKnowledgeBase',
  'imported'
]

var properNounTranslations = new Schema(
  {
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'properNounTerms',
      required: true,
      index: true
    },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    translatedText: {
      type: String,
      required: true,
      trim: true
    },
    sourceTextSnapshot: {
      type: String,
      default: '',
      index: true
    },
    normalizedSourceTextSnapshot: {
      type: String,
      default: '',
      index: true
    },
    translationSource: {
      type: String,
      enum: TRANSLATION_SOURCES,
      default: 'manual',
      index: true
    },
    provider: {
      type: String,
      default: '',
      index: true
    },
    model: {
      type: String,
      default: ''
    },
    note: {
      type: String,
      default: ''
    },
    searchMetadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
)

properNounTranslations.index({ termId: 1, languageCode: 1 }, { unique: true })
properNounTranslations.index({ languageCode: 1, enabled: 1 })

module.exports = require('../modelFactory/defaultModel')(
  'properNounTranslations',
  properNounTranslations
)
