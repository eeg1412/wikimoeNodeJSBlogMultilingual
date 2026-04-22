import request from '../utils/request.js'

export function getAttachmentList(params) {
  return request.get('/attachment/list', { params })
}

export function updateAttachment(id, data) {
  return request.put(`/attachment/update/${id}`, data)
}

export function uploadLocalizedAttachment(formData, onProgress) {
  return request.post('/attachment/upload-localized', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  })
}
