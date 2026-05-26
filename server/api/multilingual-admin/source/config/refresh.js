const {
  refreshSourceConfigRuntimeData
} = require('../../services/sourceConfigService')
const handleApiError = require('../../handleApiError')

module.exports = async function refreshSourceConfig(req, res) {
  try {
    const data = await refreshSourceConfigRuntimeData()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'refresh source config fail')
  }
}
