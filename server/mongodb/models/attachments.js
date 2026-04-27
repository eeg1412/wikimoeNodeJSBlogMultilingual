var mongoose = require('mongoose')
var Schema = mongoose.Schema
var multilingualSchema = require('../modelFactory/multilingualSchema')
// Schema
var attachments = new Schema(
  {
    //   - filename	文件名字段
    // - filesize	文件大小字段
    // - filepath	文件路径字段
    // - addtime	添加时间字段
    // - width	图片宽度字段
    // - height	图片高度字段
    // - mimetype	MIME类型字段
    // - thumfor	缩略图标识字段
    // - 相册id	album
    name: {
      type: String
    },
    filename: {
      type: String,
      required: true
    },
    filesize: {
      type: Number
    },
    filepath: {
      type: String
    },
    width: {
      type: Number
    },
    height: {
      type: Number
    },
    mimetype: {
      type: String,
      index: true
    },
    thumfor: {
      type: String
    },
    thumWidth: {
      type: Number
    },
    thumHeight: {
      type: Number
    },
    album: {
      type: Schema.Types.ObjectId,
      ref: 'albums',
      index: true
    },
    // 描述
    description: {
      type: String,
      default: ''
    },
    // 是否是360度全景图
    is360Panorama: {
      type: Boolean,
      default: false
    },
    // 0还没压缩，1压缩成功
    status: {
      type: Number,
      default: 0,
      index: true
    }
  },
  { timestamps: true }
)

multilingualSchema.addSourceIdentityFields(attachments, 'attachments')
multilingualSchema.addAttachmentMediaFields(attachments)
multilingualSchema.addAttachmentIndexes(attachments)

module.exports = require('../modelFactory/defaultModel')(
  'attachments',
  attachments
)
