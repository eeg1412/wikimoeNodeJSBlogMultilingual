import Mappoint from '../../../mongodb/models/mappoint.js'

export default async function blogMappointDetailHandler(req, res, next) {
  try {
    const { lang, id } = req.params

    const mappoint =
      (await Mappoint.findOne({
        sourceId: id,
        languageCode: lang,
        status: 1
      }).lean()) ||
      (await Mappoint.findOne({ _id: id, languageCode: lang, status: 1 })
        .lean()
        .catch(() => null))

    if (!mappoint) {
      return res.status(404).json({ message: '地点不存在' })
    }

    return res.json({ data: mappoint })
  } catch (err) {
    next(err)
  }
}
