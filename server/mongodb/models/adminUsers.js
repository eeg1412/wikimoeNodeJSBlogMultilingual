const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 后台管理员：只用于登录与操作审计，不存放作者展示信息
const adminUsers = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    nickname: { type: String, required: true },
    role: { type: Number, default: 1, index: true },
    disabled: { type: Boolean, default: false, index: true },
    pwversion: { type: Number, default: 0, index: true },
    IP: { type: String },
    ipInfo: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('adminUsers', adminUsers)
