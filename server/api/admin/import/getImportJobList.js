const { listImportJobs } = require('../../../services/import/importService')

module.exports = async function (req, res, next) {
  try {
    const result = await listImportJobs(req.query)
    res.json({
      list: result.list,
      total: result.total,
      page: result.page,
      size: result.limit
    })
  } catch (error) {
    next(error)
  }
}
