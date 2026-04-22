import mongoose from 'mongoose'

const importJobSchema = new mongoose.Schema(
  {
    sourceIdentifier: { type: String, required: true },
    sourceResolvedId: { type: String, default: '' },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    operatorAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true
    },
    /** 'running' | 'success' | 'failed' | 'cancelled' */
    status: {
      type: String,
      required: true,
      enum: ['running', 'success', 'failed', 'cancelled'],
      default: 'running'
    },
    /** 'resolveSource' | 'extractDependencies' | 'upsertSharedEntities' | 'upsertPost' | 'finalize' */
    stage: {
      type: String,
      enum: [
        'resolveSource',
        'extractDependencies',
        'upsertSharedEntities',
        'upsertPost',
        'finalize'
      ],
      default: 'resolveSource'
    },
    /** 经过原站内部 URL 相对化后的载荷，禁止保存带完整原站域名的数据 */
    sourcePayload: { type: Object, default: null },
    sourcePayloadHash: { type: String, default: '' },
    resultPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null
    },
    warnings: [{ type: String }],
    errors: [{ type: String }],
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    suppressReservedKeysWarning: true
  }
)

importJobSchema.index({ sourceResolvedId: 1, languageCode: 1, status: 1 })

export default mongoose.model('ImportJob', importJobSchema)
