import request from '../utils/request.js'

export function getAuthorList(params) {
  return request.get('/author/list', { params })
}
export function updateAuthor(id, data) {
  return request.put(`/author/update/${id}`, data)
}

export function getSortList(params) {
  return request.get('/sort/list', { params })
}
export function updateSort(id, data) {
  return request.put(`/sort/update/${id}`, data)
}

export function getTagList(params) {
  return request.get('/tag/list', { params })
}
export function updateTag(id, data) {
  return request.put(`/tag/update/${id}`, data)
}

export function getMappointList(params) {
  return request.get('/mappoint/list', { params })
}
export function updateMappoint(id, data) {
  return request.put(`/mappoint/update/${id}`, data)
}
