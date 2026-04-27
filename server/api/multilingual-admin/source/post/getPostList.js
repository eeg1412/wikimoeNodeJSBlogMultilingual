const importPostSourceService = require('../../services/importPostSourceService')
const handleApiError = require('../../handleApiError')

module.exports = async function getPostList(req, res) {
  try {
    const data = await importPostSourceService.getSourcePostList(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post list get fail')
  }
}
