import multilingualRequest, {
  MULTILINGUAL_ENDPOINT_PREFIXES
} from './multilingual'
import sourceRequest, { SOURCE_ENDPOINT_PREFIXES } from './source'

function matchEndpoint(url, endpoint) {
  if (endpoint.endsWith('/')) {
    return url.startsWith(endpoint)
  }

  return url === endpoint
}

function isSourceApiUrl(url) {
  return SOURCE_ENDPOINT_PREFIXES.some(endpoint => matchEndpoint(url, endpoint))
}

function isMultilingualApiUrl(url) {
  return MULTILINGUAL_ENDPOINT_PREFIXES.some(endpoint =>
    matchEndpoint(url, endpoint)
  )
}

function getRequestClient(url) {
  if (isSourceApiUrl(url)) {
    return sourceRequest
  }

  if (isMultilingualApiUrl(url)) {
    return multilingualRequest
  }

  return multilingualRequest
}

const httpRequest = {
  get(url, params, options) {
    return getRequestClient(url).get(url, params, options)
  },

  post(url, data, options) {
    return getRequestClient(url).post(url, data, options)
  },

  put(url, data, options) {
    return getRequestClient(url).put(url, data, options)
  },

  delete(url, params, options) {
    return getRequestClient(url).delete(url, params, options)
  },

  getFetch(url, data, options) {
    return getRequestClient(url).getFetch(url, data, options)
  },

  postFetch(url, data, options) {
    return getRequestClient(url).postFetch(url, data, options)
  },

  putFetch(url, data, options) {
    return getRequestClient(url).putFetch(url, data, options)
  },

  deleteFetch(url, data, options) {
    return getRequestClient(url).deleteFetch(url, data, options)
  }
}

export {
  isMultilingualApiUrl,
  isSourceApiUrl,
  multilingualRequest,
  sourceRequest
}

export default httpRequest
