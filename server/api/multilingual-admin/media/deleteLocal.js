const mediaService = require('../services/mediaService')
const handleApiError = require('../handleApiError')

module.exports = async function deleteLocal(req, res) {
  try {
    const data = await mediaService.deletePureLocalAttachment(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'media delete local fail')
  }
}
