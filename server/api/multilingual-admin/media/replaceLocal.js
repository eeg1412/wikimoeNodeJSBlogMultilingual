const mediaService = require('../services/mediaService')
const handleApiError = require('../handleApiError')

module.exports = async function replaceLocal(req, res) {
  let file = req.file
  try {
    const data = await mediaService.replaceLocalAttachment(req.body, file)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'media replace local fail')
  } finally {
    if (file) {
      file.buffer = null
      file = null
    }
  }
}
