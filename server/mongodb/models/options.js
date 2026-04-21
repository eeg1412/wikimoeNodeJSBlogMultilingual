const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 站点选项：扁平 key/value 存储，value 用 Mixed 以兼容字符串/数字/布尔/数组/对象
const options = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('options', options)
