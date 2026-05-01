const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function getAiImportPreviewContext(req, res) {
  try {
    const data = await translationPostService.getSourcePostAiImportPreviewContext(
      req.query
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post ai import preview context get fail')
  }
}
