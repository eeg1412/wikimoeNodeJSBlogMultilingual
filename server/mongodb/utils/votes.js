import Vote from '../models/vote.js'

export async function findVotePage({ query = {}, page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Vote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Vote.countDocuments(query)
  ])
  return { list, total }
}

export async function findVoteBySourceIdLang(sourceId, languageCode) {
  return Vote.findOne({ sourceId, languageCode }).lean()
}

export async function updateVoteById(id, updateData) {
  return Vote.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
