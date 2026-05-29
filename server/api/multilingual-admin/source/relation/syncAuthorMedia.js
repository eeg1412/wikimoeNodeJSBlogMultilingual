const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function syncAuthorMedia(req, res) {
  try {
    const data =
      await translationPostService.syncSourceAuthorMediaToTranslations(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source author media sync fail')
  }
}
