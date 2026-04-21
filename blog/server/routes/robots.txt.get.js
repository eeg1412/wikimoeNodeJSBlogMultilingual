// Nuxt server route：将 /robots.txt 代理到后端 /api/blog/robots.txt
export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const apiDomain = config.public.apiDomain
  const body = await $fetch('/api/blog/robots.txt', {
    baseURL: apiDomain,
    responseType: 'text'
  })
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return body
})
