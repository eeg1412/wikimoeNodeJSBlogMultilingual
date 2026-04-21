const { postPublishSchema } = require('@wikimoe-ml/common/validation')
const { badRequest } = require('../../../utils/errors')
const {
  validatePostForPublish
} = require('../../../services/publishValidationService')
const { Posts } = require('../../../mongodb/models')

/**
 * POST /api/admin/post/validate
 * 只读校验，不修改 status；但会把本次校验结果写入 validationState
 */
module.exports = async function validatePostApi(req, res) {
  const { value, error } = postPublishSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const result = await validatePostForPublish(value._id)
  await Posts.updateOne(
    { _id: value._id },
    {
      $set: {
        'validationState.passed': result.passed,
        'validationState.checkedAt': new Date(),
        'validationState.issues': result.issues
      }
    }
  )
  res.json({ data: result })
}
