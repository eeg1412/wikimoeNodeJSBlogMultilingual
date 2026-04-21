const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')

// 翻译记忆：基于规范化文本哈希 + 目标语言 + 字段类别复用翻译
const translationMemories = new Schema(
  {
    sourceTextHash: { type: String, required: true, index: true },
    sourceText: { type: String, default: '' },
    targetLanguageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    // 字段类别：title / excerpt / html_segment / entity_text / attachment_name ...
    fieldKind: { type: String, required: true, index: true },
    translatedText: { type: String, default: '' },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    approved: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
)

translationMemories.index(
  { sourceTextHash: 1, targetLanguageCode: 1, fieldKind: 1 },
  { unique: true }
)

module.exports = mongoose.model('translationMemories', translationMemories)
