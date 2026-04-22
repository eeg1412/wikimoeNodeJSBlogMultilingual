import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api/admin',
  timeout: 30000
})

// 请求拦截 - 注入 JWT
request.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 响应拦截 - 统一错误处理
request.interceptors.response.use(
  res => res.data,
  err => {
    const status = err.response?.status
    const message = err.response?.data?.message || err.message || '请求失败'

    if (status === 401) {
      // 如果当前已在登录页（如密码错误），不触发跳转，让调用方处理
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('admin_token')
        window.location.href = '/multilingual-admin/login'
        return Promise.reject(err)
      }
      return Promise.reject(err)
    }

    ElMessage.error(message)
    return Promise.reject(err)
  }
)

export default request
