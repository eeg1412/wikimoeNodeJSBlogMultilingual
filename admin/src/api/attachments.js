import http from './http'

export const listAttachmentsApi = params =>
  http.get('/attachments/list', { params })

export const uploadAttachmentApi = (formData, onProgress) =>
  http.post('/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
  })

export const registerRemoteAttachmentApi = payload =>
  http.post('/attachments/register-remote', payload)

export const updateAttachmentApi = payload =>
  http.post('/attachments/update', payload)

export const deleteAttachmentApi = _id =>
  http.post('/attachments/delete', { _id })
