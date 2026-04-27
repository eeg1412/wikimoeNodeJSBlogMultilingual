var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var tags = new Schema(
  {
    tagname: {
      type: String,
      required: true
    },
    // 最后一次使用时间
    lastusetime: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(tags, 'tags')
multilingualSchema.addRelationIdentityIndex(tags)

module.exports = require('../modelFactory/defaultModel')('tags', tags)
