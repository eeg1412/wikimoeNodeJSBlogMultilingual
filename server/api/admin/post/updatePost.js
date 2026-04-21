const mongoose = require('mongoose')
const { postUpdateSchema } = require('@wikimoe-ml/common/validation')
const { Posts } = require('../../../mongodb/models')
const { badRequest, notFound } = require('../../../utils/errors')

/**
 * POST /api/admin/post/update
 * 仅更新翻译相关可编辑字段，禁止修改 sourceId/languageCode/groupSourceId/sourceHash/importMeta
 */
module.exports = async function updatePostApi(req, res) {
  const { value, error } = postUpdateSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const { _id, ...patch } = value
  if (!mongoose.isValidObjectId(_id)) {
    throw badRequest('非法的文章 ID')
  }
  const post = await Posts.findById(_id)
  if (!post) throw notFound('文章不存在')

  Object.keys(patch).forEach(key => {
    if (patch[key] !== undefined) {
      post[key] = patch[key]
    }
  })
  post.isManualEdited = true
  post.lastChangDate = new Date()
  await post.save()
  res.json({ data: { _id: String(post._id) } })
}
