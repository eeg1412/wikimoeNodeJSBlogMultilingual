import Sort from '../../../mongodb/models/sort.js'
import { findPostPage } from '../../../mongodb/utils/posts.js'
import { POST_STATUS } from '../../../../common/constants/index.js'

export default async function blogSortDetailHandler(req, res, next) {
  try {
    const { lang, alias } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)

    // 支持按 alias 或 _id 查找
    let sort = await Sort.findOne({ alias, languageCode: lang }).lean()
    if (!sort) {
      try {
        sort = await Sort.findOne({ _id: alias, languageCode: lang }).lean()
      } catch {
        // 无效 ID
      }
    }

    if (!sort) {
      return res.status(404).json({ message: '分类不存在' })
    }

    const { list, total } = await findPostPage({
      query: {
        sort: sort._id,
        languageCode: lang,
        status: POST_STATUS.PUBLISHED
      },
      page,
      limit
    })

    return res.json({ data: { sort, posts: { list, total, page, limit } } })
  } catch (err) {
    next(err)
  }
}
