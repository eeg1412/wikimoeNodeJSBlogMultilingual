import Tag from '../../../mongodb/models/tag.js'
import { findPostPage } from '../../../mongodb/utils/posts.js'
import { POST_STATUS } from '../../../../common/constants/index.js'

export default async function blogTagDetailHandler(req, res, next) {
  try {
    const { lang, id } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)

    const tag =
      (await Tag.findOne({ sourceId: id, languageCode: lang }).lean()) ||
      (await Tag.findOne({ _id: id, languageCode: lang })
        .lean()
        .catch(() => null))

    if (!tag) {
      return res.status(404).json({ message: '标签不存在' })
    }

    const { list, total } = await findPostPage({
      query: {
        tags: tag._id,
        languageCode: lang,
        status: POST_STATUS.PUBLISHED
      },
      page,
      limit
    })

    return res.json({ data: { tag, posts: { list, total, page, limit } } })
  } catch (err) {
    next(err)
  }
}
