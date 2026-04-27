const SOURCE_BASE_URL = '/api/source-blog'

export const SOURCE_ENDPOINT_PREFIXES = [
  '/options',
  '/comment/',
  '/post/like/log',
  '/post/like/log/list',
  '/comment/like/log',
  '/comment/like/log/list',
  '/link/list'
]

function createRequestOptions(method, data, options = {}) {
  const requestOptions = {
    baseURL: SOURCE_BASE_URL,
    method,
    ...options
  }

  if (method === 'GET' || method === 'DELETE') {
    requestOptions.params = data
  }

  if (method === 'POST' || method === 'PUT') {
    requestOptions.body = data
  }

  return requestOptions
}

class SourceHttpRequest {
  request(url, method, data, options) {
    return new Promise((resolve, reject) => {
      const requestOptions = createRequestOptions(method, data, options)

      useFetch(url, requestOptions)
        .then(res => {
          if (res.error?.value) {
            const statusCode = res.error?.value?.statusCode
            console.log('statusCode', statusCode)
            showError({
              statusCode: statusCode || 500,
              message: '服务器正在维护中，请稍后再试。'
            })
          } else {
            resolve(res)
          }
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  requestFetch(url, options) {
    const shouldUuid = options.shouldUuid
    if (shouldUuid && import.meta.client) {
      const uuid = checkUuid()
      delete options.shouldUuid
      if (uuid) {
        options.headers = {
          ...options.headers,
          'wmb-request-id': uuid
        }
      }
    }

    const shouldCommentRetractJWT = options.shouldCommentRetractJWT
    if (shouldCommentRetractJWT && import.meta.client) {
      const commentRetractJWT = localStorage.getItem('commentRetractJWT')
      delete options.shouldCommentRetractJWT
      if (commentRetractJWT) {
        options.headers = {
          ...options.headers,
          'wm-comment-retract-authorization': `Bearer ${commentRetractJWT}`
        }
      }
    }

    return new Promise((resolve, reject) => {
      $fetch(url, options)
        .then(res => {
          resolve(res)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  get(url, params, options) {
    return this.request(url, 'GET', params, options)
  }

  post(url, data, options) {
    return this.request(url, 'POST', data, options)
  }

  put(url, data, options) {
    return this.request(url, 'PUT', data, options)
  }

  delete(url, params, options) {
    return this.request(url, 'DELETE', params, options)
  }

  getFetch(url, data, options = {}) {
    options.method = 'GET'
    options.baseURL = SOURCE_BASE_URL
    options.params = data
    return this.requestFetch(url, options)
  }

  postFetch(url, data, options = {}) {
    options.method = 'POST'
    options.baseURL = SOURCE_BASE_URL
    options.body = data
    return this.requestFetch(url, options)
  }

  putFetch(url, data, options = {}) {
    options.method = 'PUT'
    options.baseURL = SOURCE_BASE_URL
    options.body = data
    return this.requestFetch(url, options)
  }

  deleteFetch(url, data, options = {}) {
    options.method = 'DELETE'
    options.baseURL = SOURCE_BASE_URL
    options.params = data
    return this.requestFetch(url, options)
  }
}

const sourceHttpRequest = new SourceHttpRequest()

export default sourceHttpRequest
