import { findAttachmentPage } from '../../../mongodb/utils/attachments.js'

export default async function attachmentListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    if (req.query.attachmentSourceType)
      query.attachmentSourceType = req.query.attachmentSourceType
    const { list, total } = await findAttachmentPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
