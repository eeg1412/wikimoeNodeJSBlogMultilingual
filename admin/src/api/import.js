import http from './http'

export const importApi = {
  importPost(payload) {
    return http.post('/import/post', payload)
  }
}
