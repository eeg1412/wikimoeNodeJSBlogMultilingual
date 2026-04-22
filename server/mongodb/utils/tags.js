import Tag from '../models/tag.js'

export async function findTagPage({ query = {}, page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Tag.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Tag.countDocuments(query)
  ])
  return { list, total }
}

export async function findTagBySourceIdLang(sourceId, languageCode) {
  return Tag.findOne({ sourceId, languageCode }).lean()
}

export async function updateTagById(id, updateData) {
  return Tag.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
