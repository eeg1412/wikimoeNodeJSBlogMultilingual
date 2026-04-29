const translationPostService = require('../services/translationPostService')
const handleApiError = require('../handleApiError')

module.exports = async function restoreSnapshot(req, res) {
  try {
    const data =
      await translationPostService.restoreTranslationRecordFromSnapshot({
        ...req.body,
        collectionName: 'attachments',
        id: req.body.id || req.query.id
      })
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'media snapshot restore fail')
  }
}
