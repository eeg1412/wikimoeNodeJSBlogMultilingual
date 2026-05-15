const sourcePostLinkRewriteService = require('../../services/sourcePostLinkRewriteService')
const handleApiError = require('../../handleApiError')

module.exports = async function sourceLinkApply(req, res) {
  try {
    const data =
      await sourcePostLinkRewriteService.applyTranslationPostSourceLinkReplacement(
        {
          ...req.body,
          id: req.body.id || req.query.id
        }
      )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post source link apply fail')
  }
}
