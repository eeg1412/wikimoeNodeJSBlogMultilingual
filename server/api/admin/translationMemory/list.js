import { findTranslationMemoryPage } from '../../../mongodb/utils/translationMemories.js'

export default async function translationMemoryListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.targetLanguageCode)
      query.targetLanguageCode = req.query.targetLanguageCode
    if (req.query.approved !== undefined)
      query.approved = req.query.approved === 'true'
    const { list, total } = await findTranslationMemoryPage({
      query,
      page,
      limit
    })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
