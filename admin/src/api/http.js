import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { ElMessage } from 'element-plus'

const http = axios.create({
  baseURL: '/api/admin',
  timeout: 30000
})

http.interceptors.request.use(config => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

http.interceptors.response.use(
  resp => resp.data,
  err => {
    const payload = err?.response?.data
    const errs = Array.isArray(payload?.errors) ? payload.errors : null
    const firstErr = errs && errs[0]
    const message = firstErr?.message ? firstErr.message : err.message
    const status = err?.response?.status
    if (status === 401) {
      const auth = useAuthStore()
      auth.clear()
      if (location.pathname.indexOf('/multilingual-admin/login') !== 0) {
        location.href = '/multilingual-admin/login'
      }
    } else if (status === 409 && firstErr?.code === 'POST_EXISTS') {
      // 交由调用方以确认对话框处理
    } else {
      ElMessage.error(message || '请求失败')
    }
    return Promise.reject(err)
  }
)

export default http
