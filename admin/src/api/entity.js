import http from './http'

export const listEntityApi = (type, params) =>
  http.get(`/entity/${type}/list`, { params })

export const getEntityDetailApi = (type, _id) =>
  http.get(`/entity/${type}/detail`, { params: { _id } })

export const updateEntityApi = (type, payload) =>
  http.post(`/entity/${type}/update`, payload)

export const approveEntityApi = (type, _id) =>
  http.post(`/entity/${type}/approve`, { _id })

export const translateEntityApi = (type, _id, fields) =>
  http.post(`/entity/${type}/translate`, { _id, fields })
