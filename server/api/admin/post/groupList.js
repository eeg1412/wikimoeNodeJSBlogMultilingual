import { findPostGroupList } from '../../../mongodb/utils/posts.js'

export default async function postGroupListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)

    const filter = {}
    if (req.query.languageCode) {
      filter.languageCode = req.query.languageCode
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      filter.status = parseInt(req.query.status)
    }
    if (req.query.type !== undefined && req.query.type !== '') {
      filter.type = parseInt(req.query.type)
    }
    if (req.query.keyword) {
      filter.$or = [
        { title: { $regex: req.query.keyword, $options: 'i' } },
        { sourceId: req.query.keyword }
      ]
    }

    const { list, total } = await findPostGroupList({ page, limit, filter })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
