<template>
  <div class="admin-layout">
    <aside class="admin-layout-sidebar">
      <div class="admin-layout-brand">Wikimoe Multilingual</div>
      <el-menu
        :default-active="route.path"
        router
        class="admin-layout-menu"
      >
        <el-menu-item index="/import">导入</el-menu-item>
        <el-menu-item index="/post/group/list">文章分组</el-menu-item>
        <el-menu-item index="/post/list">文章列表</el-menu-item>
        <el-menu-item
          v-for="entityType in entityRouteOrder"
          :key="entityType"
          :index="`/${entityType}/list`"
        >
          {{ entityMeta[entityType].title }}
        </el-menu-item>
        <el-menu-item index="/option/list">站点配置</el-menu-item>
        <el-menu-item index="/aitranslationlog/list">翻译日志</el-menu-item>
      </el-menu>
    </aside>

    <div class="admin-layout-main">
      <header class="admin-layout-header">
        <div>
          <div class="admin-layout-title">{{ currentTitle }}</div>
          <div class="admin-layout-subtitle">多语言站后台</div>
        </div>
        <div class="admin-layout-actions">
          <el-switch
            :model-value="theme === 'dark'"
            inline-prompt
            active-text="暗"
            inactive-text="亮"
            @change="toggleTheme"
          />
          <div class="admin-layout-admin">
            {{ store.state.adminInfo?.nickname || 'Admin' }}
          </div>
          <el-button @click="logout">退出登录</el-button>
        </div>
      </header>

      <main class="admin-layout-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import store from '@/store'
import { ENTITY_META, ENTITY_ROUTE_ORDER } from '@/constants/entities'

const route = useRoute()
const router = useRouter()
const { theme, setTheme } = useTheme()

const entityMeta = ENTITY_META
const entityRouteOrder = ENTITY_ROUTE_ORDER

const currentTitle = computed(() => route.meta.title || '后台')

function toggleTheme(value) {
  setTheme(value ? 'dark' : 'light')
}

function logout() {
  store.commit('clearAuth')
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: linear-gradient(180deg, #f4efe5 0%, #faf8f3 100%);
}

.dark .admin-layout {
  background: linear-gradient(180deg, #16120f 0%, #211913 100%);
}

.admin-layout-sidebar {
  border-right: 1px solid var(--el-border-color);
  padding: 20px 16px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(18px);
}

.dark .admin-layout-sidebar {
  background: rgba(28, 22, 18, 0.82);
}

.admin-layout-brand {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
}

.admin-layout-menu {
  border-right: none;
  background: transparent;
}

.admin-layout-main {
  min-width: 0;
}

.admin-layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px 16px;
}

.admin-layout-title {
  font-size: 26px;
  font-weight: 700;
}

.admin-layout-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 4px;
}

.admin-layout-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-layout-admin {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(184, 105, 45, 0.08);
}

.admin-layout-content {
  padding: 0 28px 28px;
}

@media (max-width: 960px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-layout-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color);
  }
}
</style>