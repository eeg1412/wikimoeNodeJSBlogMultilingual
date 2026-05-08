const coverImageAdoptionService = require('../../services/coverImageAdoptionService')
const handleApiError = require('../../handleApiError')

module.exports = async function cleanupTranslationJobCoverImages(req, res) {
  try {
    const data = await coverImageAdoptionService.cleanupCoverImageTempFiles(
      req.body
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job cover image cleanup fail')
  }
}
