var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var gamePlatforms = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(gamePlatforms, 'gamePlatforms')
multilingualSchema.addRelationIdentityIndex(gamePlatforms)

module.exports = require('../modelFactory/defaultModel')(
  'gamePlatforms',
  gamePlatforms
)
