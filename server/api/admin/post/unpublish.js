import Post from '../../../mongodb/models/post.js'
import { POST_STATUS } from '../../../../common/constants/index.js'
import { cacheData } from '../../../config/cacheData.js'

export default async function postUnpublishHandler(req, res, next) {
  try {
    const { id } = req.params
    const post = await Post.findById(id)
    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }

    post.status = POST_STATUS.DRAFT
    await post.save()

    cacheData.delByPrefix(post.languageCode)

    return res.json({ data: { unpublished: true } })
  } catch (err) {
    next(err)
  }
}
