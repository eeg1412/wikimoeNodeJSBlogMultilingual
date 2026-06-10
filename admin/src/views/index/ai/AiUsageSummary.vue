<template>
  <div class="common-right-panel-form ai-usage-summary-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>AI</el-breadcrumb-item>
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
              <el-option
                v-for="item in providerOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
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
              style="width: 180px"
            >
              <el-option
                v-for="item in operationOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
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
            {{ getProviderText(row.provider) }}
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
            {{ getProviderText(row.provider) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="模型" min-width="190">
          <template #default="{ row }">
            {{ row.model || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="字段" min-width="260">
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
      <div class="ai-usage-section-title">调用次数</div>
      <ResponsiveTable :data="callRows" row-key="rowKey" border>
        <ResponsiveTableColumn label="AI 服务商" width="140">
          <template #default="{ row }">
            {{ getProviderText(row.provider) }}
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
  cachedContentTokenCount: '缓存命中输入 token',
  candidatesTokenCount: '候选输出 token',
  completion_tokens: '输出 token',
  'completion_tokens_details.accepted_prediction_tokens':
    '输出明细：接受预测 token',
  'completion_tokens_details.audio_tokens': '输出明细：音频 token',
  'completion_tokens_details.reasoning_tokens': '输出明细：推理 token',
  'completion_tokens_details.rejected_prediction_tokens':
    '输出明细：拒绝预测 token',
  input_cache_hit_tokens: '输入缓存命中 token',
  input_cache_miss_tokens: '输入缓存未命中 token',
  input_tokens: '输入 token',
  output_tokens: '输出 token',
  prompt_cache_hit_tokens: '提示词缓存命中 token',
  prompt_cache_miss_tokens: '提示词缓存未命中 token',
  prompt_tokens: '提示词输入 token',
  'prompt_tokens_details.audio_tokens': '提示词明细：音频 token',
  'prompt_tokens_details.cached_tokens': '提示词明细：缓存 token',
  promptTokenCount: '提示词输入 token',
  thought_tokens: '思考 token',
  thoughtsTokenCount: '思考 token',
  tool_use_prompt_tokens: '工具调用输入 token',
  toolUsePromptTokenCount: '工具调用输入 token',
  total_tokens: '总 token',
  totalTokenCount: '总 token'
}

const TOKEN_TYPE_SEGMENT_TEXT_MAP = {
  cacheTokensDetails: '缓存明细',
  cachedContentTokenCount: '缓存命中输入 token',
  candidatesTokenCount: '候选输出 token',
  candidatesTokensDetails: '候选输出明细',
  completion_tokens: '输出 token',
  completion_tokens_details: '输出明细',
  promptTokenCount: '提示词输入 token',
  promptTokensDetails: '提示词明细',
  prompt_tokens: '提示词输入 token',
  prompt_tokens_details: '提示词明细',
  tokenCount: 'token 数',
  totalTokenCount: '总 token',
  total_tokens: '总 token'
}

const PROVIDER_TEXT_MAP = {
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  unknown: '未知服务商'
}

const PROVIDER_OPTIONS = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Gemini', value: 'gemini' }
]

const OPERATION_TEXT_MAP = {
  'translation.content': '内容 AI 翻译',
  'translation.post': '文章 AI 翻译',
  'translation.verification': '校验 AI',
  'cover.image.recognition': '封面图识别',
  'cover.image.generation': '封面图生成',
  'proper-noun.keyword.extract': '专有名词抽取',
  'proper-noun.existing-term.filter': '专有名词库候选消歧',
  'proper-noun.official-translation.knowledge': '专有名词官方译名知识确认',
  'proper-noun.official-translation.search': '专有名词官方译名联网翻译'
}

const STATUS_TEXT_MAP = {
  success: '成功',
  error: '失败',
  cancelled: '已取消'
}

const STATUS_TAG_TYPE_MAP = {
  success: 'success',
  error: 'danger',
  cancelled: 'warning'
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

function getTokenTypeSegmentText(segment) {
  if (/^\d+$/.test(segment)) {
    return `第 ${Number(segment) + 1} 项`
  }
  return TOKEN_TYPE_SEGMENT_TEXT_MAP[segment] || segment
}

function formatFallbackTokenType(value) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }
  return text
    .split('.')
    .map(segment => getTokenTypeSegmentText(segment))
    .join(' / ')
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
      return OPERATION_TEXT_MAP[value] || value || '-'
    }

    function getProviderText(value) {
      return PROVIDER_TEXT_MAP[value] || value || '-'
    }

    function getStatusText(value) {
      return STATUS_TEXT_MAP[value] || value || '-'
    }

    function getStatusTagType(value) {
      return STATUS_TAG_TYPE_MAP[value] || 'info'
    }

    function getTokenTypeText(value) {
      if (!value) {
        return '-'
      }
      if (TOKEN_TYPE_TEXT_MAP[value]) {
        return TOKEN_TYPE_TEXT_MAP[value]
      }
      return formatFallbackTokenType(value)
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
      getProviderText,
      getStatusTagType,
      getStatusText,
      getTokenTypeText,
      operationOptions: Object.entries(OPERATION_TEXT_MAP).map(
        ([value, label]) => {
          return { label, value }
        }
      ),
      params,
      providerOptions: PROVIDER_OPTIONS,
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
