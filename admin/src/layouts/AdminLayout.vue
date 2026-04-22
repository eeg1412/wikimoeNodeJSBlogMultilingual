<template>
  <el-container class="admin-layout min-h-screen">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="admin-aside">
      <div class="aside-header">
        <span class="text-white font-bold text-base truncate"
          >Multilingual Admin</span
        >
      </div>

      <el-scrollbar>
        <el-menu
          :router="true"
          :default-active="$route.path"
          background-color="#1e293b"
          text-color="#94a3b8"
          active-text-color="#fff"
          class="border-0"
        >
          <el-menu-item index="/multilingual-admin/import">
            <el-icon><Upload /></el-icon>
            <span>导入文章</span>
          </el-menu-item>
          <el-menu-item index="/multilingual-admin/import/jobs">
            <el-icon><List /></el-icon>
            <span>导入记录</span>
          </el-menu-item>
          <el-menu-item index="/multilingual-admin/posts">
            <el-icon><Document /></el-icon>
            <span>文章管理</span>
          </el-menu-item>

          <el-menu-item-group title="数据管理">
            <el-menu-item index="/multilingual-admin/authors">
              <el-icon><User /></el-icon>
              <span>作者</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/sorts">
              <el-icon><Folder /></el-icon>
              <span>分类</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/tags">
              <el-icon><PriceTag /></el-icon>
              <span>标签</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/mappoints">
              <el-icon><Location /></el-icon>
              <span>地点</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/attachments">
              <el-icon><Picture /></el-icon>
              <span>附件</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="实体">
            <el-menu-item index="/multilingual-admin/bangumi">
              <el-icon><VideoPlay /></el-icon>
              <span>Bangumi</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/movies">
              <el-icon><Film /></el-icon>
              <span>电影</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/games">
              <el-icon><Cpu /></el-icon>
              <span>游戏</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/books">
              <el-icon><Reading /></el-icon>
              <span>书籍</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/events">
              <el-icon><Calendar /></el-icon>
              <span>活动</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/votes">
              <el-icon><DataAnalysis /></el-icon>
              <span>投票</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="翻译">
            <el-menu-item index="/multilingual-admin/translation-memory">
              <el-icon><Memo /></el-icon>
              <span>翻译记忆库</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/ai-translation-log">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI 翻译日志</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="系统">
            <el-menu-item index="/multilingual-admin/settings">
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </el-menu-item>
            <el-menu-item index="/multilingual-admin/login-log">
              <el-icon><Key /></el-icon>
              <span>登录日志</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <el-header class="admin-header">
        <div class="flex items-center justify-end h-full gap-3">
          <span class="text-sm text-gray-600">{{
            userInfo?.nickname || ''
          }}</span>
          <el-button type="danger" size="small" link @click="handleLogout"
            >退出</el-button
          >
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.js'

export default {
  name: 'AdminLayout',
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    const userInfo = computed(() => authStore.userInfo)

    onMounted(() => {
      if (!authStore.userInfo) {
        authStore.fetchUserInfo()
      }
    })

    function handleLogout() {
      authStore.logout()
      router.push('/multilingual-admin/login')
    }

    return { userInfo, handleLogout }
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
}

.admin-aside {
  background-color: #1e293b;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.aside-header {
  padding: 16px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
  background-color: #1e293b;
}

.admin-header {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
}

.admin-main {
  background: #f8fafc;
  padding: 20px;
  overflow-y: auto;
}
</style>
