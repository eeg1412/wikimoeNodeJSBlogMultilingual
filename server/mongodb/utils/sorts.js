import Sort from '../models/sort.js'

export async function findSortPage({ query = {}, page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Sort.find(query)
      .sort({ taxis: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Sort.countDocuments(query)
  ])
  return { list, total }
}

export async function findSortBySourceIdLang(sourceId, languageCode) {
  return Sort.findOne({ sourceId, languageCode }).lean()
}

export async function updateSortById(id, updateData) {
  return Sort.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
