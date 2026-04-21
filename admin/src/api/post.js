import http from './http'

export const listPostsApi = params => http.get('/post/list', { params })

export const getPostApi = id => http.get('/post/detail', { params: { id } })

export const updatePostApi = payload => http.post('/post/update', payload)

export const validatePostApi = _id => http.post('/post/validate', { _id })

export const publishPostApi = _id => http.post('/post/publish', { _id })

export const unpublishPostApi = _id => http.post('/post/unpublish', { _id })
