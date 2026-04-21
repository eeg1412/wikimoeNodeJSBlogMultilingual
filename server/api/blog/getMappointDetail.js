const { Mappoints } = require('../../mongodb/models')
const { parseLang, isObjectId } = require('./_helpers')
const { badRequest, notFound } = require('../../utils/errors')

module.exports = async function getMappointDetail(req, res) {
  const lang = parseLang(req)
  const rawId = String(req.query.id || '').trim()
  if (!rawId) {
    throw badRequest('id 不能为空')
  }
  if (!isObjectId(rawId)) {
    throw badRequest('id 参数错误')
  }
  const mp = await Mappoints.findOne({
    _id: rawId,
    languageCode: lang
  }).lean()
  if (!mp) {
    throw notFound('地点不存在')
  }
  res.json({
    data: {
      _id: mp._id,
      sourceId: mp.sourceId,
      title: mp.title,
      summary: mp.summary,
      longitude: mp.longitude,
      latitude: mp.latitude,
      zIndex: mp.zIndex,
      status: mp.status
    }
  })
}
