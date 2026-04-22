import { findAttachmentGroupPage } from '../../../mongodb/utils/attachments.js'
import { resolveAttachmentSrc } from '../../../utils/sourceAssetResolver.js'

export default async function attachmentListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.languageCode) query.languageCode = req.query.languageCode
    if (req.query.attachmentSourceType)
      query.attachmentSourceType = req.query.attachmentSourceType
    const { list, total } = await findAttachmentGroupPage({
      query,
      page,
      limit
    })
    const normalizedList = list.map(group => ({
      ...group,
      langs: (group.langs || []).map(item => ({
        ...item,
        previewUrl: resolveAttachmentSrc(item)
      }))
    }))
    return res.json({ data: { list: normalizedList, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
