const { postListQuerySchema } = require('@wikimoe-ml/common/validation')
const { Posts } = require('../../../mongodb/models')
const { badRequest } = require('../../../utils/errors')

/**
 * GET /api/admin/post/list
 * 单语言扁平列表，按 updatedAt 倒序
 */
module.exports = async function listPostsApi(req, res) {
  const { value, error } = postListQuerySchema.validate(req.query || {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const filter = {}
  if (value.languageCode) filter.languageCode = value.languageCode
  if (typeof value.type === 'number') filter.type = value.type
  if (typeof value.status === 'number') filter.status = value.status
  if (value.sort) filter.sort = value.sort
  if (value.tag) filter.tags = value.tag
  if (value.mappoint) filter.mappointList = value.mappoint
  if (value.groupSourceId) filter.groupSourceId = value.groupSourceId
  if (value.keyword) {
    const re = new RegExp(
      value.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
    filter.$or = [{ title: re }, { alias: re }, { sourceId: re }]
  }

  const page = value.page || 1
  const limit = value.limit || 20
  const [list, total] = await Promise.all([
    Posts.find(filter, {
      content: 0,
      sourceSnapshot: 0
    })
      .populate({ path: 'author', select: 'nickname' })
      .populate({ path: 'sort', select: 'sortname' })
      .populate({ path: 'tags', select: 'tagname' })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Posts.countDocuments(filter)
  ])
  res.json({ data: { list, total, page, limit } })
}
