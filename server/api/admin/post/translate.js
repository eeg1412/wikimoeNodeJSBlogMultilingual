import { translatePostFields } from '../../../services/aiTranslation.js'
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

    const fields = []
    if (value.field) {
      fields.push(value.field)
    }
    if (Array.isArray(value.fields)) {
      fields.push(...value.fields)
    }

    const uniqueFields = [...new Set(fields)]
    if (uniqueFields.length === 0) {
      uniqueFields.push('title', 'excerpt', 'content')
    }

    const { updates, warnings } = await translatePostFields({
      post,
      fields: uniqueFields,
      targetLanguageCode: post.languageCode
    })

    await Post.findByIdAndUpdate(id, {
      ...updates,
      translationStatus: TRANSLATION_STATUS.AI_DRAFT
    })

    let translatedValue
    if (value.field && Object.prototype.hasOwnProperty.call(updates, value.field)) {
      translatedValue = updates[value.field]
    }

    return res.json({
      data: {
        updatedFields: Object.keys(updates),
        translatedValue,
        warnings
      }
    })
  } catch (err) {
    next(err)
  }
}
