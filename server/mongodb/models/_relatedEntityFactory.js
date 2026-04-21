const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES
} = require('@wikimoe-ml/common/constants')

/**
 * 通用关联实体 schema 构造器（bangumi/movie/game/book/event）
 * 原站字段差异较大，一期采用：
 *   - 通用可筛选字段：title、name（若原站存在）直接列出
 *   - 其余字段放 payload（Schema.Types.Mixed）
 * translatableFields 记录哪些 payload 字段允许翻译，便于后台和 AI 翻译模块通用化。
 */
function buildRelatedEntitySchema() {
  const schema = new Schema(
    {
      sourceId: { type: String, required: true, index: true },
      languageCode: {
        type: String,
        enum: SUPPORTED_LANGUAGE_CODES,
        required: true,
        index: true
      },
      // 便于列表页搜索的通用展示字段（值来自 payload 中对应字段翻译后的最终文本）
      title: { type: String, default: '', index: true },
      name: { type: String, default: '', index: true },
      // 原样完整 payload（包含原站实际返回的各字段；文本字段的翻译结果会写回这里）
      payload: { type: Schema.Types.Mixed, default: {} },
      // 译文字段路径列表（例如 ['title','description']），用于 AI 翻译流程
      translatableFields: [{ type: String }],
      sourceSnapshot: { type: Schema.Types.Mixed, default: null },
      sourceHash: { type: String, default: '', index: true },
      translationStatus: {
        type: String,
        enum: TRANSLATION_STATUS_VALUES,
        default: TRANSLATION_STATUS.PENDING,
        index: true
      },
      isManualEdited: { type: Boolean, default: false }
    },
    { timestamps: true }
  )
  schema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
  return schema
}

module.exports = {
  buildRelatedEntitySchema
}
