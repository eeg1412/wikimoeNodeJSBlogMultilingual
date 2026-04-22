import { findAiTranslationLogPage } from '../../../mongodb/utils/aiTranslationLogs.js'

export default async function aiTranslationLogListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.success !== undefined)
      query.success = req.query.success === 'true'
    if (req.query.entityType) query.entityType = req.query.entityType
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    const { list, total } = await findAiTranslationLogPage({
      query,
      page,
      limit
    })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
