var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var albums = new Schema(
  {
    name: {
      type: String,
      required: true,
      index: true
    },
    // 相册下的文件数量
    count: {
      type: Number,
      default: 0,
      index: true
    }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(albums, 'albums')
multilingualSchema.addRelationIdentityIndex(albums)

module.exports = require('../modelFactory/defaultModel')('albums', albums)
