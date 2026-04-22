const mongoose = require('mongoose')

const { Schema } = mongoose

const settingsSchema = new Schema(
  {
    namespace: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    key: {
      type: String,
      required: true,
      trim: true
    },
    fullKey: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: Schema.Types.Mixed,
      default: null
    },
    valueType: {
      type: String,
      required: true,
      default: 'string'
    },
    isSecret: {
      type: Boolean,
      default: false
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
)

settingsSchema.index({ namespace: 1, key: 1 }, { unique: true })

module.exports = mongoose.model('settings', settingsSchema)
