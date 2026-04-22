import mongoose from 'mongoose'

/**
 * 系统配置与站点展示配置统一存储
 * namespace: 'system' 或 'site'
 * key: 配置项 key
 * value: 配置值（存储为 string，前缀为 system.ai*Key 等敏感字段需额外加密）
 * isSecret: true 时掩码回显，加密存储
 */
const optionSchema = new mongoose.Schema(
  {
    namespace: { type: String, required: true, enum: ['system', 'site'] },
    key: { type: String, required: true },
    /** 配置值，全部以 Mixed 存储支持不同类型 */
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    /** 是否为敏感字段，true 时回显掩码，存储需加密 */
    isSecret: { type: Boolean, default: false },
    /** 最后修改人 ID */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null
    },
    remark: { type: String, default: '' }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

optionSchema.index({ namespace: 1, key: 1 }, { unique: true })

export default mongoose.model('Option', optionSchema)
