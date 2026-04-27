var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var booktypes = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(booktypes, 'booktypes')
multilingualSchema.addRelationIdentityIndex(booktypes)

module.exports = require('../modelFactory/defaultModel')('booktypes', booktypes)
