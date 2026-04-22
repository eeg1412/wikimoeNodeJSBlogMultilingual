import { findImportJobPage } from '../../../mongodb/utils/importJobs.js'

export default async function importJobListHandler(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const query = {}
    if (req.query.languageCode) {
      query.languageCode = req.query.languageCode
    }
    const { list, total } = await findImportJobPage({ query, page, limit })
    return res.json({ data: { list, total, page, limit } })
  } catch (err) {
    next(err)
  }
}
