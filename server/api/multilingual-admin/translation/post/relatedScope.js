const translationExecutionService = require('../../services/translationExecutionService')
const handleApiError = require('../../handleApiError')
const { normalizeLanguageCode } = require('../../../../utils/language')

module.exports = async function getSourcePostRelatedScope(req, res) {
  try {
    const query = req.query || {}
    let targetLanguageCodes = []
    if (Array.isArray(query.targetLanguageCodes)) {
      targetLanguageCodes = query.targetLanguageCodes
    } else if (typeof query.targetLanguageCodes === 'string') {
      targetLanguageCodes = query.targetLanguageCodes
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    }
    const normalizedTargetLanguageCodes = targetLanguageCodes
      .map(item => normalizeLanguageCode(item))
      .filter(Boolean)
    const options =
      await translationExecutionService.buildSourcePostRelatedScopeOptions({
        sourceId: query.sourceId,
        sourceLanguageCode: normalizeLanguageCode(query.sourceLanguageCode),
        targetLanguageCodes: normalizedTargetLanguageCodes,
        maxDepth: Number(query.maxDepth || 3)
      })
    res.send({ data: { options } })
  } catch (error) {
    handleApiError(res, error, 'source post related scope fail')
  }
}
