const { translateHtmlRawSchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const { translateHtml } = require('../../../services/translationService')

/**
 * POST /api/admin/translation/html
 * 对任意 HTML 片段执行 DOM 抽取 + 翻译 + 回填。
 */
module.exports = async function translateHtmlRaw(req, res) {
  const { value, error } = translateHtmlRawSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) {
    throw badRequest('参数校验失败', error.details)
  }
  const operatorAdminId = req.admin ? req.admin._id : null
  const result = await translateHtml({
    html: value.html,
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
      translatedHtml: result.translatedHtml,
      segmentCount: result.segmentCount,
      stats: result.stats
    }
  })
}
