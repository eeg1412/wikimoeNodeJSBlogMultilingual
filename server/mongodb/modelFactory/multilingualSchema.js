const mongoose = require('mongoose')
const { SUPPORTED_LANGUAGE_CODES } = require('../../utils/language')

const SOURCE_COLLECTIONS = [
  'posts',
  'users',
  'sorts',
  'tags',
  'mappoints',
  'attachments',
  'albums',
  'bangumis',
  'movies',
  'games',
  'gamePlatforms',
  'books',
  'booktypes',
  'events',
  'eventtypes',
  'votes'
]

const RECORD_KINDS = ['source', 'translation']
const MEDIA_MODES = ['remote', 'local']

function addFieldsOnce(schema, fields) {
  const fieldsToAdd = {}

  for (const key of Object.keys(fields)) {
    if (!schema.path(key)) {
      fieldsToAdd[key] = fields[key]
    }
  }

  if (Object.keys(fieldsToAdd).length > 0) {
    schema.add(fieldsToAdd)
  }
}

function addSourceIdentityFields(schema, collectionName) {
  addFieldsOnce(schema, {
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    sourceLanguageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    sourceCollection: {
      type: String,
      enum: SOURCE_COLLECTIONS,
      required: true,
      default: collectionName,
      index: true
    },
    sourceSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'posts',
      default: null,
      index: true
    },
    translationGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'posts',
      required: true,
      index: true
    },
    recordKind: {
      type: String,
      enum: RECORD_KINDS,
      required: true,
      index: true
    },
    snapshotVersion: {
      type: Number,
      default: 1,
      index: true
    },
    sourceSnapshotAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    sourceUpdatedAt: {
      type: Date,
      default: null
    },
    sourceHash: {
      type: String,
      default: '',
      index: true
    },
    aiTranslationSkip: {
      type: Boolean,
      default: false,
      index: true
    }
  })
}

function addLocalLanguageFields(schema) {
  addFieldsOnce(schema, {
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    recordKind: {
      type: String,
      enum: RECORD_KINDS,
      default: 'translation',
      required: true,
      index: true
    },
    translationGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    }
  })
}

function addPostReviewFields(schema) {
  addFieldsOnce(schema, {
    sourceChanged: {
      type: Boolean,
      default: false,
      index: true
    },
    pendingReview: {
      type: Boolean,
      default: false,
      index: true
    },
    sourceChangedAt: {
      type: Date,
      default: null,
      index: true
    }
  })
}

function addPostIndexes(schema) {
  schema.index(
    { sourceCollection: 1, sourceId: 1, sourceLanguageCode: 1, recordKind: 1 },
    { unique: true, partialFilterExpression: { recordKind: 'source' } }
  )
  schema.index(
    { translationGroupId: 1, languageCode: 1, recordKind: 1 },
    { unique: true, partialFilterExpression: { recordKind: 'translation' } }
  )
  schema.index(
    { languageCode: 1, alias: 1, type: 1 },
    {
      unique: true,
      partialFilterExpression: {
        recordKind: 'translation',
        alias: { $type: 'string' },
        status: { $lt: 99 }
      }
    }
  )
}

function addRelationIdentityIndex(schema) {
  schema.index(
    { sourceCollection: 1, sourceId: 1, languageCode: 1, recordKind: 1 },
    { unique: true }
  )
}

function addAttachmentMediaFields(schema) {
  addFieldsOnce(schema, {
    mediaMode: {
      type: String,
      enum: MEDIA_MODES,
      default: 'remote',
      required: true,
      index: true
    },
    remoteSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    remoteFilepath: {
      type: String,
      default: ''
    },
    remoteSnapshot: {
      type: Object,
      default: {}
    },
    localFilepath: {
      type: String,
      default: ''
    },
    localThumbnailPath: {
      type: String,
      default: ''
    },
    localStorageStatus: {
      type: String,
      default: 'none',
      index: true
    }
  })
}

function addAttachmentIndexes(schema) {
  schema.index(
    { sourceCollection: 1, sourceId: 1, languageCode: 1, mediaMode: 1 },
    { unique: true, partialFilterExpression: { mediaMode: 'remote' } }
  )
}

function addOptionsLanguageFields(schema) {
  addFieldsOnce(schema, {
    scope: {
      type: String,
      default: 'multilingual',
      required: true,
      index: true
    },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    }
  })
  schema.index({ scope: 1, languageCode: 1, name: 1 }, { unique: true })
}

module.exports = {
  SOURCE_COLLECTIONS,
  RECORD_KINDS,
  MEDIA_MODES,
  addSourceIdentityFields,
  addLocalLanguageFields,
  addPostReviewFields,
  addPostIndexes,
  addRelationIdentityIndex,
  addAttachmentMediaFields,
  addAttachmentIndexes,
  addOptionsLanguageFields
}
