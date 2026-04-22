import { updateSortById } from '../../../mongodb/utils/sorts.js'
import { sortUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

export default async function sortUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(sortUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await updateSortById(id, value)
    if (!doc) {
      return res.status(404).json({ message: '分类不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
