const createSharedEntityModel = require('./helpers/createSharedEntityModel')

module.exports = createSharedEntityModel('mappoints', {
  title: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  longitude: {
    type: Number,
    default: null
  },
  latitude: {
    type: Number,
    default: null
  },
  zIndex: {
    type: Number,
    default: null
  },
  status: {
    type: Number,
    default: null
  }
})
