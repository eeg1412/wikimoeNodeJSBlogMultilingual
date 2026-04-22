import Post from '../../../mongodb/models/post.js'
import { POST_STATUS } from '../../../../common/constants/index.js'

export default async function blogPostArchiveHandler(req, res, next) {
  try {
    const { lang } = req.params

    // 按年月归档统计（仅 type=1 文章）
    const pipeline = [
      {
        $match: {
          languageCode: lang,
          status: POST_STATUS.PUBLISHED,
          type: 1,
          date: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      }
    ]

    const result = await Post.aggregate(pipeline)

    return res.json({ data: result })
  } catch (err) {
    next(err)
  }
}
