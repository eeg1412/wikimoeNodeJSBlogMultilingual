const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourceDatabasePostDetail(req, res) {
  try {
    const data = await importPostSourceService.getSourceDatabasePostDetail(
      req.query
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source database post detail get fail')
  }
}
