const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function getPostDetail(req, res) {
  try {
    const data = await importPostSourceService.getSourcePostDetail(req.query.id)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post detail get fail')
  }
}
