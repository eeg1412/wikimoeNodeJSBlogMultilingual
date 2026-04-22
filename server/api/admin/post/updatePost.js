const { updatePost } = require('../../../services/postEditorService')

module.exports = async function (req, res, next) {
  try {
    const data = await updatePost(req.body, req.admin._id)
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

    if (error && error.validationState) {
      res.status(400).json({
        errors: error.validationState.errors.map(function (message) {
          return { message }
        }),
        data: {
          validationState: error.validationState
        }
      })
      return
    }

    next(error)
  }
}