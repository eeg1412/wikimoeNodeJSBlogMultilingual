/**
 * 页面缓存数据管理
 * 存储在进程内存，按语言维度管理缓存键
 */

const _cache = {}

export const cacheData = {
  /**
   * 获取缓存
   * @param {string} key
   */
  get(key) {
    return _cache[key] ?? null
  },

  /**
   * 设置缓存
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    _cache[key] = value
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
      if (key.startsWith(prefix)) {
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
