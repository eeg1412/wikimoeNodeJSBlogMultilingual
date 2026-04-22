import { translatePostFields } from '../../../services/aiTranslation.js'
import { translateHtml } from '../../../services/htmlTranslation.js'
import Post from '../../../mongodb/models/post.js'
import { translateFieldSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { TRANSLATION_STATUS } from '../../../../common/constants/index.js'

export default async function postTranslateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(translateFieldSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }

    const post = await Post.findById(id).lean()
    if (!post) {
      return res.status(404).json({ message: '文章不存在' })
    }

    const fields = value.fields || ['title', 'excerpt', 'content']
    const { updates, warnings } = await translatePostFields({
      post,
      fields,
      targetLanguageCode: post.languageCode
    })

    await Post.findByIdAndUpdate(id, {
      ...updates,
      translationStatus: TRANSLATION_STATUS.TRANSLATED
    })

    return res.json({ data: { updated: Object.keys(updates), warnings } })
  } catch (err) {
    next(err)
  }
}
