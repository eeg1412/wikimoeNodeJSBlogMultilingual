import { updateTagById } from '../../../mongodb/utils/tags.js'
import { tagUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

export default async function tagUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(tagUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await updateTagById(id, value)
    if (!doc) {
      return res.status(404).json({ message: '标签不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
