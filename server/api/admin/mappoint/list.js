import { findMappointPage } from '../../../mongodb/utils/mappoints.js'

export default async function mappointListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    const { list, total } = await findMappointPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
