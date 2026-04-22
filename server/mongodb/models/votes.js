const mongoose = require('mongoose')

const createLocalizedBaseFields = require('./helpers/localizedBaseFields')

const { Schema } = mongoose

const voteOptionSchema = new Schema(
  {
    sourceOptionId: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    sort: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
)

const votesSchema = new Schema(
  {
    ...createLocalizedBaseFields(Schema),
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    options: {
      type: [voteOptionSchema],
      default: []
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
)

votesSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

module.exports = mongoose.model('votes', votesSchema)
