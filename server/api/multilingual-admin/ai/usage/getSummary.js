const aiUsageService = require('../../services/aiUsageService')
const handleApiError = require('../../handleApiError')

module.exports = async function getAiUsageSummary(req, res) {
  try {
    const data = await aiUsageService.getAiUsageSummary(req.query)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'get ai usage summary fail')
  }
}
