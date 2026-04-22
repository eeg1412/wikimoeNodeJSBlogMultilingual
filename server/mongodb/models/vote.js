import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

/**
 * Vote 只读，不产生本地投票记录
 * options.title 允许翻译，其余字段同步原值
 */
const voteSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    title: { type: String, default: '' },
    options: [
      {
        sourceOptionId: { type: String, required: true },
        title: { type: String, default: '' },
        /** 原始选项其他字段直接同步 */
        rawOption: { type: Object, default: null }
      }
    ],
    rawData: { type: Object, default: null },
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

voteSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

export default mongoose.model('Vote', voteSchema)
