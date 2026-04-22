import { findAuthorPage } from '../../../mongodb/utils/authors.js'

export default async function authorListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    const { list, total } = await findAuthorPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
