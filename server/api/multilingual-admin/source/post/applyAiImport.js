const translationPostService = require('../../services/translationPostService')
const handleApiError = require('../../handleApiError')

module.exports = async function applyAiImport(req, res) {
  try {
    const data = await translationPostService.applySourcePostAiImport(req.body)
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'source post ai import apply fail')
  }
}
