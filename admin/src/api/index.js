import { ElMessage } from 'element-plus'

import { clearAdminToken, getAdminToken } from '@/utils/adminSession'

async function request(path, options = {}) {
  const finalOptions = options || {}
  const headers = {
    'Content-Type': 'application/json'
  }
  const token = getAdminToken()

  if (finalOptions.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`/api/admin${path}`, {
    method: finalOptions.method || 'GET',
    headers,
    body: finalOptions.body ? JSON.stringify(finalOptions.body) : undefined
  })

  let payload = null
  try {
    payload = await response.json()
  } catch (error) {
    payload = null
  }

  if (!response.ok) {
    const error = new Error('请求失败')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function showRequestErrors(error) {
  const errors = error && error.payload ? error.payload.errors : null

  if (Array.isArray(errors) && errors.length > 0) {
    for (const item of errors) {
      ElMessage.error(item.message)
    }
    return
  }

  if (error && error.message) {
    ElMessage.error(error.message)
  }
}

function handleAuthFailure(error) {
  if (error && (error.status === 401 || error.status === 403)) {
    clearAdminToken()
  }
}

export async function loginApi(data) {
  return request('/login', {
    method: 'POST',
    auth: false,
    body: data
  })
}

export async function importPostApi(data) {
  return request('/import/post', {
    method: 'POST',
    body: data
  })
}

export async function getImportJobListApi(params) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || typeof value === 'undefined' || value === '') {
        continue
      }
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const path = queryString
    ? `/import/job/list?${queryString}`
    : '/import/job/list'

  return request(path)
}

export async function regenerateAdminSecretApi() {
  return request('/security/admin-jwt-secret/regenerate', {
    method: 'PUT',
    body: {}
  })
}

export async function getOptionListApi(params) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || typeof value === 'undefined' || value === '') {
        continue
      }
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const path = queryString ? `/option/list?${queryString}` : '/option/list'
  return request(path)
}

export async function updateOptionApi(items) {
  return request('/option/update', {
    method: 'PUT',
    body: {
      items
    }
  })
}

export async function getPostDetailApi(id) {
  const searchParams = new URLSearchParams({ id })
  return request(`/post/detail?${searchParams.toString()}`)
}

export async function validatePostApi(id) {
  const searchParams = new URLSearchParams({ id })
  return request(`/post/publish-validate?${searchParams.toString()}`)
}

export async function updatePostApi(data) {
  return request('/post/update', {
    method: 'PUT',
    body: data
  })
}

export async function getAdminPostListApi(params) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || typeof value === 'undefined' || value === '') {
        continue
      }
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const path = queryString ? `/post/list?${queryString}` : '/post/list'
  return request(path)
}

export async function getEntityOptionsApi(params) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || typeof value === 'undefined' || value === '') {
        continue
      }
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const path = queryString
    ? `/option/entity-options?${queryString}`
    : '/option/entity-options'
  return request(path)
}

export async function getAdminLoginLogListApi(params) {
  const searchParams = new URLSearchParams()

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || typeof value === 'undefined' || value === '') {
        continue
      }
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  const path = queryString
    ? `/auth/login-log/list?${queryString}`
    : '/auth/login-log/list'
  return request(path)
}

export { handleAuthFailure, showRequestErrors }
