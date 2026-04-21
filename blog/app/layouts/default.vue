<script setup>
import { resolveAssetUrl } from '../utils/asset'

const route = useRoute()
const site = useSiteOptions()
await ensureSiteOptions()

const langs = useSupportedLanguages()
const colorMode = useColorMode()
const searchKeyword = ref('')
const searchType = ref('')

const currentLang = computed(() => {
  const routeLang = route.params?.lang
  if (typeof routeLang === 'string' && isSupportedLang(routeLang)) {
    return routeLang
  }
  return site.value?.siteDefaultLanguageCode || 'en'
})

const { applyAdSenseScript } = useGoogleAds()
applyAdSenseScript()

const { data: shellData } = await useAsyncData(
  'blog-shell-layout',
  async () => {
    const lang = currentLang.value
    const [sortRes, archiveRes] = await Promise.all([
      fetchSortList({ lang }).catch(() => ({ list: [] })),
      fetchPostArchive({ lang }).catch(() => ({ list: [] }))
    ])
    return {
      sortList: sortRes?.list || [],
      archiveList: archiveRes?.list || []
    }
  },
  { watch: [currentLang] }
)

const resolvedFavicon = computed(() =>
  resolveAssetUrl(site.value?.siteFavicon || '')
)
const resolvedLogo = computed(() => resolveAssetUrl(site.value?.siteLogo || ''))
const resolvedDarkLogo = computed(() =>
  resolveAssetUrl(site.value?.siteDarkLogo || '')
)
const navLinks = computed(() => {
  return [
    { to: `/${currentLang.value}`, label: '首页' },
    { to: `/${currentLang.value}/post/list`, label: '全部文章' },
    { to: `/${currentLang.value}/post/list?type=1`, label: '博文' },
    { to: `/${currentLang.value}/post/list?type=2`, label: '推文' }
  ]
})
const sortList = computed(() => shellData.value?.sortList || [])
const archiveList = computed(() => shellData.value?.archiveList || [])
const featuredCounts = computed(() => {
  const sortCount = sortList.value.length
  const archiveCount = archiveList.value.length
  let publishedCount = 0
  sortList.value.forEach(item => {
    publishedCount += item.totalCount || item.postCount || 0
  })
  return {
    sortCount,
    archiveCount,
    publishedCount
  }
})

const extraHeadChildren = computed(() => {
  const items = []
  if (site.value?.siteExtraCss) {
    items.push({ tagName: 'style', innerHTML: site.value.siteExtraCss })
  }
  if (site.value?.siteExtraJs) {
    items.push({ tagName: 'script', innerHTML: site.value.siteExtraJs })
  }
  return items
})

watch(
  () => route.query.keyword,
  value => {
    searchKeyword.value = typeof value === 'string' ? value : ''
  },
  { immediate: true }
)

watch(
  () => route.query.type,
  value => {
    searchType.value = typeof value === 'string' ? value : ''
  },
  { immediate: true }
)

watchEffect(() => {
  const preferred = site.value?.siteThemeMode
  if (!preferred) return
  if (site.value?.siteAllowSwitchTheme) return
  colorMode.preference = preferred
})

useHead(() => {
  const head = {}
  if (resolvedFavicon.value) {
    head.link = [{ rel: 'icon', href: resolvedFavicon.value }]
  }
  if (extraHeadChildren.value.length) {
    head.style = extraHeadChildren.value
      .filter(item => item.tagName === 'style')
      .map(item => ({ innerHTML: item.innerHTML }))
    head.script = (head.script || []).concat(
      extraHeadChildren.value
        .filter(item => item.tagName === 'script')
        .map(item => ({ innerHTML: item.innerHTML }))
    )
  }
  return head
})

function switchLangTarget(code) {
  const currentRoot = `/${currentLang.value}`
  const portablePath =
    route.path === currentRoot || route.path === `${currentRoot}/post/list`
  if (portablePath) {
    const suffix = route.path.slice(currentRoot.length)
    return {
      path: `/${code}${suffix || ''}`,
      query: route.query
    }
  }
  return `/${code}`
}

function isNavActive(link) {
  return route.fullPath === link.to || route.path === link.to
}

function categoryHref(item) {
  return `/${currentLang.value}/post/list/sort/${encodeURIComponent(item.alias || item._id)}`
}

function archiveHref(item) {
  return {
    path: `/${currentLang.value}/post/list`,
    query: {
      year: String(item.year),
      month: String(item.month)
    }
  }
}

async function submitSearch() {
  const query = {}
  const keyword = searchKeyword.value.trim()
  if (keyword) query.keyword = keyword
  if (searchType.value) query.type = searchType.value
  await navigateTo({ path: `/${currentLang.value}/post/list`, query })
}

function setTheme(theme) {
  colorMode.preference = theme
}
</script>

<template>
  <div class="site-shell">
    <div class="site-shell-noise"></div>

    <header class="site-header">
      <div class="site-header-inner">
        <NuxtLink
          :to="currentLang ? `/${currentLang}` : '/'"
          class="site-brand"
        >
          <div
            v-if="resolvedLogo || resolvedDarkLogo"
            class="site-brand-logo-wrap"
          >
            <img
              v-if="resolvedLogo"
              :src="resolvedLogo"
              :alt="site?.siteTitle || 'logo'"
              class="site-brand-logo light"
            />
            <img
              v-if="resolvedDarkLogo"
              :src="resolvedDarkLogo"
              :alt="site?.siteTitle || 'logo'"
              class="site-brand-logo dark"
            />
          </div>
          <div>
            <div class="site-brand-kicker">Localized Edition</div>
            <div class="site-brand-title">
              {{ site?.siteTitle || 'Wikimoe Multilingual' }}
            </div>
          </div>
        </NuxtLink>

        <nav class="site-header-nav">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="site-header-nav-link"
            :class="{ 'is-active': isNavActive(link) }"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="site-header-langs">
          <NuxtLink
            v-for="code in langs"
            :key="code"
            :to="switchLangTarget(code)"
            class="site-lang-pill"
            :class="{ 'is-active': currentLang === code }"
          >
            {{ code.toUpperCase() }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="site-body">
      <aside class="site-rail site-rail--left">
        <section class="site-card site-card--intro">
          <div class="site-card-kicker">About</div>
          <h2 class="site-card-title">
            {{ site?.siteSubTitle || '多语言附属站' }}
          </h2>
          <p class="site-card-copy">
            {{
              site?.siteDescription ||
              '围绕导入、翻译、校验与发布重建的本地化阅读版本。'
            }}
          </p>
          <div class="site-metric-grid">
            <div class="site-metric-item">
              <div class="site-metric-value">
                {{ featuredCounts.publishedCount }}
              </div>
              <div class="site-metric-label">已发布内容</div>
            </div>
            <div class="site-metric-item">
              <div class="site-metric-value">
                {{ featuredCounts.sortCount }}
              </div>
              <div class="site-metric-label">分类层级</div>
            </div>
          </div>
        </section>

        <section class="site-card">
          <div class="site-section-head">
            <span>分类目录</span>
            <span class="site-section-head-sub">含子分类文章总数</span>
          </div>
          <div v-if="sortList.length" class="site-category-list">
            <div
              v-for="item in sortList"
              :key="item._id"
              class="site-category-item"
            >
              <NuxtLink :to="categoryHref(item)" class="site-category-link">
                <span>{{ item.sortname }}</span>
                <span>{{ item.totalCount || item.postCount || 0 }}</span>
              </NuxtLink>
              <div v-if="item.children?.length" class="site-category-children">
                <NuxtLink
                  v-for="child in item.children"
                  :key="child._id"
                  :to="categoryHref(child)"
                  class="site-category-child-link"
                >
                  <span>{{ child.sortname }}</span>
                  <span>{{ child.totalCount || child.postCount || 0 }}</span>
                </NuxtLink>
              </div>
            </div>
          </div>
          <div v-else class="site-empty-note">当前语言尚无分类数据。</div>
        </section>
      </aside>

      <main class="site-main">
        <slot />
      </main>

      <aside class="site-rail site-rail--right">
        <section class="site-card site-card--search">
          <div class="site-section-head">
            <span>检索内容</span>
            <span class="site-section-head-sub">标题、摘要、标签、地点</span>
          </div>
          <div class="site-search-box">
            <input
              v-model="searchKeyword"
              type="text"
              maxlength="40"
              class="site-search-input"
              placeholder="输入关键词"
              @keydown.enter="submitSearch"
            />
            <select v-model="searchType" class="site-search-select">
              <option value="">全部类型</option>
              <option value="1">仅博文</option>
              <option value="2">仅推文</option>
            </select>
            <button type="button" class="site-search-btn" @click="submitSearch">
              搜索
            </button>
          </div>
        </section>

        <section class="site-card">
          <div class="site-section-head">
            <span>归档</span>
            <span class="site-section-head-sub">按月份回看发布节奏</span>
          </div>
          <div v-if="archiveList.length" class="site-archive-list">
            <NuxtLink
              v-for="item in archiveList.slice(0, 10)"
              :key="`${item.year}-${item.month}`"
              :to="archiveHref(item)"
              class="site-archive-link"
            >
              <span
                >{{ item.year }} /
                {{ String(item.month).padStart(2, '0') }}</span
              >
              <span>{{ item.count }}</span>
            </NuxtLink>
          </div>
          <div v-else class="site-empty-note">暂无归档。</div>
        </section>

        <section v-if="site?.siteAllowSwitchTheme" class="site-card">
          <div class="site-section-head">
            <span>主题模式</span>
            <span class="site-section-head-sub">根据阅读环境切换亮暗色</span>
          </div>
          <div class="site-theme-switcher">
            <button
              type="button"
              class="site-theme-btn"
              :class="{ 'is-active': colorMode.preference === 'light' }"
              @click="setTheme('light')"
            >
              亮色
            </button>
            <button
              type="button"
              class="site-theme-btn"
              :class="{ 'is-active': colorMode.preference === 'dark' }"
              @click="setTheme('dark')"
            >
              暗色
            </button>
            <button
              type="button"
              class="site-theme-btn"
              :class="{ 'is-active': colorMode.preference === 'system' }"
              @click="setTheme('system')"
            >
              跟随系统
            </button>
          </div>
        </section>
      </aside>
    </div>

    <footer class="site-footer">
      <div class="site-footer-inner">
        <div>
          © {{ new Date().getFullYear() }}
          {{ site?.siteTitle || 'Wikimoe Multilingual' }}
        </div>
        <div v-if="site?.siteFooterInfo" v-html="site.siteFooterInfo"></div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site-shell {
  position: relative;
  min-height: 100vh;
  background:
    radial-gradient(
      circle at top left,
      rgba(255, 182, 72, 0.14),
      transparent 24%
    ),
    radial-gradient(
      circle at top right,
      rgba(59, 130, 246, 0.12),
      transparent 22%
    ),
    linear-gradient(180deg, #f8f2e9 0%, #f4efe9 30%, #f6f7fb 100%);
  color: #172033;
}

:global(.dark) .site-shell {
  background:
    radial-gradient(
      circle at top left,
      rgba(245, 158, 11, 0.12),
      transparent 24%
    ),
    radial-gradient(
      circle at top right,
      rgba(20, 184, 166, 0.12),
      transparent 24%
    ),
    linear-gradient(180deg, #0f172a 0%, #111827 55%, #0b1220 100%);
  color: #eef2ff;
}

.site-shell-noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.25;
  background-image:
    linear-gradient(rgba(23, 32, 51, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 32, 51, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(circle at center, black, transparent 85%);
}

:global(.dark) .site-shell-noise {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(18px);
  background: rgba(248, 242, 233, 0.74);
  border-bottom: 1px solid rgba(23, 32, 51, 0.08);
}

:global(.dark) .site-header {
  background: rgba(15, 23, 42, 0.78);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.site-header-inner {
  width: min(1480px, calc(100% - 32px));
  margin: 0 auto;
  padding: 18px 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
}

.site-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: inherit;
}

.site-brand-logo-wrap {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(23, 32, 51, 0.08);
}

.site-brand-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.site-brand-logo.dark {
  display: none;
}

:global(.dark) .site-brand-logo.light {
  display: none;
}

:global(.dark) .site-brand-logo.dark {
  display: block;
}

.site-brand-kicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7c6f62;
}

:global(.dark) .site-brand-kicker {
  color: #8ab7ff;
}

.site-brand-title {
  font-size: 24px;
  line-height: 1.1;
  font-weight: 700;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.site-header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.site-header-nav-link,
.site-lang-pill {
  text-decoration: none;
  color: inherit;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.68);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease;
}

.site-header-nav-link:hover,
.site-lang-pill:hover,
.site-header-nav-link.is-active,
.site-lang-pill.is-active {
  transform: translateY(-1px);
  background: #172033;
  color: #ffffff;
  border-color: #172033;
}

:global(.dark) .site-header-nav-link,
:global(.dark) .site-lang-pill {
  background: rgba(17, 24, 39, 0.72);
  border-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .site-header-nav-link:hover,
:global(.dark) .site-lang-pill:hover,
:global(.dark) .site-header-nav-link.is-active,
:global(.dark) .site-lang-pill.is-active {
  background: #f8fafc;
  color: #0f172a;
  border-color: #f8fafc;
}

.site-header-langs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-body {
  width: min(1480px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 36px;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 280px;
  gap: 18px;
}

.site-rail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.site-rail--left,
.site-rail--right {
  position: sticky;
  top: 98px;
  align-self: start;
}

.site-main {
  min-width: 0;
}

.site-card {
  border-radius: 28px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(23, 32, 51, 0.08);
  box-shadow: 0 18px 44px rgba(23, 32, 51, 0.06);
}

:global(.dark) .site-card {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.site-card-kicker,
.site-section-head-sub {
  color: #857667;
  font-size: 12px;
}

:global(.dark) .site-card-kicker,
:global(.dark) .site-section-head-sub {
  color: #8aa4cb;
}

.site-card-title {
  margin: 10px 0 0;
  font-size: 24px;
  line-height: 1.25;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.site-card-copy {
  margin: 12px 0 0;
  color: #5f6f89;
  line-height: 1.8;
}

:global(.dark) .site-card-copy,
:global(.dark) .site-empty-note,
:global(.dark) .site-category-child-link,
:global(.dark) .site-archive-link {
  color: #c1cde3;
}

.site-metric-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.site-metric-item {
  padding: 12px 14px;
  border-radius: 20px;
  background: rgba(23, 32, 51, 0.04);
}

:global(.dark) .site-metric-item {
  background: rgba(255, 255, 255, 0.04);
}

.site-metric-value {
  font-size: 24px;
  font-weight: 700;
}

.site-metric-label {
  margin-top: 4px;
  font-size: 12px;
  color: #6d7b92;
}

.site-section-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
  margin-bottom: 12px;
}

.site-category-list,
.site-archive-list {
  display: grid;
  gap: 10px;
}

.site-category-item {
  display: grid;
  gap: 8px;
}

.site-category-link,
.site-category-child-link,
.site-archive-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  border-radius: 16px;
  padding: 10px 12px;
  background: rgba(23, 32, 51, 0.04);
}

.site-category-link:hover,
.site-category-child-link:hover,
.site-archive-link:hover {
  background: rgba(23, 32, 51, 0.08);
}

:global(.dark) .site-category-link,
:global(.dark) .site-category-child-link,
:global(.dark) .site-archive-link {
  background: rgba(255, 255, 255, 0.04);
}

:global(.dark) .site-category-link:hover,
:global(.dark) .site-category-child-link:hover,
:global(.dark) .site-archive-link:hover {
  background: rgba(255, 255, 255, 0.08);
}

.site-category-children {
  display: grid;
  gap: 8px;
  padding-left: 12px;
}

.site-search-box {
  display: grid;
  gap: 10px;
}

.site-search-input,
.site-search-select,
.site-search-btn,
.site-theme-btn {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(23, 32, 51, 0.12);
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  padding: 12px 14px;
}

:global(.dark) .site-search-input,
:global(.dark) .site-search-select,
:global(.dark) .site-search-btn,
:global(.dark) .site-theme-btn {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(255, 255, 255, 0.1);
}

.site-search-btn,
.site-theme-btn {
  cursor: pointer;
}

.site-search-btn {
  background: #172033;
  color: #ffffff;
}

:global(.dark) .site-search-btn {
  background: #f8fafc;
  color: #0f172a;
}

.site-theme-switcher {
  display: grid;
  gap: 10px;
}

.site-theme-btn.is-active {
  border-color: #172033;
  background: #172033;
  color: #ffffff;
}

:global(.dark) .site-theme-btn.is-active {
  border-color: #f8fafc;
  background: #f8fafc;
  color: #0f172a;
}

.site-empty-note {
  color: #6d7b92;
}

.site-footer {
  width: min(1480px, calc(100% - 32px));
  margin: 0 auto;
  padding-bottom: 24px;
}

.site-footer-inner {
  border-radius: 24px;
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(23, 32, 51, 0.08);
  color: #60708a;
  font-size: 13px;
}

:global(.dark) .site-footer-inner {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
  color: #c7d2e5;
}

@media (max-width: 1280px) {
  .site-body {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .site-rail--right {
    position: static;
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .site-header-inner {
    grid-template-columns: 1fr;
  }

  .site-body {
    grid-template-columns: 1fr;
  }

  .site-rail--left,
  .site-rail--right {
    position: static;
  }

  .site-rail--right {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .site-header-inner,
  .site-body,
  .site-footer {
    width: min(100% - 24px, 1480px);
  }

  .site-card,
  .site-footer-inner {
    border-radius: 22px;
  }

  .site-brand-title {
    font-size: 20px;
  }
}
</style>
