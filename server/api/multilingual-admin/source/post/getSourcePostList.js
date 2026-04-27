const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourcePostList(req, res) {
  try {
    const data = await importPostSourceService.getSourceDatabasePostList(
      req.query
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source database post list get fail')
  }
}
