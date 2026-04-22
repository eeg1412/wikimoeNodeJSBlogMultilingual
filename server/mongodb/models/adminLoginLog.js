import mongoose from 'mongoose'

const adminLoginLogSchema = new mongoose.Schema(
  {
    username: { type: String, default: '' },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null
    },
    IP: { type: String, default: '' },
    ipInfo: { type: Object, default: null },
    deviceInfo: { type: Object, default: null },
    success: { type: Boolean, required: true },
    reason: { type: String, default: '' }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
  }
)

adminLoginLogSchema.index({ IP: 1, createdAt: 1 })
adminLoginLogSchema.index({ username: 1, createdAt: 1 })
adminLoginLogSchema.index({ success: 1, createdAt: 1 })

export default mongoose.model('AdminLoginLog', adminLoginLogSchema)
