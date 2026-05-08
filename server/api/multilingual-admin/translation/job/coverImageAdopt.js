const coverImageAdoptionService = require('../../services/coverImageAdoptionService')
const handleApiError = require('../../handleApiError')

module.exports = async function adoptTranslationJobCoverImage(req, res) {
  try {
    const data = await coverImageAdoptionService.adoptCoverImage(req.body, {
      admin: req.admin
    })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation job cover image adopt fail')
  }
}
