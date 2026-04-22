import Post from '../../../mongodb/models/post.js'
import { findPostBySourceIdLang } from '../../../mongodb/utils/posts.js'

export default async function postDetailHandler(req, res, next) {
  try {
    const { id } = req.params
    const post = await Post.findById(id)
      .populate('author')
      .populate('sort')
      .populate('tags')
      .populate('coverImages')
      .lean()

    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }
    return res.json({ data: post })
  } catch (err) {
    next(err)
  }
}
