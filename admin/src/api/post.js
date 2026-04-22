import request from '../utils/request.js'

export function getPostGroupList(params) {
  return request.get('/post/group/list', { params })
}

export function getPostDetail(id) {
  return request.get(`/post/detail/${id}`)
}

export function updatePost(id, data) {
  return request.put(`/post/update/${id}`, data)
}

export function translatePost(id, data) {
  return request.post(`/post/translate/${id}`, data)
}

export function publishPost(id) {
  return request.post(`/post/publish/${id}`)
}

export function unpublishPost(id) {
  return request.post(`/post/unpublish/${id}`)
}
