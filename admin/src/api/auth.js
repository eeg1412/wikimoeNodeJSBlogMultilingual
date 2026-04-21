import http from './http'

export const authApi = {
  login(payload) {
    return http.post('/login', payload)
  },
  me() {
    return http.get('/me')
  }
}
