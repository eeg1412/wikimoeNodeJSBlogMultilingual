<template>
  <div class="admin-layout">
    <aside class="admin-layout__aside">
      <div class="admin-layout__brand">
        <div class="admin-layout__brand-title">Multilingual Admin</div>
        <div class="admin-layout__brand-subtitle">
          响应式、多语言、可维护的内容后台
        </div>
      </div>
      <el-scrollbar>
        <nav class="admin-layout__menu">
          <section
            v-for="group in menuGroups"
            :key="group.label"
            class="admin-layout__menu-group"
          >
            <div class="admin-layout__menu-label">{{ group.label }}</div>
            <router-link
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="admin-layout__menu-item"
              :class="{ 'is-active': isActivePath(item.path) }"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </router-link>
          </section>
        </nav>
      </el-scrollbar>
    </aside>

    <el-drawer
      v-model="mobileMenuVisible"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="admin-layout__drawer"
    >
      <div class="admin-layout__brand">
        <div class="admin-layout__brand-title">Multilingual Admin</div>
        <div class="admin-layout__brand-subtitle">快速导航</div>
      </div>
      <el-scrollbar>
        <nav class="admin-layout__menu">
          <section
            v-for="group in menuGroups"
            :key="group.label"
            class="admin-layout__menu-group"
          >
            <div class="admin-layout__menu-label">{{ group.label }}</div>
            <router-link
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="admin-layout__menu-item"
              :class="{ 'is-active': isActivePath(item.path) }"
              @click="mobileMenuVisible = false"
            >
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </router-link>
          </section>
        </nav>
      </el-scrollbar>
    </el-drawer>

    <div class="admin-layout__main">
      <header class="admin-layout__header">
        <div class="admin-layout__header-main">
          <el-button
            class="admin-layout__mobile-trigger"
            circle
            @click="mobileMenuVisible = true"
          >
            <el-icon><Menu /></el-icon>
          </el-button>
          <div>
            <div class="admin-layout__header-title">{{ currentPageTitle }}</div>
            <div class="admin-layout__header-subtitle">
              {{ currentPageDescription }}
            </div>
          </div>
        </div>
        <div class="admin-layout__header-actions">
          <el-button
            class="admin-layout__theme-button"
            circle
            @click="toggleTheme"
          >
            <el-icon><component :is="isDark ? Sunny : Moon" /></el-icon>
          </el-button>
          <div class="admin-layout__user-chip">
            <el-avatar :size="32">
              {{ userInitial }}
            </el-avatar>
            <div>
              <div class="text-sm font-medium">{{ userInfo?.nickname || '管理员' }}</div>
              <div class="text-xs text-gray-500">已登录</div>
            </div>
            <el-button type="danger" link size="small" @click="handleLogout">
              退出
            </el-button>
          </div>
        </div>
      </header>

      <main class="admin-layout__content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { useAdminTheme } from '../composables/useAdminTheme.js'
import {
  Calendar,
  ChatDotRound,
  Cpu,
  DataAnalysis,
  Document,
  Film,
  Folder,
  Key,
  List,
  Location,
  Memo,
  Menu,
  Moon,
  Picture,
  PriceTag,
  Reading,
  Setting,
  Sunny,
  Upload,
  User,
  VideoPlay
} from '@element-plus/icons-vue'

const MENU_GROUPS = [
  {
    label: '内容',
    items: [
      { path: '/multilingual-admin/import', label: '导入文章', icon: Upload },
      {
        path: '/multilingual-admin/import/jobs',
        label: '导入记录',
        icon: List
      },
      { path: '/multilingual-admin/posts', label: '文章管理', icon: Document }
    ]
  },
  {
    label: '数据管理',
    items: [
      { path: '/multilingual-admin/authors', label: '作者', icon: User },
      { path: '/multilingual-admin/sorts', label: '分类', icon: Folder },
      { path: '/multilingual-admin/tags', label: '标签', icon: PriceTag },
      { path: '/multilingual-admin/mappoints', label: '地点', icon: Location },
      {
        path: '/multilingual-admin/attachments',
        label: '附件',
        icon: Picture
      }
    ]
  },
  {
    label: '关联实体',
    items: [
      { path: '/multilingual-admin/bangumi', label: 'Bangumi', icon: VideoPlay },
      { path: '/multilingual-admin/movies', label: '电影', icon: Film },
      { path: '/multilingual-admin/games', label: '游戏', icon: Cpu },
      { path: '/multilingual-admin/books', label: '书籍', icon: Reading },
      { path: '/multilingual-admin/events', label: '活动', icon: Calendar },
      { path: '/multilingual-admin/votes', label: '投票', icon: DataAnalysis }
    ]
  },
  {
    label: '翻译与系统',
    items: [
      {
        path: '/multilingual-admin/translation-memory',
        label: '翻译记忆库',
        icon: Memo
      },
      {
        path: '/multilingual-admin/ai-translation-log',
        label: 'AI 翻译日志',
        icon: ChatDotRound
      },
      {
        path: '/multilingual-admin/settings',
        label: '系统设置',
        icon: Setting
      },
      { path: '/multilingual-admin/login-log', label: '登录日志', icon: Key }
    ]
  }
]

const PAGE_META = new Map(
  MENU_GROUPS.flatMap(group =>
    group.items.map(item => [
      item.path,
      {
        title: item.label,
        description: `${group.label} · ${item.label}`
      }
    ])
  )
)

export default {
  name: 'AdminLayout',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const authStore = useAuthStore()
    const mobileMenuVisible = ref(false)
    const { isDark, toggleTheme } = useAdminTheme()

    const userInfo = computed(() => authStore.userInfo)
    const userInitial = computed(() => {
      const nickname = authStore.userInfo?.nickname || 'A'
      return nickname.charAt(0).toUpperCase()
    })

    const currentPageMeta = computed(() => {
      if (route.path.startsWith('/multilingual-admin/posts/edit/')) {
        return {
          title: '文章编辑',
          description: '编辑标题、摘要、正文与发布元数据'
        }
      }

      return (
        PAGE_META.get(route.path) || {
          title: '管理后台',
          description: '统一管理多语言内容、导入与配置'
        }
      )
    })

    const currentPageTitle = computed(() => currentPageMeta.value.title)
    const currentPageDescription = computed(
      () => currentPageMeta.value.description
    )

    function isActivePath(path) {
      if (path === '/multilingual-admin/posts') {
        return route.path.startsWith('/multilingual-admin/posts')
      }

      return route.path === path
    }

    onMounted(() => {
      if (!authStore.userInfo) {
        authStore.fetchUserInfo()
      }
    })

    function handleLogout() {
      authStore.logout()
      router.push('/multilingual-admin/login')
    }

    return {
      Menu,
      Moon,
      Sunny,
      menuGroups: MENU_GROUPS,
      mobileMenuVisible,
      userInfo,
      userInitial,
      isDark,
      toggleTheme,
      currentPageTitle,
      currentPageDescription,
      isActivePath,
      handleLogout
    }
  }
}
</script>
