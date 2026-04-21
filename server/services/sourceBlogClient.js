const axios = require('axios')
const env = require('../config/env')
const HttpError = require('../utils/httpError')

const client = axios.create({
  baseURL: env.SOURCE_BLOG_API_BASE_URL.replace(/\/$/, ''),
  timeout: 20000
})

async function requestPostDetail(params) {
  try {
    const response = await client.get('/api/blog/post/detail', {
      params,
      paramsSerializer: {
        indexes: false
      }
    })
    return response.data?.data
  } catch (error) {
    if (error.response?.status === 404) {
      return null
    }
    throw new HttpError(
      error.response?.status || 502,
      '原站文章详情获取失败',
      error.response?.data || error.message
    )
  }
}

async function resolveImportablePost(sourceIdentifier) {
  const detail = await requestPostDetail({ id: sourceIdentifier, type: [1, 2] })
  if (detail) {
    return detail
  }

  const fallbackDetail = await requestPostDetail({ id: sourceIdentifier })
  if (!fallbackDetail) {
    throw new HttpError(404, '文章不存在')
  }
  if (fallbackDetail.type === 3) {
    throw new HttpError(400, '页面不支持导入')
  }

  return fallbackDetail
}

module.exports = {
  resolveImportablePost
}