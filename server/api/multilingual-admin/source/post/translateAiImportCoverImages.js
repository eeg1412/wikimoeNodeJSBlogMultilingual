const sourcePostAiImportStreamService = require('../../services/sourcePostAiImportStreamService')
const handleApiError = require('../../handleApiError')

module.exports = async function translateAiImportCoverImages(req, res) {
  try {
    const data =
      await sourcePostAiImportStreamService.translateSourcePostAiImportCoverImages(
        req.body
      )
    res.send({ data })
  } catch (error) {
    handleApiError(
      res,
      error,
      'source post ai import cover image translate fail'
    )
  }
}
