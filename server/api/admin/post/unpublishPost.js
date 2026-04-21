const { postPublishSchema } = require('@wikimoe-ml/common/validation')
const { badRequest, notFound } = require('../../../utils/errors')
const { unpublishPost } = require('../../../services/publishValidationService')

/**
 * POST /api/admin/post/unpublish
 * 将已发布文章回退为草稿，并刷新对应语言缓存。
 */
module.exports = async function unpublishPostApi(req, res) {
  const { value, error } = postPublishSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const result = await unpublishPost(value._id)
  if (!result) throw notFound('文章不存在')
  res.json({ data: result })
}
