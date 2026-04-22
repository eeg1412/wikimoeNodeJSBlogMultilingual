const { getPostDetail } = require('../../../services/postEditorService')

module.exports = async function (req, res, next) {
  try {
    const data = await getPostDetail(req.query)
    res.json({ data })
  } catch (error) {
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