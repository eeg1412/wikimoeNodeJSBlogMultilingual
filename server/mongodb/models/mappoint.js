import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

const mappointSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    /** 不翻译，直接同步原值 */
    longitude: { type: Number, default: 0 },
    latitude: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
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

mappointSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

export default mongoose.model('Mappoint', mappointSchema)
