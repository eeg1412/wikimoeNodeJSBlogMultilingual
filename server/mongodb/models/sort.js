import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

const sortSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    sortname: { type: String, default: '' },
    alias: { type: String, default: '' },
    description: { type: String, default: '' },
    template: { type: String, default: '' },
    taxis: { type: Number, default: 0 },
    parentSourceId: { type: String, default: '' },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sort',
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

sortSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
// alias 非空时唯一；为空时不写入，不参与唯一约束
sortSchema.index(
  { languageCode: 1, alias: 1 },
  {
    unique: true,
    partialFilterExpression: { alias: { $type: 'string', $gt: '' } }
  }
)

export default mongoose.model('Sort', sortSchema)
