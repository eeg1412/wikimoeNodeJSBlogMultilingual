<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout-aside">
      <div class="brand">Multilingual</div>
      <el-menu :default-active="route.path" router class="menu">
        <el-menu-item index="/dashboard">控制台</el-menu-item>
        <el-menu-item index="/import">导入文章</el-menu-item>
        <el-menu-item index="/post/list">文章列表</el-menu-item>
        <el-menu-item index="/post/group/list">多语言分组</el-menu-item>
        <el-sub-menu index="entity">
          <template #title>共享实体</template>
          <el-menu-item
            v-for="t in entityTypes"
            :key="t.type"
            :index="`/entity/${t.type}/list`"
            >{{ t.label }}</el-menu-item
          >
        </el-sub-menu>
        <el-menu-item index="/translation/memory">翻译记忆</el-menu-item>
        <el-menu-item index="/options">站点配置</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <span>{{ auth.admin?.nickname }}</span>
        <el-button size="small" @click="logout">退出</el-button>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { ENTITY_TYPES } from '@/utils/entityMeta'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const entityTypes = ENTITY_TYPES

function logout() {
  auth.clear()
  router.replace('/login')
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
}
.layout-aside {
  background: #001529;
  color: #fff;
}
.brand {
  height: 56px;
  line-height: 56px;
  text-align: center;
  color: #fff;
  font-weight: bold;
  font-size: 18px;
}
.menu {
  border-right: none;
}
.layout-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
</style>
