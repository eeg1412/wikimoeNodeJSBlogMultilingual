import request from '../utils/request.js'

export function getTranslationMemoryList(params) {
  return request.get('/translation-memory/list', { params })
}

export function approveTranslationMemory(id) {
  return request.post(`/translation-memory/approve/${id}`)
}

export function getAiTranslationLogList(params) {
  return request.get('/aitranslationlog/list', { params })
}
