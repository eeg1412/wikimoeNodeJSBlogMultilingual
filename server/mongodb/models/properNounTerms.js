var mongoose = require('mongoose')
var Schema = mongoose.Schema

var properNounTerms = new Schema(
  {
    sourceText: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    normalizedSourceText: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sourceLanguageCode: {
      type: String,
      default: '',
      index: true
    },
    note: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
)

module.exports = require('../modelFactory/defaultModel')(
  'properNounTerms',
  properNounTerms
)
