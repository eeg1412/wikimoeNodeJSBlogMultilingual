import { findPostPage } from '../../../mongodb/utils/posts.js'
import { POST_STATUS } from '../../../../common/constants/index.js'

export default async function blogPostListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)
    const { lang } = req.params

    const query = {
      languageCode: lang,
      status: POST_STATUS.PUBLISHED
    }

    if (req.query.type) {
      query.type = parseInt(req.query.type)
    }
    if (req.query.sortId) {
      query.sort = req.query.sortId
    }
    if (req.query.tagId) {
      query.tags = req.query.tagId
    }
    if (req.query.keyword) {
      query.$or = [
        { title: { $regex: req.query.keyword, $options: 'i' } },
        { excerpt: { $regex: req.query.keyword, $options: 'i' } }
      ]
    }

    const { list, total } = await findPostPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
