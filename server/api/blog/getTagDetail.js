const { Tags } = require('../../mongodb/models')
const { parseLang, isObjectId } = require('./_helpers')
const { badRequest, notFound } = require('../../utils/errors')

module.exports = async function getTagDetail(req, res) {
  const lang = parseLang(req)
  const rawId = String(req.query.id || '').trim()
  if (!rawId) {
    throw badRequest('id 不能为空')
  }
  if (!isObjectId(rawId)) {
    throw badRequest('id 参数错误')
  }
  const tag = await Tags.findOne({
    _id: rawId,
    languageCode: lang
  }).lean()
  if (!tag) {
    throw notFound('标签不存在')
  }
  res.json({
    data: {
      _id: tag._id,
      sourceId: tag.sourceId,
      tagname: tag.tagname
    }
  })
}
