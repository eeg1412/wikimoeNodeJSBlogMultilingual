import { createAPI } from './create-api'
import auth from './module/auth'
import multilingual from './module/multilingual'
import { showLoading, hideLoading } from '@/utils/utils'
import { extractApiErrorMessages } from '@/utils/apiError'
import { ElMessage } from 'element-plus'
import router from '@/router'
import store from '../store'

function showErrorMessages(error) {
  const messageList = extractApiErrorMessages(error)
  messageList.forEach(message => {
    ElMessage.error({
      message,
      'custom-class': 'common-message-error'
    })
  })

  return messageList
}

const api = createAPI({ baseURL: '/api/multilingual-admin' })
//请求拦截器
api.interceptors.request.use(
  config => {
    const data = config.data || {}
    let shouldAdminJWT = config.shouldAdminJWT

    if (shouldAdminJWT && store.getters.adminToken) {
      config.headers['Authorization'] = `Bearer ${store.getters.adminToken}`
    }
    const noLoading = config.noLoading
    if (!noLoading) {
      showLoading()
    }
    return config
  },
  error => {
    const config = error.response?.config || {}
    const noLoading = config.noLoading
    if (!noLoading) {
      hideLoading()
    }
    return Promise.reject(error)
  }
)

//响应拦截器
let goLoginFlagTimer = null
api.interceptors.response.use(
  response => {
    const config = response.config
    const noLoading = config.noLoading
    if (!noLoading) {
      hideLoading()
    }
    return response
  },
  async error => {
    const status = error?.response?.status
    const config = error.response?.config || {}
    const noLoading = config.noLoading
    if (!noLoading) {
      hideLoading()
    }

    const messageList = showErrorMessages(error)

    switch (status) {
      case 400:
      case 409:
        break
      case 403:
        if (status === 403) {
          clearTimeout(goLoginFlagTimer)
          goLoginFlagTimer = setTimeout(() => {
            router.replace({ name: 'Login' })
          }, 200)
        }
        break
      case 401:
        const routeName = router.currentRoute.value.name
        if (routeName !== 'Login') {
          clearTimeout(goLoginFlagTimer)
          goLoginFlagTimer = setTimeout(() => {
            if (!messageList.includes('请重新登录')) {
              ElMessage.error({
                message: '请重新登录',
                'custom-class': 'common-message-error'
              })
            }
            router.replace({ name: 'Login' })
          }, 200)
        }
        break
      case 503:
        break
      default:
        console.error(error)
        break
    }
    return Promise.reject(error)
  }
)

export const authApi = auth(api)
export const multilingualApi = multilingual(api)
