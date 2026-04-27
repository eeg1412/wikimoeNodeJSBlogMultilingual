var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var users = new Schema(
  {
    username: {
      type: String,
      required: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    nickname: {
      type: String,
      required: true
    },
    role: {
      type: Number,
      default: 1,
      index: true
    },
    photo: String,
    email: String,
    description: String,
    cover: { type: Schema.ObjectId, ref: 'attachments', default: null },
    disabled: {
      type: Boolean,
      default: false,
      index: true
    },
    pwversion: {
      type: Number,
      default: 0,
      index: true
    },
    IP: String,
    ipInfo: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(users, 'users')
multilingualSchema.addRelationIdentityIndex(users)

module.exports = require('../modelFactory/defaultModel')('users', users)
