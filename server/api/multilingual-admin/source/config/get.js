const { getSourceConfigData } = require('../../services/sourceConfigService')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourceConfig(req, res) {
  try {
    const data = await getSourceConfigData()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'get source config fail')
  }
}
