const mongoose = require('mongoose')

const createLocalizedBaseFields = require('./helpers/localizedBaseFields')

const { Schema } = mongoose

const attachmentsSchema = new Schema(
  {
    ...createLocalizedBaseFields(Schema, {
      includeSourceId: false
    }),
    attachmentSourceType: {
      type: String,
      enum: ['remote', 'localized'],
      required: true,
      index: true
    },
    attachmentGroupKey: {
      type: String,
      default: null,
      trim: true
    },
    sourceId: {
      type: String,
      default: null,
      trim: true
    },
    sourcePath: {
      type: String,
      default: null,
      trim: true
    },
    sourcePathHash: {
      type: String,
      default: null,
      trim: true
    },
    externalUrl: {
      type: String,
      default: null,
      trim: true
    },
    externalUrlHash: {
      type: String,
      default: null,
      trim: true
    },
    filename: {
      type: String,
      default: ''
    },
    filepath: {
      type: String,
      default: ''
    },
    storagePath: {
      type: String,
      default: null
    },
    name: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    filesize: {
      type: Number,
      default: 0
    },
    fileHash: {
      type: String,
      default: null
    },
    width: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    },
    mimetype: {
      type: String,
      default: ''
    },
    thumfor: {
      type: String,
      default: null
    },
    thumWidth: {
      type: Number,
      default: null
    },
    thumHeight: {
      type: Number,
      default: null
    },
    albumSourceId: {
      type: String,
      default: null
    },
    is360Panorama: {
      type: Boolean,
      default: false
    },
    derivedFromSourceId: {
      type: String,
      default: null
    },
    importOrigin: {
      type: String,
      enum: [
        'sourceAttachment',
        'htmlDiscovered',
        'localizedUpload',
        'localizedDerived'
      ],
      required: true
    }
  },
  { timestamps: true }
)

attachmentsSchema.index(
  { sourceId: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceId: { $exists: true, $ne: null }
    }
  }
)
attachmentsSchema.index(
  { sourcePathHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourcePathHash: { $exists: true, $ne: null }
    }
  }
)
attachmentsSchema.index(
  { externalUrlHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalUrlHash: { $exists: true, $ne: null }
    }
  }
)
attachmentsSchema.index(
  { attachmentGroupKey: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      attachmentGroupKey: { $exists: true, $ne: null }
    }
  }
)

module.exports = mongoose.model('attachments', attachmentsSchema)
