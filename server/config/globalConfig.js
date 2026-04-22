import { getOptionsByNamespace } from './optionsInit.js'

/**
 * 进程内全局配置缓存
 * 通过 initGlobalConfig() 初始化，通过 getGlobalConfig() 读取
 */
let _systemConfig = {}
let _siteConfig = {}

export async function initGlobalConfig() {
  _systemConfig = await getOptionsByNamespace('system')
  _siteConfig = await getOptionsByNamespace('site')
  console.info('[GlobalConfig] 全局配置缓存已刷新')
}

export function getSystemConfig() {
  return _systemConfig
}

export function getSiteConfig() {
  return _siteConfig
}

/**
 * 刷新指定命名空间的缓存（如后台修改配置后调用）
 * @param {'system'|'site'|'all'} namespace
 */
export async function refreshGlobalConfig(namespace = 'all') {
  if (namespace === 'system' || namespace === 'all') {
    _systemConfig = await getOptionsByNamespace('system')
  }
  if (namespace === 'site' || namespace === 'all') {
    _siteConfig = await getOptionsByNamespace('site')
  }
}
