import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

const authorSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    nickname: { type: String, default: '' },
    description: { type: String, default: '' },
    /** attachments._id 引用，远程或翻译站附件均可 */
    photoAttachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null
    },
    coverAttachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attachment',
      default: null
    },
    sourceSnapshot: { type: Object, default: null },
    sourceHash: { type: String, default: '' },
    translationStatus: {
      type: String,
      enum: translationStatusEnum,
      default: TRANSLATION_STATUS.PENDING
    },
    isManualEdited: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

authorSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

export default mongoose.model('Author', authorSchema)
