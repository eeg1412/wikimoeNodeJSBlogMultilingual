const sourcePostLinkRewriteService = require('../../services/sourcePostLinkRewriteService')
const handleApiError = require('../../handleApiError')

module.exports = async function sourceLinkPreview(req, res) {
  try {
    const data =
      await sourcePostLinkRewriteService.buildTranslationPostSourceLinkPreview({
        ...req.body,
        id: req.body.id || req.query.id
      })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'translation post source link preview fail')
  }
}
