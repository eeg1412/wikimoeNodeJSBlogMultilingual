import { findAuthorGroupPage } from '../../../mongodb/utils/authors.js'
import { buildKeywordQuery } from '../../../mongodb/utils/buildKeywordQuery.js'

export default async function authorListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    const keywordQuery = buildKeywordQuery(req.query.keyword, [
      'sourceId',
      'nickname',
      'description'
    ])
    if (keywordQuery) Object.assign(query, keywordQuery)
    const { list, total } = await findAuthorGroupPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
