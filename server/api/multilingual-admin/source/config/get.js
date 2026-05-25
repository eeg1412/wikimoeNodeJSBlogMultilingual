const {
  getSourceSeoSettingsCacheData
} = require('../../../../utils/sourceSeoSettings')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourceConfig(req, res) {
  try {
    const data = await getSourceSeoSettingsCacheData()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'get source config fail')
  }
}
