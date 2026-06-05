<template>
  <div class="common-right-panel-form multilingual-dashboard-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>面板</el-breadcrumb-item>
        <el-breadcrumb-item>工作台</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-stat-card">
        <el-statistic title="源快照数量" :value="stats.sourceSnapshotTotal" />
      </div>
      <div class="dashboard-stat-card">
        <el-statistic title="源文章组" :value="stats.sourceGroupTotal" />
      </div>
      <div class="dashboard-stat-card">
        <el-statistic title="待复核" :value="stats.pendingReviewTotal" />
      </div>
      <div class="dashboard-stat-card">
        <el-statistic
          title="已发布译文"
          :value="stats.publishedTranslationTotal"
        />
      </div>
      <div class="dashboard-stat-card">
        <el-statistic title="本地化媒体" :value="stats.localMediaTotal" />
      </div>
      <div class="dashboard-stat-card">
        <el-statistic title="支持语言" :value="languageOptions.length" />
      </div>
    </div>

    <div class="dashboard-section mt20">
      <div class="dashboard-section-title">语言版本概览</div>
      <div class="language-stat-grid">
        <div
          v-for="item in languageOptions"
          :key="item.value"
          class="language-stat-item"
        >
          <div class="language-stat-code">{{ item.value }}</div>
          <div class="language-stat-name">{{ item.label }}</div>
          <div class="language-stat-value">
            {{ languageStats[item.value] || 0 }}
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-section mt20">
      <div class="dashboard-section-title">最近导入</div>
      <ResponsiveTable :data="recentImports" row-key="_id" border>
        <ResponsiveTableColumn label="标题" min-width="260">
          <template #default="{ row }">
            <div class="recent-title">
              {{ getPostDisplayTitle(row) }}
            </div>
            <div class="recent-meta">
              {{ getPostTypeText(row.type) }} · 源 ID {{ row.sourceId || '-' }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.sourceLanguageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="版本" width="100">
          <template #default="{ row }">
            v{{ row.snapshotVersion || 1 }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言版本" min-width="260">
          <template #default="{ row }">
            <div class="recent-language-tags">
              <el-tag
                v-for="item in getSummaryLanguageList(row.translationSummary)"
                :key="item.value"
                size="small"
                class="mr5 mt5"
                :type="item.exists ? 'success' : 'info'"
                effect="plain"
              >
                {{ item.value }}
              </el-tag>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="导入时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.sourceSnapshotAt) }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { multilingualApi } from '@/api'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostDisplayTitle,
  getPostTypeText,
  getSummaryLanguageList
} from '@/utils/multilingual'

export default {
  setup() {
    const recentImports = ref([])
    const stats = reactive({
      sourceSnapshotTotal: 0,
      sourceGroupTotal: 0,
      pendingReviewTotal: 0,
      publishedTranslationTotal: 0,
      localMediaTotal: 0
    })
    const languageStats = reactive({})
    SUPPORTED_LANGUAGE_OPTIONS.forEach(item => {
      languageStats[item.value] = 0
    })

    const syncLanguageStats = data => {
      const responseStats = data.languageStats || {}
      SUPPORTED_LANGUAGE_OPTIONS.forEach(item => {
        languageStats[item.value] = responseStats[item.value] || 0
      })
    }

    const loadDashboard = () => {
      multilingualApi
        .getDashboardSummary({}, true)
        .then(response => {
          const responseData = response.data.data || {}
          stats.sourceSnapshotTotal = responseData.sourceSnapshotTotal || 0
          stats.sourceGroupTotal = responseData.sourceGroupTotal || 0
          stats.pendingReviewTotal = responseData.pendingReviewTotal || 0
          stats.publishedTranslationTotal =
            responseData.publishedTranslationTotal || 0
          stats.localMediaTotal = responseData.localMediaTotal || 0
          recentImports.value = responseData.recentImports || []
          syncLanguageStats(responseData)
        })
        .catch(error => {
          console.log(error)
        })
    }

    onMounted(() => {
      loadDashboard()
    })

    return {
      stats,
      languageStats,
      recentImports,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      getLanguageText,
      getPostDisplayTitle,
      getPostTypeText,
      getSummaryLanguageList
    }
  }
}
</script>

<style scoped>
.multilingual-dashboard-page {
  min-width: 0;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.dashboard-stat-card,
.language-stat-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 16px;
  background: var(--el-bg-color);
}

.dashboard-section-title {
  font-weight: 600;
  margin-bottom: 12px;
}

.language-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.language-stat-code {
  font-weight: 700;
}

.language-stat-name {
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.language-stat-value {
  font-size: 22px;
  font-weight: 700;
  margin-top: 12px;
}

.recent-title {
  font-weight: 600;
  word-break: break-word;
}

.recent-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
  word-break: break-all;
}

.recent-language-tags {
  display: flex;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .dashboard-grid,
  .language-stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
