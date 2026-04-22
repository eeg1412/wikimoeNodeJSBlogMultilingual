import Sort from '../../../mongodb/models/sort.js'

export default async function blogSortListHandler(req, res, next) {
  try {
    const { lang } = req.params
    const list = await Sort.find({ languageCode: lang })
      .sort({ taxis: 1 })
      .lean()
    return res.json({ data: list })
  } catch (err) {
    next(err)
  }
}
