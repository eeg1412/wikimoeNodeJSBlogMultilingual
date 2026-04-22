import { updateAttachmentById } from '../../../mongodb/utils/attachments.js'
import { attachmentUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'

export default async function attachmentUpdateHandler(req, res, next) {
  try {
    const { id } = req.params
    const { value, error } = validateData(attachmentUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }
    const doc = await updateAttachmentById(id, value)
    if (!doc) {
      return res.status(404).json({ message: '附件不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
