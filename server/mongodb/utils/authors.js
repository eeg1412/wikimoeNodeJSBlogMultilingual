import Author from '../models/author.js'
import { findGroupedDocumentPage } from './groupedDocuments.js'

export async function findAuthorPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Author.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Author.countDocuments(query)
  ])
  return { list, total }
}

export async function findAuthorGroupPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  return findGroupedDocumentPage({
    Model: Author,
    query,
    page,
    limit,
    groupField: 'sourceId',
    preGroupSort: { createdAt: -1 }
  })
}

export async function findAuthorBySourceIdLang(sourceId, languageCode) {
  return Author.findOne({ sourceId, languageCode }).lean()
}

export async function updateAuthorById(id, updateData) {
  return Author.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
