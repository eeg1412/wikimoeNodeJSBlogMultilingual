var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var sorts = new Schema(
  {
    sortname: {
      type: String,
      required: true
    },
    // alias 别名
    alias: {
      type: String,
      index: true
    },
    // taxis 排序
    taxis: {
      type: Number,
      default: 0,
      index: true
    },
    // 父级分类 ObjectId 或者null
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'sorts',
      index: true
    },
    // description 描述
    description: {
      type: String
    },
    // template 模板
    template: {
      type: String
    }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(sorts, 'sorts')
multilingualSchema.addRelationIdentityIndex(sorts)

module.exports = require('../modelFactory/defaultModel')('sorts', sorts)
