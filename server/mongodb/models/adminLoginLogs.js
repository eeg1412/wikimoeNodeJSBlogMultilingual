const mongoose = require('mongoose')

const { Schema } = mongoose

const adminLoginLogsSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'adminUsers',
      default: null
    },
    IP: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    ipInfo: {
      type: Schema.Types.Mixed,
      default: null
    },
    deviceInfo: {
      type: Schema.Types.Mixed,
      default: null
    },
    success: {
      type: Boolean,
      required: true,
      index: true
    },
    reason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
)

adminLoginLogsSchema.index({ IP: 1, createdAt: -1 })
adminLoginLogsSchema.index({ username: 1, createdAt: -1 })
adminLoginLogsSchema.index({ success: 1, createdAt: -1 })

module.exports = mongoose.model('adminLoginLogs', adminLoginLogsSchema)
