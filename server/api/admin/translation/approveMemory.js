const {
  approveTranslationMemorySchema
} = require('@wikimoe-ml/common/validation')
const { badRequest, notFound } = require('../../../utils/errors')
const { TranslationMemories } = require('../../../mongodb/models')

/**
 * POST /api/admin/translation/memory/approve
 * 人工确认/撤销确认一条翻译记忆。可附带人工修订后的 translatedText。
 */
module.exports = async function approveMemory(req, res) {
  const { value, error } = approveTranslationMemorySchema.validate(
    req.body || {},
    { abortEarly: false, stripUnknown: true }
  )
  if (error) {
    throw badRequest('参数校验失败', error.details)
  }
  const doc = await TranslationMemories.findById(value.id)
  if (!doc) {
    throw notFound('翻译记忆不存在')
  }
  doc.approved = !!value.approved
  if (typeof value.translatedText === 'string') {
    doc.translatedText = value.translatedText
  }
  await doc.save()
  res.json({
    data: {
      id: doc._id,
      approved: doc.approved,
      translatedText: doc.translatedText
    }
  })
}
