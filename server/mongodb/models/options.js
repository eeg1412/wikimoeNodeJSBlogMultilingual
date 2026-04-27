var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var options = new Schema(
  {
    name: {
      type: String,
      required: true,
      index: true
    },
    // value
    value: {
      type: String
    }
  },
  { timestamps: true }
)

multilingualSchema.addOptionsLanguageFields(options)

module.exports = require('../modelFactory/defaultModel')('options', options)
