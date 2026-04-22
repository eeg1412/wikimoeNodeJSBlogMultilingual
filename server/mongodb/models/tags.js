const createSharedEntityModel = require('./helpers/createSharedEntityModel')

module.exports = createSharedEntityModel('tags', {
  tagname: {
    type: String,
    default: ''
  },
  lastusetime: {
    type: Date,
    default: null
  }
})
