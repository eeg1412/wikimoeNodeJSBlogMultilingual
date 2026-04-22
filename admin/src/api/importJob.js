import request from '../utils/request.js'

export function importPost(data) {
  return request.post('/import/post', data)
}

export function getImportJobList(params) {
  return request.get('/import/job/list', { params })
}
