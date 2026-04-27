const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function overwritePost(req, res) {
  try {
    const data = await importPostSourceService.importOrOverwriteSourcePost(
      req.body,
      true
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post overwrite fail')
  }
}
