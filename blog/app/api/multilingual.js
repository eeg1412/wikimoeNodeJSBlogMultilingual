import {
  DEFAULT_LANGUAGE_CODE,
  getLanguageText,
  normalizeLanguageCode
} from '@/lang'

const MULTILINGUAL_BASE_URL = '/api/multilingual-blog'

export const MULTILINGUAL_ENDPOINT_PREFIXES = [
  '/post/list',
  '/post/archive',
  '/post/detail',
  '/sort/',
  '/tag/',
  '/mappoint/',
  '/bangumi/',
  '/movie/',
  '/game/',
  '/book/',
  '/booktype/',
  '/event/',
  '/vote',
  '/vote/',
  '/attachment/',
  '/navi/',
  '/banner/',
  '/sidebar/',
  '/trend/'
]

function getRouteCode() {
  if (typeof useRoute !== 'function') {
    return null
  }

  try {
    const route = useRoute()
    const code = route.params.code

    if (Array.isArray(code)) {
      return code[0]
    }

    return code
  } catch (error) {
    return null
  }
}

function getRequestLanguageCode(data, options = {}) {
  const optionLanguageCode = normalizeLanguageCode(options.languageCode)
  if (optionLanguageCode) {
    return optionLanguageCode
  }

  if (data && typeof data === 'object') {
    const dataLanguageCode = normalizeLanguageCode(data.languageCode)
    if (dataLanguageCode) {
      return dataLanguageCode
    }
  }

  return normalizeLanguageCode(getRouteCode()) || DEFAULT_LANGUAGE_CODE
}

function omitClientOnlyOptions(options = {}) {
  const { languageCode, ...requestOptions } = options
  return requestOptions
}

function createRequestParams(data, options) {
  const params = data && typeof data === 'object' ? { ...data } : {}
  params.languageCode = getRequestLanguageCode(data, options)
  return params
}

function createRequestBody(data, options) {
  const body = data && typeof data === 'object' ? { ...data } : {}
  body.languageCode = getRequestLanguageCode(data, options)
  return body
}

function createRequestOptions(method, data, options = {}) {
  const requestOptions = {
    baseURL: MULTILINGUAL_BASE_URL,
    method,
    ...omitClientOnlyOptions(options)
  }

  if (method === 'GET' || method === 'DELETE') {
    requestOptions.params = createRequestParams(data, options)
  }

  if (method === 'POST' || method === 'PUT') {
    requestOptions.body = createRequestBody(data, options)
  }

  return requestOptions
}

class MultilingualHttpRequest {
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
              message: getLanguageText(
                getRequestLanguageCode(data, options),
                'common.error.maintenance'
              )
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
    const requestOptions = createRequestOptions('GET', data, options)
    return this.requestFetch(url, requestOptions)
  }

  postFetch(url, data, options = {}) {
    const requestOptions = createRequestOptions('POST', data, options)
    return this.requestFetch(url, requestOptions)
  }

  putFetch(url, data, options = {}) {
    const requestOptions = createRequestOptions('PUT', data, options)
    return this.requestFetch(url, requestOptions)
  }

  deleteFetch(url, data, options = {}) {
    const requestOptions = createRequestOptions('DELETE', data, options)
    return this.requestFetch(url, requestOptions)
  }
}

const multilingualHttpRequest = new MultilingualHttpRequest()

export default multilingualHttpRequest
