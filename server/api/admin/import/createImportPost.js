const { importPost } = require('../../../services/import/importService')

module.exports = async function (req, res, next) {
  try {
    const result = await importPost(req.body, req.adminUser._id)
    res.json({
      data: result
    })
  } catch (error) {
    if (error && error.code === 'DUPLICATE_IMPORT') {
      res.status(409).json({
        errors: [
          {
            message: error.message,
            existingPostId: error.meta && error.meta.existingPostId
          }
        ]
      })
      return
    }

    if (error && error.isJoi) {
      res.status(400).json({
        errors: error.details.map(function (detail) {
          return {
            message: detail.message
          }
        })
      })
      return
    }

    next(error)
  }
}
