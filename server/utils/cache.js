// 多语言站前台读接口缓存。
//
// 设计目标：
// - 减少 MongoDB 读压力，尤其是 sitemap 和列表页。
// - 发布 / 撤回发布 / 实体更新 / options 更新时能即时失效。
//
// 缓存键通常包含 "scope"（lang / options / seo / global）和业务参数 hash，
// 失效时按 scope 清理对应命名空间。

const DEFAULT_TTL_MS = 60 * 1000 // 60 秒
const MAX_ENTRIES = 500

// 每个 scope 一个 Map：scope -> Map<key, { value, expireAt }>
const scopes = new Map()

function getScopeMap(scope) {
  let m = scopes.get(scope)
  if (!m) {
    m = new Map()
    scopes.set(scope, m)
  }
  return m
}

function get(scope, key) {
  const m = getScopeMap(scope)
  const hit = m.get(key)
  if (!hit) return undefined
  if (hit.expireAt <= Date.now()) {
    m.delete(key)
    return undefined
  }
  return hit.value
}

function set(scope, key, value, ttlMs) {
  const m = getScopeMap(scope)
  if (m.size >= MAX_ENTRIES) {
    const firstKey = m.keys().next().value
    if (firstKey !== undefined) m.delete(firstKey)
  }
  const expireAt = Date.now() + (ttlMs || DEFAULT_TTL_MS)
  m.set(key, { value, expireAt })
}

function invalidateScope(scope) {
  scopes.delete(scope)
}

function invalidateAll() {
  scopes.clear()
}

// ===== 语义封装：发布/撤回/实体/选项/SEO 等的失效入口 =====

// 单语言相关的列表、详情、归档、分类、标签、地点缓存
function invalidateLanguage(languageCode) {
  if (!languageCode) return
  invalidateScope(`blog:${languageCode}`)
  invalidateScope(`blog:archive:${languageCode}`)
}

// 所有语言（当 options 里默认语言、siteUrl 等全局字段变更时使用）
function invalidateAllLanguages() {
  for (const key of Array.from(scopes.keys())) {
    if (key.startsWith('blog:')) scopes.delete(key)
  }
}

// sitemap / robots.txt / ads.txt
function invalidateSeo() {
  invalidateScope('seo')
}

// 站点 options（siteInfo、公开 options、谷歌广告等）
function invalidateOptions() {
  invalidateScope('options')
  // options 变更通常影响 SEO/页脚/广告等，直接连带清空
  invalidateSeo()
}

// 带缓存执行器：命中返回缓存，否则调用 loader 并缓存。
async function withCache(scope, key, ttlMs, loader) {
  const hit = get(scope, key)
  if (hit !== undefined) return hit
  const value = await loader()
  if (value !== undefined && value !== null) {
    set(scope, key, value, ttlMs)
  }
  return value
}

module.exports = {
  get,
  set,
  withCache,
  invalidateScope,
  invalidateAll,
  invalidateLanguage,
  invalidateAllLanguages,
  invalidateSeo,
  invalidateOptions,
  DEFAULT_TTL_MS
}
