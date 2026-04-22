import request from '../utils/request.js'

export function login(data) {
  return request.post('/login', data)
}

export function getLoginUserInfo() {
  return request.get('/loginuserinfo')
}

export function getLoginLogList(params) {
  return request.get('/adminloginlog/list', { params })
}

export function regenerateJwtSecret() {
  return request.put('/security/admin-jwt-secret/regenerate')
}
