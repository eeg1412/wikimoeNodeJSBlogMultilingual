/**
 * 页面缓存数据管理
 * 存储在进程内存，按语言维度管理缓存键
 */

const _cache = {}

function isExpired(entry) {
  if (!entry) {
    return true
  }
  if (!entry.expiresAt) {
    return false
  }
  return Date.now() > entry.expiresAt
}

export const cacheData = {
  /**
   * 获取缓存
   * @param {string} key
   */
  get(key) {
    const entry = _cache[key]
    if (!entry) {
      return null
    }
    if (isExpired(entry)) {
      delete _cache[key]
      return null
    }
    return entry.value
  },

  /**
   * 设置缓存
   * @param {string} key
   * @param {*} value
   */
  set(key, value, ttlSeconds = 0) {
    const entry = {
      value,
      expiresAt: null
    }
    if (ttlSeconds > 0) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000
    }
    _cache[key] = entry
  },

  /**
   * 删除缓存
   * @param {string} key
   */
  del(key) {
    delete _cache[key]
  },

  /**
   * 按前缀批量删除缓存（用于语言维度刷新）
   * @param {string} prefix
   */
  delByPrefix(prefix) {
    for (const key of Object.keys(_cache)) {
      if (key.startsWith(prefix) || key.includes(`:${prefix}:`)) {
        delete _cache[key]
      }
    }
  },

  /**
   * 清空所有缓存
   */
  clear() {
    for (const key of Object.keys(_cache)) {
      delete _cache[key]
    }
  },

  /**
   * 初始化：启动时刷新基础缓存
   */
  async refresh() {
    // 当前阶段不做预热，按需加载
    console.info('[CacheData] 缓存层已就绪')
  }
}
