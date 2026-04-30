var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
var { normalizeTagName } = require('../../utils/tagName')
// Schema
var tags = new Schema(
  {
    tagname: {
      type: String,
      set: normalizeTagName,
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

tags.pre('validate', function (next) {
  if (this.tagname !== undefined) {
    this.tagname = normalizeTagName(this.tagname)
  }
  next()
})

multilingualSchema.addSourceIdentityFields(tags, 'tags')
multilingualSchema.addRelationIdentityIndex(tags)

module.exports = require('../modelFactory/defaultModel')('tags', tags)
