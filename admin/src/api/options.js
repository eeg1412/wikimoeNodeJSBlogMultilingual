import http from './http'

export const listOptionsApi = () => http.get('/options')

export const updateOptionsApi = updates =>
  http.post('/options/update', { updates })
