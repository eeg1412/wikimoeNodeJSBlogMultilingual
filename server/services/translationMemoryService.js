const { TranslationMemories } = require('../mongodb/models')
const { normalizedTextHash } = require('@wikimoe-ml/common/utils/hash')

/**
 * 查询已批准（approved=true）的翻译记忆。
 * 未批准的记录不参与自动复用，以避免把未校对的 AI 结果继续传播。
 *
 * @param {object} params
 * @param {string} params.sourceText
 * @param {string} params.targetLanguageCode
 * @param {string} params.fieldKind
 * @returns {Promise<{ hit:boolean, translatedText?:string, sourceTextHash:string, doc?:object }>}
 */
async function lookupApproved(params) {
  const { sourceText, targetLanguageCode, fieldKind } = params
  const sourceTextHash = normalizedTextHash(sourceText)
  const doc = await TranslationMemories.findOne({
    sourceTextHash,
    targetLanguageCode,
    fieldKind,
    approved: true
  }).lean()
  if (!doc) {
    return { hit: false, sourceTextHash }
  }
  return {
    hit: true,
    translatedText: doc.translatedText,
    sourceTextHash,
    doc
  }
}

/**
 * upsert 翻译记忆。AI 刚生成的结果默认 approved=false，人工确认后再更新为 true。
 * 同一 hash + 语言 + fieldKind 已存在时：
 *   - 若 doc.approved=true，不覆盖其 translatedText（保护人工校对结果）
 *   - 否则覆盖 translatedText/model/provider
 *
 * @param {object} params
 * @param {string} params.sourceText
 * @param {string} params.targetLanguageCode
 * @param {string} params.fieldKind
 * @param {string} params.translatedText
 * @param {string} [params.model]
 * @param {string} [params.provider]
 * @param {boolean} [params.approved]
 */
async function upsert(params) {
  const { sourceText, targetLanguageCode, fieldKind, translatedText } = params
  const model = params.model || ''
  const provider = params.provider || 'google-genai'
  const approvedFlag = !!params.approved
  const sourceTextHash = normalizedTextHash(sourceText)

  const existing = await TranslationMemories.findOne({
    sourceTextHash,
    targetLanguageCode,
    fieldKind
  })

  if (!existing) {
    await TranslationMemories.create({
      sourceTextHash,
      sourceText,
      targetLanguageCode,
      fieldKind,
      translatedText,
      provider,
      model,
      approved: approvedFlag
    })
    return { created: true, updated: false }
  }

  // 已有人工确认的条目：只有传入 approved=true 才允许覆盖译文
  if (existing.approved && !approvedFlag) {
    return { created: false, updated: false, skipped: true }
  }

  existing.translatedText = translatedText
  existing.model = model || existing.model
  existing.provider = provider || existing.provider
  if (approvedFlag) existing.approved = true
  await existing.save()
  return { created: false, updated: true }
}

/**
 * 批量查询多条 sourceText 的 approved 记忆。
 * 返回按输入顺序的结果数组。
 *
 * @param {Array<{sourceText:string}>} items
 * @param {string} targetLanguageCode
 * @param {string} fieldKind
 */
async function lookupApprovedMany(items, targetLanguageCode, fieldKind) {
  const hashes = items.map(it => normalizedTextHash(it.sourceText))
  const docs = await TranslationMemories.find({
    sourceTextHash: { $in: hashes },
    targetLanguageCode,
    fieldKind,
    approved: true
  }).lean()
  const docMap = new Map()
  for (const d of docs) {
    docMap.set(d.sourceTextHash, d)
  }
  return items.map((it, idx) => {
    const h = hashes[idx]
    const d = docMap.get(h)
    if (d) {
      return {
        hit: true,
        sourceTextHash: h,
        translatedText: d.translatedText,
        doc: d
      }
    }
    return { hit: false, sourceTextHash: h }
  })
}

module.exports = {
  lookupApproved,
  lookupApprovedMany,
  upsert
}
