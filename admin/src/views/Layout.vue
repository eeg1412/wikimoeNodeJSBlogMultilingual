<template>
  <div class="layout-shell">
    <div
      v-if="mobileMenuOpen"
      class="layout-mobile-mask"
      @click="mobileMenuOpen = false"
    ></div>

    <aside
      class="layout-aside"
      :class="{
        'is-collapsed': collapsed,
        'is-mobile-open': mobileMenuOpen
      }"
    >
      <div class="layout-brand">
        <button
          class="layout-collapse-btn"
          type="button"
          @click="toggleCollapse"
        >
          {{ collapsed ? '展开' : '收起' }}
        </button>
        <div class="layout-brand-main">
          <div class="layout-brand-title">
            {{ site.options?.siteTitle || 'Wikimoe Multilingual' }}
          </div>
          <div class="layout-brand-sub">多语言附属站后台</div>
        </div>
      </div>

      <div class="layout-nav">
        <section
          v-for="section in navSections"
          :key="section.key"
          class="layout-nav-section"
        >
          <div v-if="!collapsed" class="layout-nav-section-title">
            {{ section.title }}
          </div>
          <button
            v-for="item in section.items"
            :key="item.to"
            type="button"
            class="layout-nav-item"
            :class="{ 'is-active': isRouteActive(item) }"
            @click="go(item.to)"
          >
            <span class="layout-nav-item-main">{{ item.title }}</span>
            <span v-if="!collapsed" class="layout-nav-item-sub">{{
              item.description
            }}</span>
          </button>
        </section>
      </div>

      <div v-if="!collapsed" class="layout-brand-footer">
        <div>支持语言：{{ site.supportedLanguageCodes.join(' / ') }}</div>
        <div>默认语言：{{ site.options?.siteDefaultLanguageCode || 'en' }}</div>
      </div>
    </aside>

    <div class="layout-main-shell">
      <header class="layout-header">
        <div class="layout-header-left">
          <button
            class="layout-mobile-menu-btn"
            type="button"
            @click="mobileMenuOpen = true"
          >
            菜单
          </button>
          <div>
            <div class="layout-header-title">{{ currentPage.title }}</div>
            <div class="layout-header-sub">{{ currentPage.description }}</div>
          </div>
        </div>
        <div class="layout-header-actions">
          <button
            type="button"
            class="layout-header-link"
            @click="go('/import')"
          >
            新建导入
          </button>
          <button type="button" class="layout-header-link" @click="openBlog">
            打开博客
          </button>
          <div class="layout-user-chip">
            <div class="layout-user-chip-name">
              {{ auth.admin?.nickname || '管理员' }}
            </div>
            <div class="layout-user-chip-role">{{ roleLabel }}</div>
          </div>
          <el-button size="small" @click="logout">退出</el-button>
        </div>
      </header>

      <main class="layout-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { useSiteStore } from '@/store/site'
import { ENTITY_TYPES } from '@/utils/entityMeta'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const site = useSiteStore()
const collapsed = ref(false)
const mobileMenuOpen = ref(false)

const navSections = computed(() => {
  const entityItems = ENTITY_TYPES.map(item => ({
    to: `/entity/${item.type}/list`,
    title: item.label,
    description: `管理${item.label}的译文与状态`,
    matchPrefix: `/entity/${item.type}`
  }))

  return [
    {
      key: 'overview',
      title: '总览',
      items: [
        {
          to: '/dashboard',
          title: '控制台',
          description: '查看状态、任务和最近更新'
        }
      ]
    },
    {
      key: 'workflow',
      title: '工作流',
      items: [
        {
          to: '/import',
          title: '导入文章',
          description: '从原站拉取单篇文章或推文'
        },
        {
          to: '/post/group/list',
          title: '多语言分组',
          description: '按原文分组查看 en / jp / tw 状态'
        },
        {
          to: '/post/list',
          title: '文章列表',
          description: '逐语种编辑、校验和发布'
        }
      ]
    },
    {
      key: 'entities',
      title: '共享实体',
      items: entityItems
    },
    {
      key: 'system',
      title: '系统',
      items: [
        {
          to: '/translation/memory',
          title: '翻译记忆',
          description: '维护 AI 复用翻译结果'
        },
        {
          to: '/options',
          title: '站点配置',
          description: '管理 SEO、广告和前台站点参数'
        }
      ]
    }
  ]
})

const currentPage = computed(() => {
  const items = navSections.value.flatMap(section => section.items)
  for (const item of items) {
    if (isRouteActive(item)) {
      return {
        title: item.title,
        description: item.description
      }
    }
  }
  return {
    title: '多语言后台',
    description: '围绕导入、翻译、校验和发布构建的内容工作台'
  }
})

const roleLabel = computed(() => {
  if (auth.admin?.role === 999) return '站长'
  return '管理员'
})

function isRouteActive(item) {
  if (route.path === item.to) return true
  if (item.matchPrefix && route.path.indexOf(item.matchPrefix) === 0)
    return true
  if (
    !item.matchPrefix &&
    item.to !== '/dashboard' &&
    route.path.indexOf(item.to + '/') === 0
  ) {
    return true
  }
  return false
}

function go(path) {
  mobileMenuOpen.value = false
  router.push(path)
}

function openBlog() {
  const url = site.options?.siteUrl || '/'
  window.open(url, '_blank')
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

function logout() {
  auth.clear()
  router.replace('/login')
}

onMounted(async () => {
  if (auth.token) {
    await site.load()
  }
})
</script>

<style scoped>
.layout-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  background:
    radial-gradient(
      circle at top left,
      rgba(97, 116, 255, 0.12),
      transparent 22%
    ),
    radial-gradient(
      circle at top right,
      rgba(21, 181, 182, 0.12),
      transparent 28%
    ),
    linear-gradient(180deg, #f6f7fb 0%, #eef1f7 100%);
}

.layout-mobile-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 19;
}

.layout-aside {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 16px;
  background: linear-gradient(180deg, #13233b 0%, #0d1729 100%);
  color: #e5edf8;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  overflow: auto;
  z-index: 20;
}

.layout-aside.is-collapsed {
  padding-left: 10px;
  padding-right: 10px;
}

.layout-brand {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layout-collapse-btn {
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #e5edf8;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}

.layout-brand-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.layout-brand-sub {
  margin-top: 4px;
  color: rgba(229, 237, 248, 0.72);
  font-size: 13px;
}

.layout-nav {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.layout-nav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layout-nav-section-title {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(229, 237, 248, 0.5);
  text-transform: uppercase;
}

.layout-nav-item {
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.layout-nav-item:hover {
  transform: translateX(2px);
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
}

.layout-nav-item.is-active {
  background: linear-gradient(
    135deg,
    rgba(82, 147, 255, 0.26),
    rgba(31, 197, 198, 0.18)
  );
  border-color: rgba(120, 184, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.layout-nav-item-main {
  display: block;
  font-weight: 600;
}

.layout-nav-item-sub {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(229, 237, 248, 0.7);
}

.layout-brand-footer {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 14px;
  color: rgba(229, 237, 248, 0.68);
  font-size: 12px;
  line-height: 1.7;
}

.layout-main-shell {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  background: rgba(246, 247, 251, 0.82);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.layout-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.layout-header-title {
  font-size: 24px;
  font-weight: 700;
  color: #172033;
}

.layout-header-sub {
  color: #60708f;
  font-size: 13px;
  margin-top: 4px;
}

.layout-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.layout-header-link {
  border: none;
  background: rgba(18, 33, 59, 0.06);
  color: #20304f;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}

.layout-user-chip {
  padding: 8px 12px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(18, 33, 59, 0.08);
}

.layout-user-chip-name {
  font-size: 13px;
  font-weight: 600;
  color: #172033;
}

.layout-user-chip-role {
  font-size: 12px;
  color: #6c7a93;
}

.layout-main {
  min-width: 0;
  padding: 24px;
}

.layout-mobile-menu-btn {
  display: none;
  border: 1px solid rgba(18, 33, 59, 0.12);
  background: #fff;
  border-radius: 999px;
  padding: 8px 12px;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .layout-shell {
    grid-template-columns: 1fr;
  }

  .layout-aside {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 86vw);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  .layout-aside.is-mobile-open {
    transform: translateX(0);
  }

  .layout-mobile-menu-btn {
    display: inline-flex;
  }
}

@media (max-width: 768px) {
  .layout-header {
    padding: 16px;
    flex-direction: column;
    align-items: stretch;
  }

  .layout-header-actions {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .layout-main {
    padding: 16px;
  }
}
</style>
