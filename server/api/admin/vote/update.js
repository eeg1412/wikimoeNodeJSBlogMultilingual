import Vote from '../../../mongodb/models/vote.js'
import { validateData } from '../../../../common/validation/validate.js'
import Joi from 'joi'

const voteUpdateSchema = Joi.object({
  title: Joi.string().max(500),
  options: Joi.array().items(
    Joi.object({
      sourceOptionId: Joi.string().required(),
      title: Joi.string().max(300)
    })
  ),
  translationStatus: Joi.string()
})

export default async function voteUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(voteUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await Vote.findByIdAndUpdate(id, value, { new: true })
    if (!doc) {
      return res.status(404).json({ message: '投票不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
