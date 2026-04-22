import Post from '../../../mongodb/models/post.js'
import { validatePostForPublish } from '../../../services/publishValidator.js'
import {
  POST_STATUS,
  TRANSLATION_STATUS
} from '../../../../common/constants/index.js'
import { cacheData } from '../../../config/cacheData.js'

export default async function postPublishHandler(req, res, next) {
  try {
    const { id } = req.params
    const post = await Post.findById(id).lean()
    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }

    const { valid, errors, warnings } = validatePostForPublish(post)
    if (!valid) {
      return res.status(400).json({ message: '发布验证失败', errors, warnings })
    }

    await Post.findByIdAndUpdate(id, { status: POST_STATUS.PUBLISHED })
    cacheData.delByPrefix(post.languageCode)

    return res.json({ data: { published: true, warnings } })
  } catch (err) {
    next(err)
  }
}
