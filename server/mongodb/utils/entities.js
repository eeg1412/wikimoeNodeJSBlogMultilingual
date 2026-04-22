import { Bangumi, Movie, Game, Book, Event } from '../models/entities.js'

const modelMap = { Bangumi, Movie, Game, Book, Event }

function getModel(entityType) {
  const model = modelMap[entityType]
  if (!model) throw new Error(`未知实体类型: ${entityType}`)
  return model
}

export async function findEntityPage({
  entityType,
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const Model = getModel(entityType)
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Model.countDocuments(query)
  ])
  return { list, total }
}

export async function findEntityBySourceIdLang(
  entityType,
  sourceId,
  languageCode
) {
  const Model = getModel(entityType)
  return Model.findOne({ sourceId, languageCode }).lean()
}

export async function updateEntityById(entityType, id, updateData) {
  const Model = getModel(entityType)
  return Model.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}
