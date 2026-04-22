const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS
} = require('../../../../common/constants/app')

function createLocalizedBaseFields(Schema, options) {
  const finalOptions = options || {}
  const fields = {
    languageCode: {
      type: String,
      required: true,
      enum: SUPPORTED_LANGUAGE_CODES,
      index: true,
      trim: true
    },
    sourceSnapshot: {
      type: Schema.Types.Mixed,
      default: null
    },
    sourceHash: {
      type: String,
      default: ''
    },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS,
      default: 'pending'
    },
    isManualEdited: {
      type: Boolean,
      default: false
    }
  }

  if (finalOptions.includeSourceId !== false) {
    fields.sourceId = {
      type: String,
      required: finalOptions.sourceIdRequired !== false,
      index: true,
      trim: true
    }
  }

  return fields
}

module.exports = createLocalizedBaseFields
