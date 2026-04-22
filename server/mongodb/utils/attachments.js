import Attachment from '../models/attachment.js'

export async function findAttachmentPage({
  query = {},
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Attachment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attachment.countDocuments(query)
  ])
  return { list, total }
}

export async function findAttachmentById(id) {
  return Attachment.findById(id).lean()
}

export async function updateAttachmentById(id, updateData) {
  return Attachment.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true
  })
}

export async function deleteAttachmentById(id) {
  return Attachment.findByIdAndDelete(id)
}
