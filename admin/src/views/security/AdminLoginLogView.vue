<template>
  <div class="page-shell">
    <section class="page-header-card">
      <div>
        <p class="page-kicker">Security Console</p>
        <h1 class="page-title">登录日志</h1>
        <p class="page-copy">
          这里展示后台管理员登录记录，可筛选成功和失败请求，帮助排查密码错误、限流命中和异常
          IP 行为。
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push({ name: 'PostList' })" plain
          >文章列表</el-button
        >
        <el-button @click="router.push({ name: 'Settings' })" plain
          >基础配置</el-button
        >
        <el-button @click="loadList" :loading="loading">刷新日志</el-button>
      </div>
    </section>

    <section class="surface-card">
      <div class="filter-grid">
        <el-input v-model="filters.username" placeholder="用户名" />
        <el-select v-model="filters.success" clearable placeholder="结果">
          <el-option label="成功" :value="true" />
          <el-option label="失败" :value="false" />
        </el-select>
        <el-button type="primary" @click="handleSearch">筛选</el-button>
      </div>
    </section>

    <section class="surface-card list-panel" v-loading="loading">
      <div class="list-topline">
        <h2 class="section-title no-margin">共 {{ total }} 条记录</h2>
        <p class="list-meta">第 {{ page }} 页</p>
      </div>

      <div v-if="list.length === 0" class="empty-state">暂无登录日志</div>
      <div v-else class="log-list">
        <article v-for="item in list" :key="item._id" class="log-card">
          <div class="log-card-topline">
            <div>
              <h3 class="log-title">{{ item.username }}</h3>
              <p class="log-subline">{{ item.IP }}</p>
            </div>
            <el-tag :type="item.success ? 'success' : 'danger'">{{
              item.success ? '成功' : '失败'
            }}</el-tag>
          </div>
          <p class="log-meta">时间：{{ formatDate(item.createdAt) }}</p>
          <p class="log-meta">原因：{{ item.reason || '-' }}</p>
          <p class="log-meta">IP 信息：{{ formatJsonInline(item.ipInfo) }}</p>
          <p class="log-meta">
            设备信息：{{ formatJsonInline(item.deviceInfo) }}
          </p>
        </article>
      </div>

      <div class="pagination-row">
        <el-pagination
          layout="prev, pager, next"
          :current-page="page"
          :page-size="size"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  getAdminLoginLogListApi,
  handleAuthFailure,
  showRequestErrors
} from '@/api'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const filters = reactive({
  username: '',
  success: null
})

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('zh-CN')
}

function formatJsonInline(value) {
  if (!value) {
    return '-'
  }

  return JSON.stringify(value)
}

async function loadList() {
  loading.value = true
  try {
    const response = await getAdminLoginLogListApi({
      page: page.value,
      size: size.value,
      username: filters.username,
      success: filters.success
    })
    list.value = Array.isArray(response.list) ? response.list : []
    total.value = response.total || 0
    page.value = response.page || 1
    size.value = response.size || 20
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  page.value = 1
  await loadList()
}

async function handlePageChange(nextPage) {
  page.value = nextPage
  await loadList()
}

onMounted(async function () {
  await loadList()
})
</script>

<style scoped>
.page-shell {
  padding: 24px;
}

.page-header-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.page-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #0f766e;
}

.page-title {
  margin: 14px 0 0;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.02;
  color: #0f172a;
}

.page-copy {
  margin: 16px 0 0;
  max-width: 70ch;
  font-size: 15px;
  line-height: 1.8;
  color: #475569;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.surface-card {
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
}

.filter-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr auto;
  gap: 12px;
}

.list-panel {
  margin-top: 24px;
}

.list-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.no-margin {
  margin: 0;
}

.list-meta {
  margin: 0;
  color: #64748b;
}

.empty-state {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.log-list {
  display: grid;
  gap: 14px;
}

.log-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.log-card-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.log-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.log-subline,
.log-meta {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.7;
  word-break: break-all;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 767px) {
  .page-shell {
    padding: 16px;
  }

  .page-header-card,
  .surface-card {
    padding: 20px;
    border-radius: 22px;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }
}

:global(html.dark) .page-header-card,
:global(html.dark) .surface-card {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 24px 68px rgba(2, 6, 23, 0.42);
}

:global(html.dark) .page-title,
:global(html.dark) .section-title,
:global(html.dark) .log-title {
  color: #f8fafc;
}

:global(html.dark) .page-copy,
:global(html.dark) .list-meta,
:global(html.dark) .empty-state,
:global(html.dark) .log-subline,
:global(html.dark) .log-meta {
  color: #cbd5e1;
}

:global(html.dark) .log-card {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(100, 116, 139, 0.3);
}
</style>
