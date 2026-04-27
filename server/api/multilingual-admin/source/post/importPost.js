const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function importPost(req, res) {
  try {
    const data = await importPostSourceService.importOrOverwriteSourcePost(
      req.body,
      false
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post import fail')
  }
}
