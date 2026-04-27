const mediaService = require('../services/mediaService')
const { handleApiError } = require('../../../utils/multilingualAdminResponse')

module.exports = async function (req, res) {
  try {
    const data = await mediaService.listAttachments(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
