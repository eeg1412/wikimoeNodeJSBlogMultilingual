import http from './http'

export const translateTextApi = payload =>
  http.post('/translation/text', payload)
export const translateHtmlApi = payload =>
  http.post('/translation/html', payload)

export const listTranslationMemoriesApi = params =>
  http.get('/translation/memory/list', { params })

export const approveTranslationMemoryApi = payload =>
  http.post('/translation/memory/approve', payload)

export const deleteTranslationMemoryApi = id =>
  http.post('/translation/memory/delete', { id })
