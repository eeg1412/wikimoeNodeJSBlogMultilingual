const mediaService = require('../services/mediaService')
const handleApiError = require('../handleApiError')

module.exports = async function convertRemote(req, res) {
  try {
    const data = await mediaService.convertLocalAttachmentToRemote(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'media convert remote fail')
  }
}
