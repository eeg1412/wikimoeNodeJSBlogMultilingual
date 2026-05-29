const relationService = require('../../services/relationService')
const handleApiError = require('../../handleApiError')

module.exports = async function syncAuthorPhoto(req, res) {
  try {
    const data = await relationService.syncAuthorPhoto(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation author photo sync fail')
  }
}
