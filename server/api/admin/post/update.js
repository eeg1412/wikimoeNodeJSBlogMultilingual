import Post from '../../../mongodb/models/post.js'
import { postUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { cacheData } from '../../../config/cacheData.js'
import { sanitizeHtml } from '../../../services/htmlSanitizer.js'
import { TRANSLATION_STATUS } from '../../../../common/constants/index.js'

export default async function postUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(postUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }

    const post = await Post.findById(id)
    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }

    // allowRemark 强制为 false
    value.allowRemark = false
    if (typeof value.content === 'string') {
      value.content = sanitizeHtml(value.content)
    }

    if (
      Object.prototype.hasOwnProperty.call(value, 'title') ||
      Object.prototype.hasOwnProperty.call(value, 'excerpt') ||
      Object.prototype.hasOwnProperty.call(value, 'content') ||
      Object.prototype.hasOwnProperty.call(value, 'sort')
    ) {
      value.translationStatus = TRANSLATION_STATUS.MANUAL_DRAFT
      value.isManualEdited = true
    }

    Object.assign(post, value)
    await post.save()

    // 清理该语言缓存
    cacheData.delByPrefix(post.languageCode)

    return res.json({ data: post })
  } catch (err) {
    next(err)
  }
}
