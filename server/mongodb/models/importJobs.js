const mongoose = require('mongoose')

const { Schema } = mongoose

const importJobsSchema = new Schema(
  {
    sourceIdentifier: {
      type: String,
      required: true,
      trim: true
    },
    sourceResolvedId: {
      type: String,
      default: null,
      trim: true
    },
    languageCode: {
      type: String,
      required: true,
      index: true
    },
    operatorAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'adminUsers',
      default: null
    },
    status: {
      type: String,
      enum: ['running', 'success', 'failed', 'cancelled'],
      required: true,
      index: true
    },
    stage: {
      type: String,
      enum: [
        'resolveSource',
        'extractDependencies',
        'upsertSharedEntities',
        'upsertPost',
        'finalize'
      ],
      required: true
    },
    sourcePayload: {
      type: Schema.Types.Mixed,
      default: null
    },
    sourcePayloadHash: {
      type: String,
      default: null
    },
    resultPostId: {
      type: Schema.Types.ObjectId,
      ref: 'posts',
      default: null
    },
    warnings: {
      type: [String],
      default: []
    },
    errors: {
      type: [String],
      default: []
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    finishedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

importJobsSchema.index(
  { sourceResolvedId: 1, languageCode: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'running',
      sourceResolvedId: { $exists: true, $ne: null }
    }
  }
)

module.exports = mongoose.model('importJobs', importJobsSchema)
