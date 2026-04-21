import axios from 'axios'
import store from '@/store'

const http = axios.create({
  baseURL: '/api/admin',
  timeout: 30000
})

http.interceptors.request.use(config => {
  const token = store.getters.adminToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  response => response,
  error => {
    const message =
      error.response?.data?.errors?.[0]?.message || error.message || '请求失败'
    if (error.response?.status === 401) {
      store.commit('clearAuth')
      const loginPath = `${import.meta.env.BASE_URL}login`
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath
      }
    }
    return Promise.reject(new Error(message))
  }
)

function unwrap(promise) {
  return promise.then(response => response.data.data)
}

export const authApi = {
  getEntityDetail(entityType, id) {
    return unwrap(http.get(`/${entityType}/detail`, { params: { id } }))
  },
  getEntityList(entityType, params) {
    return unwrap(http.get(`/${entityType}/list`, { params }))
  },
  getImportJobs(params) {
    return unwrap(http.get('/import/job/list', { params }))
  },
  getOptionList() {
    return unwrap(http.get('/option/list'))
  },
  getPostDetail(id) {
    return unwrap(http.get('/post/detail', { params: { id } }))
  },
  getPostGroupList(params) {
    return unwrap(http.get('/post/group/list', { params }))
  },
  getPostList(params) {
    return unwrap(http.get('/post/list', { params }))
  },
  getTranslationLogs(params) {
    return unwrap(http.get('/aitranslationlog/list', { params }))
  },
  importPost(payload) {
    return unwrap(http.post('/import/post', payload))
  },
  login(payload) {
    return unwrap(http.post('/login', payload))
  },
  publishPost(id) {
    return unwrap(http.post('/post/publish', { id }))
  },
  translateAll(payload) {
    return unwrap(http.post('/post/translate-all', payload))
  },
  translateField(payload) {
    return unwrap(http.post('/post/translate-field', payload))
  },
  translateHtml(payload) {
    return unwrap(http.post('/post/translate-html', payload))
  },
  unpublishPost(id) {
    return unwrap(http.post('/post/unpublish', { id }))
  },
  updateEntity(entityType, payload) {
    return unwrap(http.put(`/${entityType}/update`, payload))
  },
  updateOption(payload) {
    return unwrap(http.put('/option/update', payload))
  },
  updatePost(payload) {
    return unwrap(http.put('/post/update', payload))
  },
  uploadLocalizedAttachment(payload) {
    return unwrap(
      http.post('/attachment/upload-localized', payload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    )
  }
}

export { http }
export default authApi