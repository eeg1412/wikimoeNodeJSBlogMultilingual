import { findTagGroupPage } from '../../../mongodb/utils/tags.js'
import { buildKeywordQuery } from '../../../mongodb/utils/buildKeywordQuery.js'

export default async function tagListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    const keywordQuery = buildKeywordQuery(req.query.keyword, [
      'sourceId',
      'tagname'
    ])
    if (keywordQuery) Object.assign(query, keywordQuery)
    const { list, total } = await findTagGroupPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
