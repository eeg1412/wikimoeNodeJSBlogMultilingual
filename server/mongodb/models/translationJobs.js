var mongoose = require('mongoose')
var Schema = mongoose.Schema
const {
  TRANSLATION_JOB_TYPE_VALUES,
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_STATUS_VALUES
} = require('../../utils/translationJobConstants')

const adminSnapshotSchema = new Schema(
  {
    id: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    username: {
      type: String,
      default: ''
    },
    displayName: {
      type: String,
      default: ''
    }
  },
  { _id: false }
)

const jobLogSchema = new Schema(
  {
    message: {
      type: String,
      default: ''
    },
    level: {
      type: String,
      default: 'info',
      index: true
    },
    stage: {
      type: String,
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
)

const checkpointSchema = new Schema(
  {
    stage: {
      type: String,
      required: true,
      index: true
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    stateHash: {
      type: String,
      default: '',
      index: true
    },
    stateSummary: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
)

const attemptSchema = new Schema(
  {
    attemptNo: {
      type: Number,
      required: true,
      index: true
    },
    workerId: {
      type: String,
      default: '',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    heartbeatAt: {
      type: Date,
      default: null
    },
    finishedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      default: 'running',
      index: true
    },
    stage: {
      type: String,
      default: ''
    },
    requestIds: {
      type: [String],
      default: []
    },
    error: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
)

const adoptionEntrySchema = new Schema(
  {
    entryKey: {
      type: String,
      required: true,
      index: true
    },
    scope: {
      type: String,
      default: '',
      index: true
    },
    collectionName: {
      type: String,
      default: '',
      index: true
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    recordId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    fieldName: {
      type: String,
      default: ''
    },
    fieldKey: {
      type: String,
      default: '',
      index: true
    },
    optionIndex: {
      type: Number,
      default: null
    },
    urlIndex: {
      type: Number,
      default: null
    },
    applied: {
      type: Boolean,
      default: false,
      index: true
    },
    appliedAt: {
      type: Date,
      default: null
    },
    appliedBy: {
      type: adminSnapshotSchema,
      default: null
    },
    applyBatchId: {
      type: String,
      default: '',
      index: true
    },
    sourceSnapshotVersionAtApply: {
      type: Number,
      default: null
    },
    currentValueHashAtApply: {
      type: String,
      default: ''
    },
    forced: {
      type: Boolean,
      default: false
    },
    forceReason: {
      type: String,
      default: ''
    },
    conflict: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
)

const translationJobs = new Schema(
  {
    jobType: {
      type: String,
      required: true,
      enum: TRANSLATION_JOB_TYPE_VALUES,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: TRANSLATION_JOB_STATUS_VALUES,
      default: TRANSLATION_JOB_STATUS.PENDING,
      index: true
    },
    queueControl: {
      active: {
        type: Boolean,
        default: true,
        index: true
      },
      deferred: {
        type: Boolean,
        default: false,
        index: true
      },
      priority: {
        type: Number,
        default: 0,
        index: true
      }
    },
    source: {
      postId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      contentId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      collectionName: {
        type: String,
        default: '',
        index: true
      },
      languageCode: {
        type: String,
        default: '',
        index: true
      },
      snapshotId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      snapshotVersion: {
        type: Number,
        default: null
      },
      overwriteSnapshot: {
        type: Boolean,
        default: false
      },
      sourceUpdatedAt: {
        type: Date,
        default: null
      },
      title: {
        type: String,
        default: ''
      },
      meta: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    target: {
      postId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      contentId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      collectionName: {
        type: String,
        default: '',
        index: true
      },
      languageCode: {
        type: String,
        default: '',
        index: true
      },
      languageCodes: {
        type: [String],
        default: [],
        index: true
      },
      title: {
        type: String,
        default: ''
      },
      meta: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    request: {
      selectedEntryKeys: {
        type: [String],
        default: []
      },
      prompt: {
        type: String,
        default: ''
      },
      baseMode: {
        type: String,
        default: ''
      },
      targetLanguageCodes: {
        type: [String],
        default: []
      },
      recursion: {
        maxDepth: {
          type: Number,
          default: 3
        }
      },
      entries: {
        type: [Schema.Types.Mixed],
        default: []
      },
      options: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    taskRelation: {
      role: {
        type: String,
        enum: ['root', 'parent', 'child'],
        default: 'root',
        index: true
      },
      rootId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      parentId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      depth: {
        type: Number,
        default: 1,
        index: true
      },
      sourcePostId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      childJobIds: {
        type: [Schema.Types.ObjectId],
        default: []
      },
      plannedRelatedSourceIdsByLanguage: {
        type: Schema.Types.Mixed,
        default: {}
      },
      plan: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    progress: {
      currentStep: {
        type: String,
        default: ''
      },
      currentStage: {
        type: String,
        default: ''
      },
      totalSteps: {
        type: Number,
        default: 0
      },
      completedSteps: {
        type: Number,
        default: 0
      },
      percent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      recentLogs: {
        type: [jobLogSchema],
        default: []
      },
      completedStages: {
        type: [String],
        default: []
      },
      stageState: {
        type: Schema.Types.Mixed,
        default: {}
      },
      checkpoints: {
        type: [checkpointSchema],
        default: []
      }
    },
    runtime: {
      attempts: {
        type: Number,
        default: 0,
        index: true
      },
      lockedBy: {
        type: String,
        default: '',
        index: true
      },
      workerId: {
        type: String,
        default: '',
        index: true
      },
      lockedAt: {
        type: Date,
        default: null
      },
      startedAt: {
        type: Date,
        default: null
      },
      finishedAt: {
        type: Date,
        default: null
      },
      heartbeatAt: {
        type: Date,
        default: null,
        index: true
      },
      leaseExpiresAt: {
        type: Date,
        default: null,
        index: true
      },
      recovering: {
        type: Boolean,
        default: false,
        index: true
      },
      lastInterruptedAt: {
        type: Date,
        default: null
      },
      interruptReason: {
        type: String,
        default: ''
      }
    },
    attempts: {
      type: [attemptSchema],
      default: []
    },
    result: {
      payload: {
        type: Schema.Types.Mixed,
        default: null
      },
      previewEntries: {
        type: [Schema.Types.Mixed],
        default: []
      },
      warningList: {
        type: [Schema.Types.Mixed],
        default: []
      },
      aiSkipList: {
        type: [Schema.Types.Mixed],
        default: []
      },
      aiJsonLogs: {
        type: [Schema.Types.Mixed],
        default: []
      },
      aiJsonLogStorage: {
        type: Schema.Types.Mixed,
        default: null
      },
      aiJsonLogCount: {
        type: Number,
        default: 0
      },
      relatedResults: {
        type: [Schema.Types.Mixed],
        default: []
      },
      childTaskResults: {
        type: [Schema.Types.Mixed],
        default: []
      },
      languageResults: {
        type: [Schema.Types.Mixed],
        default: []
      },
      translationPostMap: {
        type: Schema.Types.Mixed,
        default: {}
      },
      coverImageArtifacts: {
        type: [Schema.Types.Mixed],
        default: []
      },
      coverImageGenerationMap: {
        type: Schema.Types.Mixed,
        default: {}
      },
      coverImageRecognitionMap: {
        type: Schema.Types.Mixed,
        default: {}
      },
      sourceSnapshotId: {
        type: Schema.Types.ObjectId,
        default: null,
        index: true
      },
      aiUsage: {
        type: Schema.Types.Mixed,
        default: {}
      },
      model: {
        type: String,
        default: ''
      },
      completedAt: {
        type: Date,
        default: null
      }
    },
    adoption: {
      entries: {
        type: [adoptionEntrySchema],
        default: []
      },
      adoptedBy: {
        type: adminSnapshotSchema,
        default: null
      },
      adoptedAt: {
        type: Date,
        default: null
      },
      lastApplyBatchId: {
        type: String,
        default: ''
      },
      rejectedBy: {
        type: adminSnapshotSchema,
        default: null
      },
      rejectedAt: {
        type: Date,
        default: null
      },
      rejectReason: {
        type: String,
        default: ''
      }
    },
    failure: {
      failedStep: {
        type: String,
        default: ''
      },
      errorCode: {
        type: String,
        default: '',
        index: true
      },
      errorMessage: {
        type: String,
        default: ''
      },
      retryable: {
        type: Boolean,
        default: true,
        index: true
      },
      attempts: {
        type: Number,
        default: 0
      },
      stackSummary: {
        type: String,
        default: ''
      },
      lastFailedAt: {
        type: Date,
        default: null
      }
    },
    storage: {
      cleanupStatus: {
        type: String,
        default: 'active',
        index: true
      },
      cleanupRequested: {
        type: Boolean,
        default: false,
        index: true
      }
    },
    createdBy: {
      type: adminSnapshotSchema,
      default: null
    },
    updatedBy: {
      type: adminSnapshotSchema,
      default: null
    }
  },
  { timestamps: true }
)

translationJobs.index({
  status: 1,
  'queueControl.active': 1,
  'queueControl.deferred': 1,
  'queueControl.priority': -1,
  'runtime.leaseExpiresAt': 1,
  createdAt: 1
})
translationJobs.index({ createdAt: -1, _id: -1 })
translationJobs.index({ status: 1, createdAt: -1, _id: -1 })
translationJobs.index({ jobType: 1, createdAt: -1, _id: -1 })
translationJobs.index({ jobType: 1, status: 1, createdAt: -1, _id: -1 })
translationJobs.index({ 'source.postId': 1, jobType: 1, createdAt: -1 })
translationJobs.index({ 'target.postId': 1, jobType: 1, createdAt: -1 })
translationJobs.index({ 'target.languageCode': 1, status: 1, createdAt: -1 })
translationJobs.index({ 'target.languageCodes': 1, status: 1, createdAt: -1 })
translationJobs.index({ 'taskRelation.parentId': 1, createdAt: -1 })
translationJobs.index({ 'taskRelation.rootId': 1, createdAt: -1 })
translationJobs.index({
  'taskRelation.parentId': 1,
  'source.postId': 1,
  jobType: 1
})

module.exports = require('../modelFactory/defaultModel')(
  'translationJobs',
  translationJobs
)
