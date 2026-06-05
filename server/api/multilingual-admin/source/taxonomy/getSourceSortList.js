const sourceTaxonomyService = require('../../services/sourceTaxonomyService')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourceSortList(req, res) {
  try {
    const data = await sourceTaxonomyService.getSourceSortList()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source sort list get fail')
  }
}
