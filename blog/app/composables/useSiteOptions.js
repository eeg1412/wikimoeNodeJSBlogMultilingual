// Site options 全局单例。SSR 初次获取，客户端复用。
import { fetchSiteOptions } from '../utils/api'

export function useSiteOptions() {
  return useState('siteOptions', () => null)
}

export async function ensureSiteOptions() {
  const state = useSiteOptions()
  if (state.value) return state.value
  try {
    const res = await fetchSiteOptions()
    state.value = res?.data || {}
  } catch (err) {
    state.value = {}
  }
  return state.value
}
