import { updateMappointById } from '../../../mongodb/utils/mappoints.js'
import { mappointUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

export default async function mappointUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(mappointUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await updateMappointById(id, value)
    if (!doc) {
      return res.status(404).json({ message: '地点不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
