import mongoose from 'mongoose'

const adminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    nickname: { type: String, required: true, trim: true },
    /** 'superadmin' | 'admin' */
    role: { type: String, default: 'admin', enum: ['superadmin', 'admin'] },
    disabled: { type: Boolean, default: false },
    /**
     * 密码版本号，每次修改密码后递增
     * JWT 中携带此版本号，服务端验证时对比，不一致则拒绝
     */
    pwversion: { type: Number, default: 0 },
    IP: { type: String, default: '' },
    ipInfo: { type: Object, default: null }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

export default mongoose.model('AdminUser', adminUserSchema)
