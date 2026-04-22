const { updateOptions } = require('../../../services/optionService')

module.exports = async function (req, res, next) {
  try {
    const result = await updateOptions(req.body)
    res.json({
      data: result
    })
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
