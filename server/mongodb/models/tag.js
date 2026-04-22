import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

const tagSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    tagname: { type: String, default: '' },
    lastusetime: { type: Date, default: null },
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

tagSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

export default mongoose.model('Tag', tagSchema)
