const mongoose = require('mongoose')

const createSharedEntityModel = require('./helpers/createSharedEntityModel')

module.exports = createSharedEntityModel('books', {
  title: {
    type: String,
    default: ''
  },
  summary: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  coverAttachment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'attachments',
    default: null
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
})
