var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var eventtypes = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(eventtypes, 'eventtypes')
multilingualSchema.addRelationIdentityIndex(eventtypes)

module.exports = require('../modelFactory/defaultModel')(
  'eventtypes',
  eventtypes
)
