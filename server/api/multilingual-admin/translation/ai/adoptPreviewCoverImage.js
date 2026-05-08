const coverImageAdoptionService = require('../../services/coverImageAdoptionService')
const handleApiError = require('../../handleApiError')

module.exports = async function adoptPreviewCoverImage(req, res) {
  try {
    const data = await coverImageAdoptionService.adoptPreviewCoverImage(
      req.body,
      {
        admin: req.admin
      }
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation preview cover image adopt fail')
  }
}
