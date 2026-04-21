// Nuxt server route：将 /ads.txt 代理到后端
export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const apiDomain = config.public.apiDomain
  const body = await $fetch('/api/blog/ads.txt', {
    baseURL: apiDomain,
    responseType: 'text'
  })
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return body
})
