/**
 * 关联实体模型工厂
 * bangumis / movies / games / books / events / votes
 * 统一采用 sourceId + languageCode 唯一约束
 */
import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

function createEntityModel(modelName) {
  const schema = new mongoose.Schema(
    {
      sourceId: { type: String, required: true },
      languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
      /** 存储原站返回的文本字段，允许翻译 */
      title: { type: String, default: '' },
      /** 通用描述 / 简介字段 */
      description: { type: String, default: '' },
      /** 存原站返回的完整数据（扁平化后） */
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
  schema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
  return mongoose.model(modelName, schema)
}

export const Bangumi = createEntityModel('Bangumi')
export const Movie = createEntityModel('Movie')
export const Game = createEntityModel('Game')
export const Book = createEntityModel('Book')
export const Event = createEntityModel('Event')
