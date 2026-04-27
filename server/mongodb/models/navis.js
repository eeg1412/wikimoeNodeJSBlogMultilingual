var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var navis = new Schema(
  {
    naviname: {
      type: String,
      required: true
    },
    url: {
      type: String
    },
    newtab: {
      type: Boolean,
      default: false
    },
    // 状态 0 不显示 1 显示
    status: {
      type: Number,
      default: 0,
      index: true
    },
    // 排序
    taxis: {
      type: Number,
      default: 0,
      index: true
    },
    // 父导航
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'navis',
      index: true
    },
    // 是否本站链接
    isdefault: {
      type: Boolean,
      default: false
    },
    // query
    query: {
      type: String,
      default: ''
    },
    deepmatch: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

multilingualSchema.addLocalLanguageFields(navis)

module.exports = require('../modelFactory/defaultModel')('navis', navis)
