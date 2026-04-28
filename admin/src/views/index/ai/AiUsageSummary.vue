<template>
  <div class="common-right-panel-form ai-usage-summary-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>统计</el-breadcrumb-item>
        <el-breadcrumb-item>AI 用量统计</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="ai-usage-search-form"
          @submit.prevent
          @keypress.enter="getAiUsageSummary"
        >
          <el-form-item>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.provider"
              placeholder="AI 服务商"
              clearable
              style="width: 150px"
            >
              <el-option label="DeepSeek" value="deepseek" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="params.model"
              placeholder="模型"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.operation"
              placeholder="调用场景"
              clearable
              style="width: 170px"
            >
              <el-option label="文章翻译" value="translation.post" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getAiUsageSummary">
              统计
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <div class="ai-usage-period mb20">
      统计周期：{{ displayStartAt }} 至 {{ displayEndAt }}
    </div>

    <div class="ai-usage-section">
      <div class="ai-usage-section-title">Token 用量</div>
      <ResponsiveTable :data="tokenRows" row-key="rowKey" border>
        <ResponsiveTableColumn label="AI 服务商" width="140">
          <template #default="{ row }">
            {{ row.provider || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="模型" min-width="190">
          <template #default="{ row }">
            {{ row.model || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="Token 类型" min-width="220">
          <template #default="{ row }">
            {{ getTokenTypeText(row.tokenType) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="总数" width="160">
          <template #default="{ row }">
            {{ formatNumber(row.total) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="请求数" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.requestCount) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="最近记录" width="180">
          <template #default="{ row }">
            {{ row.latestAt ? $formatDate(row.latestAt) : '-' }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="ai-usage-section mt20">
      <div class="ai-usage-section-title">原始 usage 字段</div>
      <ResponsiveTable :data="rawTokenRows" row-key="rowKey" border>
        <ResponsiveTableColumn label="AI 服务商" width="140">
          <template #default="{ row }">
            {{ row.provider || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="模型" min-width="190">
          <template #default="{ row }">
            {{ row.model || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="字段" min-width="260">
          <template #default="{ row }">
            {{ row.tokenType }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="总数" width="160">
          <template #default="{ row }">
            {{ formatNumber(row.total) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="请求数" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.requestCount) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="最近记录" width="180">
          <template #default="{ row }">
            {{ row.latestAt ? $formatDate(row.latestAt) : '-' }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="ai-usage-section mt20">
      <div class="ai-usage-section-title">调用次数</div>
      <ResponsiveTable :data="callRows" row-key="rowKey" border>
        <ResponsiveTableColumn label="AI 服务商" width="140">
          <template #default="{ row }">
            {{ row.provider || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="模型" min-width="190">
          <template #default="{ row }">
            {{ row.model || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="调用场景" min-width="170">
          <template #default="{ row }">
            {{ getOperationText(row.operation) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" effect="plain">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="次数" width="120">
          <template #default="{ row }">
            {{ formatNumber(row.total) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="最近记录" width="180">
          <template #default="{ row }">
            {{ row.latestAt ? $formatDate(row.latestAt) : '-' }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { multilingualApi } from '@/api'

const TOKEN_TYPE_TEXT_MAP = {
  input_cache_hit_tokens: '输入缓存命中 token',
  input_cache_miss_tokens: '输入缓存未命中 token',
  input_tokens: '输入 token',
  output_tokens: '输出 token'
}

function padDateNumber(value) {
  if (value < 10) {
    return `0${value}`
  }
  return String(value)
}

function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '-'
  }

  return [
    date.getFullYear(),
    padDateNumber(date.getMonth() + 1),
    padDateNumber(date.getDate())
  ].join('-')
}

function formatDateText(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }

  return formatLocalDate(date)
}

function getDefaultDateRange() {
  const endAt = new Date()
  const startAt = new Date()
  startAt.setDate(startAt.getDate() - 29)
  return [formatLocalDate(startAt), formatLocalDate(endAt)]
}

export default {
  name: 'AiUsageSummary',
  setup() {
    const dateRange = ref(getDefaultDateRange())
    const params = reactive({
      provider: '',
      model: '',
      operation: ''
    })
    const tokenRows = ref([])
    const rawTokenRows = ref([])
    const callRows = ref([])
    const startAt = ref('')
    const endAt = ref('')

    const displayStartAt = computed(() => formatDateText(startAt.value))
    const displayEndAt = computed(() => formatDateText(endAt.value))

    function buildQueryParams() {
      const query = {
        provider: params.provider,
        model: params.model,
        operation: params.operation
      }
      if (Array.isArray(dateRange.value) && dateRange.value.length === 2) {
        query.startAt = dateRange.value[0]
        query.endAt = dateRange.value[1]
      }
      return query
    }

    function attachRowKey(row, index, prefix) {
      return {
        ...row,
        rowKey: [
          prefix,
          row.provider || '',
          row.model || '',
          row.tokenType || row.operation || '',
          row.status || '',
          index
        ].join(':')
      }
    }

    function getAiUsageSummary() {
      multilingualApi
        .getAiUsageSummary(buildQueryParams(), true)
        .then(response => {
          const data = response.data.data || {}
          startAt.value = data.startAt || ''
          endAt.value = data.endAt || ''
          tokenRows.value = (data.billingTokenRows || data.tokenRows || []).map(
            (row, index) => {
              return attachRowKey(row, index, 'token')
            }
          )
          rawTokenRows.value = (data.rawTokenRows || []).map((row, index) => {
            return attachRowKey(row, index, 'rawToken')
          })
          callRows.value = (data.callRows || []).map((row, index) => {
            return attachRowKey(row, index, 'call')
          })
        })
    }

    function formatNumber(value) {
      const numberValue = Number(value || 0)
      return numberValue.toLocaleString()
    }

    function getOperationText(value) {
      if (value === 'translation.post') {
        return '文章翻译'
      }
      return value || '-'
    }

    function getStatusText(value) {
      if (value === 'success') {
        return '成功'
      }
      if (value === 'error') {
        return '失败'
      }
      return value || '-'
    }

    function getStatusTagType(value) {
      if (value === 'success') {
        return 'success'
      }
      if (value === 'error') {
        return 'danger'
      }
      return 'info'
    }

    function getTokenTypeText(value) {
      return TOKEN_TYPE_TEXT_MAP[value] || value || '-'
    }

    onMounted(() => {
      getAiUsageSummary()
    })

    return {
      callRows,
      dateRange,
      displayEndAt,
      displayStartAt,
      formatNumber,
      getAiUsageSummary,
      getOperationText,
      getStatusTagType,
      getStatusText,
      getTokenTypeText,
      params,
      rawTokenRows,
      tokenRows
    }
  }
}
</script>

<style scoped>
.ai-usage-summary-page {
  min-width: 0;
}

.ai-usage-period {
  color: var(--el-text-color-secondary);
}

.ai-usage-section-title {
  margin-bottom: 12px;
  font-weight: 600;
}

@media (max-width: 767px) {
  .ai-usage-search-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
  }

  .ai-usage-search-form :deep(.el-date-editor),
  .ai-usage-search-form :deep(.el-select),
  .ai-usage-search-form :deep(.el-input) {
    width: 100% !important;
  }
}
</style>
