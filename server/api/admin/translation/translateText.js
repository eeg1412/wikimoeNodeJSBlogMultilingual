const { translateTextSchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const { translateField } = require('../../../services/translationService')

/**
 * POST /api/admin/translation/text
 * 通用单字段文本翻译（不直接写库，供前台/编辑器即时翻译 + 调试使用）。
 */
module.exports = async function translateText(req, res) {
  const { value, error } = translateTextSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) {
    throw badRequest('参数校验失败', error.details)
  }
  const operatorAdminId = req.admin ? req.admin._id : null
  const result = await translateField({
    sourceText: value.sourceText,
    targetLanguageCode: value.targetLanguageCode,
    fieldKind: value.fieldKind,
    context: value.context,
    entityType: value.entityType || '',
    entityId: value.entityId || null,
    fieldPath: value.fieldPath || '',
    operatorAdminId
  })
  res.json({
    data: {
      translatedText: result.translatedText,
      fromMemory: result.fromMemory,
      stats: result.stats
    }
  })
}
