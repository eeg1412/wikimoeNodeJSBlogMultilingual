const mongoose = require('mongoose')
const { buildRelatedEntitySchema } = require('./_relatedEntityFactory')
module.exports = mongoose.model('movies', buildRelatedEntitySchema())
