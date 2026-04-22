import ImportJob from '../models/importJob.js'

export async function findImportJobPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    ImportJob.find(query, { sourcePayload: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ImportJob.countDocuments(query)
  ])
  return { list, total }
}

export async function findImportJobById(id) {
  return ImportJob.findById(id).lean()
}
