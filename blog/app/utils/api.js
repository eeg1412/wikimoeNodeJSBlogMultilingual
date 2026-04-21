// 前台统一 API 客户端，所有接口都走 runtime config 的 apiDomain。
// 注意：每个接口都带 lang 参数。

function apiBase() {
  const config = useRuntimeConfig()
  return config.public.apiDomain
}

export async function fetchSiteOptions() {
  return await $fetch('/api/blog/options', { baseURL: apiBase() })
}

export async function fetchPostList(params) {
  return await $fetch('/api/blog/post/list', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchPostDetail(params) {
  return await $fetch('/api/blog/post/detail', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchPostArchive(params) {
  return await $fetch('/api/blog/post/archive', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchSortList(params) {
  return await $fetch('/api/blog/sort/list', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchSortDetail(params) {
  return await $fetch('/api/blog/sort/detail', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchTagDetail(params) {
  return await $fetch('/api/blog/tag/detail', {
    baseURL: apiBase(),
    params
  })
}

export async function fetchMappointDetail(params) {
  return await $fetch('/api/blog/mappoint/detail', {
    baseURL: apiBase(),
    params
  })
}
