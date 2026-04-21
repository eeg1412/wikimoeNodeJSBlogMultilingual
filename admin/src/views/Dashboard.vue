<template>
  <div class="dashboard-page" v-loading="loading">
    <section class="dashboard-hero">
      <div>
        <div class="dashboard-eyebrow">Overview</div>
        <h2 class="dashboard-title">
          {{ dashboard.optionsSnapshot?.siteTitle || 'Wikimoe Multilingual' }}
        </h2>
        <p class="dashboard-subtitle">
          以多语言发布工作流为中心，汇总文章、分组、翻译状态与最近导入任务。
        </p>
      </div>
      <div class="dashboard-hero-actions">
        <el-button type="primary" @click="router.push('/import')"
          >开始导入</el-button
        >
        <el-button @click="router.push('/post/group/list')"
          >查看语言矩阵</el-button
        >
      </div>
    </section>

    <section class="dashboard-metrics">
      <article
        v-for="item in metricCards"
        :key="item.key"
        class="dashboard-metric-card"
      >
        <div class="dashboard-metric-label">{{ item.label }}</div>
        <div class="dashboard-metric-value">{{ item.value }}</div>
        <div class="dashboard-metric-hint">{{ item.hint }}</div>
      </article>
    </section>

    <section class="dashboard-grid">
      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card-header">
            <span>语言状态矩阵</span>
            <span class="dashboard-card-header-sub"
              >逐语种观察发布、草稿与待处理量</span
            >
          </div>
        </template>
        <ResponsiveTable :data="languageRows" row-key="languageCode" border>
          <ResponsiveTableColumn prop="languageCode" label="语言" width="90" />
          <ResponsiveTableColumn prop="total" label="总数" width="90" />
          <ResponsiveTableColumn prop="published" label="已发布" width="100" />
          <ResponsiveTableColumn prop="draft" label="草稿" width="90" />
          <ResponsiveTableColumn prop="approved" label="已批准" width="100" />
          <ResponsiveTableColumn prop="attention" label="需处理" width="120">
            <template #default="{ row }">
              <el-tag
                :type="row.attention > 0 ? 'danger' : 'success'"
                size="small"
              >
                {{ row.attention }}
              </el-tag>
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card-header">
            <span>翻译状态分布</span>
            <span class="dashboard-card-header-sub"
              >直观看出当前卡点集中在哪类状态</span
            >
          </div>
        </template>
        <div class="dashboard-status-grid">
          <div
            v-for="item in translationRows"
            :key="item.key"
            class="dashboard-status-item"
          >
            <div class="dashboard-status-key">{{ item.key }}</div>
            <div class="dashboard-status-value">{{ item.count }}</div>
          </div>
        </div>
        <div class="dashboard-site-meta">
          <div>
            默认语言：{{
              dashboard.optionsSnapshot?.siteDefaultLanguageCode || 'en'
            }}
          </div>
          <div>
            站点地址：{{ dashboard.optionsSnapshot?.siteUrl || '未设置' }}
          </div>
          <div>
            广告状态：{{
              dashboard.optionsSnapshot?.googleAdEnabled ? '已启用' : '未启用'
            }}
          </div>
        </div>
      </el-card>
    </section>

    <section class="dashboard-grid dashboard-grid--secondary">
      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card-header">
            <span>最近导入任务</span>
            <span class="dashboard-card-header-sub"
              >观察导入成功率、警告和失败位置</span
            >
          </div>
        </template>
        <ResponsiveTable
          :data="dashboard.recentImports || []"
          row-key="_id"
          border
        >
          <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
          <ResponsiveTableColumn
            prop="sourceIdentifier"
            label="原文"
            min-width="180"
          />
          <ResponsiveTableColumn prop="status" label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="importStatusType(row.status)" size="small">
                {{ row.status }}
              </el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn prop="stage" label="阶段" width="120" />
          <ResponsiveTableColumn label="警告/错误" width="120">
            <template #default="{ row }">
              {{ row.warningCount }} / {{ row.errorCount }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="更新时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt || row.createdAt) }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="操作" width="100" card-action>
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                :disabled="!row.resultPostId"
                @click="openPost(row.resultPostId)"
              >
                打开文章
              </el-button>
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </el-card>

      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card-header">
            <span>最近更新文章</span>
            <span class="dashboard-card-header-sub"
              >快速回到最近编辑的语种文章继续处理</span
            >
          </div>
        </template>
        <ResponsiveTable
          :data="dashboard.recentPosts || []"
          row-key="_id"
          border
        >
          <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
          <ResponsiveTableColumn label="标题" min-width="220">
            <template #default="{ row }">
              <button
                class="dashboard-post-link"
                type="button"
                @click="openPost(row._id)"
              >
                {{ row.title || row.alias || row.sourceId || '(未命名)' }}
              </button>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn
            prop="groupSourceId"
            label="分组"
            width="180"
          />
          <ResponsiveTableColumn label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="postStatusType(row.status)" size="small">
                {{ postStatusLabel(row.status) }}
              </el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="翻译" width="120">
            <template #default="{ row }">
              <el-tag
                :type="translationTagType(row.translationStatus)"
                size="small"
              >
                {{ row.translationStatus }}
              </el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="更新时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.updatedAt) }}
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </el-card>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardSummaryApi } from '@/api/dashboard'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'

const router = useRouter()
const loading = ref(false)
const dashboard = ref({
  summary: {
    totals: {},
    byLanguage: [],
    translationStatus: []
  },
  recentImports: [],
  recentPosts: [],
  optionsSnapshot: {}
})

const metricCards = computed(() => {
  const totals = dashboard.value.summary?.totals || {}
  return [
    {
      key: 'posts',
      label: '总文章数',
      value: totals.posts || 0,
      hint: `博文 ${totals.blog || 0} / 推文 ${totals.tweet || 0}`
    },
    {
      key: 'groups',
      label: '原文分组',
      value: totals.groups || 0,
      hint: '按 sourceId 聚合后的语言矩阵'
    },
    {
      key: 'published',
      label: '已发布',
      value: totals.published || 0,
      hint: `草稿 ${totals.draft || 0} / 回收站 ${totals.trash || 0}`
    },
    {
      key: 'attention',
      label: '待处理',
      value: totals.needsAttention || 0,
      hint: '包含 pending、outdated 与 stub'
    }
  ]
})

const languageRows = computed(() => {
  const rows = dashboard.value.summary?.byLanguage || []
  return rows.map(item => ({
    ...item,
    attention: (item.pending || 0) + (item.outdated || 0) + (item.stub || 0)
  }))
})

const translationRows = computed(
  () => dashboard.value.summary?.translationStatus || []
)

function translationTagType(status) {
  if (status === 'approved' || status === 'not_required') return 'success'
  if (status === 'ai_draft' || status === 'manual_draft') return 'warning'
  if (status === 'outdated') return 'danger'
  return 'info'
}

function importStatusType(status) {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
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

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
  }
}

function openPost(id) {
  if (!id) return
  router.push(`/post/edit/${id}`)
}

async function load() {
  loading.value = true
  try {
    const resp = await getDashboardSummaryApi()
    dashboard.value = resp.data || dashboard.value
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background:
    radial-gradient(
      circle at top left,
      rgba(73, 125, 255, 0.2),
      transparent 28%
    ),
    linear-gradient(135deg, #ffffff 0%, #f3f7fd 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.dashboard-eyebrow {
  color: #5f6f89;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.dashboard-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.1;
  color: #162033;
}

.dashboard-subtitle {
  margin: 12px 0 0;
  max-width: 760px;
  color: #657590;
  line-height: 1.8;
}

.dashboard-hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-metric-card {
  padding: 20px 22px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.dashboard-metric-label {
  color: #66758d;
  font-size: 13px;
}

.dashboard-metric-value {
  margin-top: 10px;
  font-size: 34px;
  font-weight: 700;
  color: #192438;
}

.dashboard-metric-hint {
  margin-top: 8px;
  color: #7a879a;
  font-size: 13px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
  gap: 16px;
}

.dashboard-grid--secondary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-card {
  border-radius: 24px;
}

.dashboard-card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
}

.dashboard-card-header-sub {
  font-size: 12px;
  color: #70809a;
  font-weight: 400;
}

.dashboard-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dashboard-status-item {
  padding: 14px 16px;
  border-radius: 18px;
  background: #f7f9fc;
}

.dashboard-status-key {
  color: #69788e;
  font-size: 13px;
}

.dashboard-status-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  color: #172033;
}

.dashboard-site-meta {
  margin-top: 16px;
  display: grid;
  gap: 8px;
  color: #5d6d86;
  font-size: 13px;
}

.dashboard-post-link {
  border: none;
  padding: 0;
  background: none;
  color: var(--el-color-primary);
  cursor: pointer;
  text-align: left;
}

@media (max-width: 1200px) {
  .dashboard-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid,
  .dashboard-grid--secondary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-hero {
    padding: 20px;
    flex-direction: column;
  }

  .dashboard-title {
    font-size: 28px;
  }

  .dashboard-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
