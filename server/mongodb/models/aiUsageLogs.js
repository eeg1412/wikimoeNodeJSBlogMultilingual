var mongoose = require('mongoose')
var Schema = mongoose.Schema

var aiUsageLogs = new Schema(
  {
    provider: {
      type: String,
      required: true,
      index: true
    },
    model: {
      type: String,
      default: '',
      index: true
    },
    operation: {
      type: String,
      default: '',
      index: true
    },
    status: {
      type: String,
      default: 'success',
      index: true
    },
    requestId: {
      type: String,
      default: '',
      index: true
    },
    postId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    translationGroupId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    sourceSnapshotId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    sourceLanguageCode: {
      type: String,
      default: '',
      index: true
    },
    targetLanguageCode: {
      type: String,
      default: '',
      index: true
    },
    usage: {
      type: Schema.Types.Mixed,
      default: {}
    },
    tokenUsage: [
      {
        name: {
          type: String,
          required: true,
          index: true
        },
        value: {
          type: Number,
          default: 0
        }
      }
    ],
    rawResponse: {
      type: Schema.Types.Mixed,
      default: {}
    },
    rawResponseStorage: {
      type: Schema.Types.Mixed,
      default: null
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {}
    },
    date: {
      type: Date,
      expires: 31968000,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
)

module.exports = require('../modelFactory/defaultModel')(
  'aiUsageLogs',
  aiUsageLogs
)
