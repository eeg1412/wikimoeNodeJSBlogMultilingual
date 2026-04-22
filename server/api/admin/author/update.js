import { updateAuthorById } from '../../../mongodb/utils/authors.js'
import { authorUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

export default async function authorUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(authorUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await updateAuthorById(id, value)
    if (!doc) {
      return res.status(404).json({ message: '作者不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
