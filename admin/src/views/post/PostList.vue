<template>
  <div class="post-list-page">
    <section class="post-list-hero">
      <div>
        <div class="post-list-eyebrow">Post Workspace</div>
        <h2 class="post-list-title">逐语种文章列表</h2>
        <p class="post-list-subtitle">
          这里按 languageCode
          展示具体文章版本，适合处理正文、共享实体、翻译状态和发布动作。
        </p>
      </div>
      <div class="post-list-hero-stats">
        <div class="post-list-stat">
          <div class="post-list-stat-label">总记录</div>
          <div class="post-list-stat-value">{{ total }}</div>
        </div>
        <div class="post-list-stat">
          <div class="post-list-stat-label">当前页</div>
          <div class="post-list-stat-value">{{ list.length }}</div>
        </div>
      </div>
    </section>

    <el-card shadow="never" class="post-list-card">
      <div class="post-list-filter">
        <el-select
          v-model="query.languageCode"
          placeholder="语言"
          clearable
          style="width: 120px"
          @change="reload"
        >
          <el-option
            v-for="code in site.supportedLanguageCodes"
            :key="code"
            :label="code"
            :value="code"
          />
        </el-select>
        <el-select
          v-model="query.type"
          placeholder="类型"
          clearable
          style="width: 120px"
          @change="reload"
        >
          <el-option label="博文" :value="1" />
          <el-option label="推文" :value="2" />
        </el-select>
        <el-select
          v-model="query.status"
          placeholder="状态"
          clearable
          style="width: 120px"
          @change="reload"
        >
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
          <el-option label="回收站" :value="99" />
        </el-select>
        <el-input
          v-model="query.keyword"
          placeholder="标题 / alias / sourceId"
          clearable
          style="width: 280px"
          @change="reload"
        />
      </div>

      <ResponsiveTable :data="list" row-key="_id" border v-loading="loading">
        <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
        <ResponsiveTableColumn label="类型" width="90">
          <template #default="{ row }">
            {{ postTypeLabel(row.type) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标题 / 别名" min-width="280">
          <template #default="{ row }">
            <div class="post-list-main-cell">
              <button
                class="post-list-title-link"
                type="button"
                @click="goEdit(row)"
              >
                {{ row.title || '(未命名)' }}
              </button>
              <div class="post-list-title-sub">
                <span v-if="row.alias">{{ row.alias }}</span>
                <span v-else>alias 未设置</span>
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="作者 / 分类" min-width="180">
          <template #default="{ row }">
            <div class="post-list-meta-cell">
              <div>作者：{{ row.author?.nickname || '未关联' }}</div>
              <div>分类：{{ row.sort?.sortname || '未关联' }}</div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="postStatusType(row.status)" size="small">
              {{ postStatusLabel(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="翻译" width="130">
          <template #default="{ row }">
            <el-tag
              :type="translationTagType(row.translationStatus)"
              size="small"
            >
              {{ row.translationStatus }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标签 / 地点" min-width="180">
          <template #default="{ row }">
            <div class="post-list-meta-cell">
              <div>标签：{{ row.tags?.length || 0 }}</div>
              <div>地点：{{ row.mappointList?.length || 0 }}</div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="groupSourceId" label="分组" width="180" />
        <ResponsiveTableColumn label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="130" card-action>
          <template #default="{ row }">
            <el-button link type="primary" @click="goEdit(row)">编辑</el-button>
            <el-button link @click="goGroup(row)">查看分组</el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>

      <el-pagination
        background
        layout="prev, pager, next, total"
        :current-page="query.page"
        :page-size="query.limit"
        :total="total"
        @current-change="onPageChange"
        style="margin-top: 16px"
      />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listPostsApi } from '@/api/post'
import { useSiteStore } from '@/store/site'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'

const router = useRouter()
const site = useSiteStore()
const list = ref([])
const total = ref(0)
const loading = ref(false)
const query = reactive({
  page: 1,
  limit: 20,
  languageCode: '',
  type: null,
  status: null,
  keyword: ''
})

function translationTagType(status) {
  if (status === 'approved' || status === 'not_required') return 'success'
  if (status === 'ai_draft' || status === 'manual_draft') return 'warning'
  if (status === 'outdated') return 'danger'
  return 'info'
}

function postStatusType(status) {
  if (status === 1) return 'success'
  if (status === 99) return 'info'
  return 'warning'
}

function postStatusLabel(status) {
  if (status === 1) return '已发布'
  if (status === 99) return '回收站'
  return '草稿'
}

function postTypeLabel(type) {
  if (type === 1) return '博文'
  if (type === 2) return '推文'
  return String(type || '-')
}

async function load() {
  loading.value = true
  try {
    await site.load()
    const params = {}
    Object.keys(query).forEach(key => {
      if (
        query[key] !== '' &&
        query[key] !== null &&
        query[key] !== undefined
      ) {
        params[key] = query[key]
      }
    })
    const resp = await listPostsApi(params)
    list.value = (resp && resp.data && resp.data.list) || []
    total.value = (resp && resp.data && resp.data.total) || 0
  } finally {
    loading.value = false
  }
}

function reload() {
  query.page = 1
  load()
}

function onPageChange(page) {
  query.page = page
  load()
}

function goEdit(row) {
  router.push(`/post/edit/${row._id}`)
}

function goGroup(row) {
  router.push({
    path: '/post/group/list',
    query: { keyword: row.groupSourceId }
  })
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
  }
}

onMounted(load)
</script>

<style scoped>
.post-list-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.post-list-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f5f8fe 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.post-list-eyebrow {
  color: #677791;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.post-list-title {
  margin: 0;
  font-size: 30px;
  color: #172033;
}

.post-list-subtitle {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.8;
  max-width: 780px;
}

.post-list-hero-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.post-list-stat {
  min-width: 110px;
  padding: 14px 16px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.post-list-stat-label {
  color: #6f7f98;
  font-size: 12px;
}

.post-list-stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #172033;
}

.post-list-card {
  border-radius: 24px;
}

.post-list-filter {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.post-list-main-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.post-list-title-link {
  border: none;
  padding: 0;
  background: none;
  color: var(--el-color-primary);
  text-align: left;
  font-weight: 600;
  cursor: pointer;
}

.post-list-title-sub,
.post-list-meta-cell {
  color: #687892;
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 768px) {
  .post-list-hero {
    flex-direction: column;
    padding: 20px;
  }

  .post-list-title {
    font-size: 26px;
  }

  .post-list-hero-stats {
    width: 100%;
  }
}
</style>
