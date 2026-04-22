import { findLoginLogs } from '../../../mongodb/utils/adminUsers.js'

export default async function loginLogListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const { list, total } = await findLoginLogs({ page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
