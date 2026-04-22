import request from '../utils/request.js'

function makeEntityApi(prefix) {
  return {
    getList: params => request.get(`/${prefix}/list`, { params }),
    update: (id, data) => request.put(`/${prefix}/update/${id}`, data)
  }
}

export const bangumiApi = makeEntityApi('bangumi')
export const movieApi = makeEntityApi('movie')
export const gameApi = makeEntityApi('game')
export const bookApi = makeEntityApi('book')
export const eventApi = makeEntityApi('event')

export function getVoteList(params) {
  return request.get('/vote/list', { params })
}
export function updateVote(id, data) {
  return request.put(`/vote/update/${id}`, data)
}
