<template>
  <div class="page-shell">
    <section class="page-header-card">
      <div>
        <p class="page-kicker">Content Manager</p>
        <h1 class="page-title">文章列表</h1>
        <p class="page-copy">
          这里汇总所有已导入或已编辑的文章，可按语言、状态和关键词筛选，并直接进入编辑页。
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push({ name: 'AdminLoginLog' })" plain
          >登录日志</el-button
        >
        <el-button @click="router.push({ name: 'Import' })" plain
          >导入页</el-button
        >
        <el-button @click="router.push({ name: 'Settings' })" plain
          >基础配置</el-button
        >
        <el-button @click="loadList" :loading="loading">刷新列表</el-button>
      </div>
    </section>

    <section class="surface-card">
      <div class="filter-grid">
        <el-input
          v-model="filters.keyword"
          placeholder="标题 / 别名 / 原站别名"
        />
        <el-select v-model="filters.languageCode" clearable placeholder="语言">
          <el-option label="English" value="en" />
          <el-option label="Japanese" value="jp" />
          <el-option label="Traditional Chinese" value="tw" />
        </el-select>
        <el-select v-model="filters.status" clearable placeholder="状态">
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="已删除" :value="99" />
        </el-select>
        <el-button type="primary" @click="handleSearch">筛选</el-button>
      </div>
    </section>

    <section class="surface-card list-panel" v-loading="loading">
      <div class="list-topline">
        <h2 class="section-title no-margin">共 {{ total }} 篇文章</h2>
        <p class="list-meta">第 {{ page }} 页</p>
      </div>

      <div v-if="list.length === 0" class="empty-state">暂无文章</div>
      <div v-else class="post-list">
        <article v-for="item in list" :key="item._id" class="post-card">
          <div class="post-card-topline">
            <div>
              <h3 class="post-title">{{ item.title || '未命名文章' }}</h3>
              <p class="post-subline">
                {{ item.alias || '-' }} | {{ item.sourceAlias || '-' }}
              </p>
            </div>
            <div class="post-tags">
              <el-tag size="small">{{ item.languageCode }}</el-tag>
              <el-tag :type="statusTagType(item.status)" size="small">{{
                statusText(item.status)
              }}</el-tag>
            </div>
          </div>
          <p class="post-meta">
            类型：{{ item.type === 2 ? 'Tweet' : 'Post' }} | 翻译状态：{{
              item.translationStatus || '-'
            }}
          </p>
          <p class="post-meta">
            分类：{{ item.sort?.sortname || '-' }} | 作者：{{
              item.author?.nickname || '-'
            }}
          </p>
          <p class="post-meta">更新时间：{{ formatDate(item.updatedAt) }}</p>
          <div class="card-actions">
            <el-button
              type="primary"
              @click="
                router.push({ name: 'PostEditor', params: { id: item._id } })
              "
            >
              打开编辑页
            </el-button>
          </div>
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
  getAdminPostListApi,
  handleAuthFailure,
  showRequestErrors
} from '@/api'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const page = ref(1)
const size = ref(20)
const total = ref(0)
const filters = reactive({
  keyword: '',
  languageCode: '',
  status: null
})

function statusText(status) {
  if (status === 1) {
    return '已发布'
  }

  if (status === 99) {
    return '已删除'
  }

  return '草稿'
}

function statusTagType(status) {
  if (status === 1) {
    return 'success'
  }

  if (status === 99) {
    return 'danger'
  }

  return 'info'
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('zh-CN')
}

async function loadList() {
  loading.value = true
  try {
    const response = await getAdminPostListApi({
      page: page.value,
      size: size.value,
      keyword: filters.keyword,
      languageCode: filters.languageCode,
      status: filters.status
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
  grid-template-columns: 1.6fr 1fr 1fr auto;
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

.post-list {
  display: grid;
  gap: 14px;
}

.post-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.post-card-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.post-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.post-subline,
.post-meta {
  margin: 8px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-actions {
  margin-top: 14px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

@media (max-width: 1023px) {
  .filter-grid {
    grid-template-columns: 1fr 1fr;
  }
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
:global(html.dark) .post-title {
  color: #f8fafc;
}

:global(html.dark) .page-copy,
:global(html.dark) .list-meta,
:global(html.dark) .empty-state,
:global(html.dark) .post-subline,
:global(html.dark) .post-meta {
  color: #cbd5e1;
}

:global(html.dark) .post-card {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(100, 116, 139, 0.3);
}
</style>
