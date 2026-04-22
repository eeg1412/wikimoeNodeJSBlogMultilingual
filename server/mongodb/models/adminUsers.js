const mongoose = require('mongoose')

const { Schema } = mongoose

const adminUsersSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    nickname: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      default: 'super_admin'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    pwversion: {
      type: Number,
      required: true,
      default: 1
    },
    IP: {
      type: String,
      default: null
    },
    ipInfo: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
)

adminUsersSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password
    return ret
  }
})

module.exports = mongoose.model('adminUsers', adminUsersSchema)
