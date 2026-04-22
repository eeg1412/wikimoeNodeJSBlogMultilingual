import { updateTranslationMemoryById } from '../../../mongodb/utils/translationMemories.js'

export default async function translationMemoryApproveHandler(req, res, next) {
  try {
    const { id } = req.params
    const doc = await updateTranslationMemoryById(id, { approved: true })
    if (!doc) {
      return res.status(404).json({ message: '翻译记忆不存在' })
    }
    return res.json({ data: doc })
  } catch (err) {
    next(err)
  }
}
