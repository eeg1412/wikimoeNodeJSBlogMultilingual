import Mappoint from '../models/mappoint.js'
import { findGroupedDocumentPage } from './groupedDocuments.js'

export async function findMappointPage({
  query = {},
  page = 1,
  limit = 50
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Mappoint.find(query)
      .sort({ zIndex: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Mappoint.countDocuments(query)
  ])
  return { list, total }
}

export async function findMappointGroupPage({
  query = {},
  page = 1,
  limit = 50
} = {}) {
  return findGroupedDocumentPage({
    Model: Mappoint,
    query,
    page,
    limit,
    groupField: 'sourceId',
    preGroupSort: { zIndex: -1, createdAt: -1 }
  })
}

export async function findMappointBySourceIdLang(sourceId, languageCode) {
  return Mappoint.findOne({ sourceId, languageCode }).lean()
}

export async function updateMappointById(id, updateData) {
  return Mappoint.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
