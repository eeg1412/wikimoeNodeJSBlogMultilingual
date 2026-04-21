const { Sorts } = require('../../mongodb/models')
const { parseLang, isObjectId } = require('./_helpers')
const { badRequest, notFound } = require('../../utils/errors')

module.exports = async function getSortDetail(req, res) {
  const lang = parseLang(req)
  const rawId = String(req.query.id || '').trim()
  if (!rawId) {
    throw badRequest('id 不能为空')
  }
  const filter = { languageCode: lang }
  if (isObjectId(rawId)) {
    filter._id = rawId
  } else {
    filter.alias = rawId
  }
  const sort = await Sorts.findOne(filter).lean()
  if (!sort) {
    throw notFound('分类不存在')
  }
  res.json({
    data: {
      _id: sort._id,
      sourceId: sort.sourceId,
      sortname: sort.sortname,
      alias: sort.alias,
      description: sort.description,
      taxis: sort.taxis,
      parent: sort.parent
    }
  })
}
