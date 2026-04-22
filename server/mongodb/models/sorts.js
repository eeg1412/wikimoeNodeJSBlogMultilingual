const mongoose = require('mongoose')

const createSharedEntityModel = require('./helpers/createSharedEntityModel')

module.exports = createSharedEntityModel(
  'sorts',
  {
    sortname: {
      type: String,
      default: ''
    },
    alias: {
      type: String,
      default: null,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    template: {
      type: String,
      default: ''
    },
    taxis: {
      type: Number,
      default: 0
    },
    parentSourceId: {
      type: String,
      default: null,
      trim: true
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'sorts',
      default: null
    }
  },
  {
    extraIndexes: [
      {
        fields: { languageCode: 1, alias: 1 },
        options: {
          unique: true,
          sparse: true
        }
      }
    ]
  }
)
