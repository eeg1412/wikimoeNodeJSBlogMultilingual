// 启动即拉站点 options，SSR 阶段一次，客户端复用 useState。
export default defineNuxtPlugin(async () => {
  await ensureSiteOptions()
})
