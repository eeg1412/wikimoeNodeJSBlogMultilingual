const mongoose = require('mongoose')

const createSharedEntityModel = require('./helpers/createSharedEntityModel')

module.exports = createSharedEntityModel('authors', {
  nickname: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  photoAttachment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'attachments',
    default: null
  },
  coverAttachment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'attachments',
    default: null
  }
})
