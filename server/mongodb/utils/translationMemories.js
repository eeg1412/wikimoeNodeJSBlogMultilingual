import TranslationMemory from '../models/translationMemory.js'

export async function findTranslationMemoryPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    TranslationMemory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TranslationMemory.countDocuments(query)
  ])
  return { list, total }
}

export async function updateTranslationMemoryById(id, updateData) {
  return TranslationMemory.findByIdAndUpdate(id, updateData, { new: true })
}
