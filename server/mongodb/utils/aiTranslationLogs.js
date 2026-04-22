import AiTranslationLog from '../models/aiTranslationLog.js'

export async function findAiTranslationLogPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    AiTranslationLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AiTranslationLog.countDocuments(query)
  ])
  return { list, total }
}
