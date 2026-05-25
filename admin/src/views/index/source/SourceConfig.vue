<template>
  <div class="common-right-panel-form source-config-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源站配置管理</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="source-config-toolbar clearfix pb20">
      <div class="fl source-config-summary">
        <span>缓存刷新时间：</span>
        <span>{{ updatedAtText }}</span>
      </div>
      <div class="fr">
        <el-button
          type="primary"
          :loading="refreshing"
          @click="refreshSourceConfig"
        >
          <el-icon><RefreshRight /></el-icon>
          <span>刷新源站配置</span>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body source-config-table-body">
      <ResponsiveTable :data="configList" row-key="name" height="100%" border>
        <ResponsiveTableColumn label="配置项" min-width="180">
          <template #default="{ row }">
            <div class="source-config-name">{{ getFieldLabel(row.name) }}</div>
            <div class="source-config-key">{{ row.name }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="当前缓存值" min-width="280">
          <template #default="{ row }">
            <div class="source-config-value">
              {{ formatValue(row.name, row.value) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="用途" min-width="320">
          <template #default="{ row }">
            {{ getFieldUsage(row.name) }}
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'

const SOURCE_CONFIG_FIELD_MAP = {
  siteUrl: {
    label: '站点地址',
    usage: 'RSS/Sitemap URL、远程媒体源站地址、源站链接替换判断'
  },
  siteTimeZone: {
    label: '站点时区',
    usage: '归档月份、列表年月筛选、RSS 推文日期格式'
  },
  sitePageSize: {
    label: '博客列表分页大小',
    usage: '博客列表分页查询'
  },
  sitePostRandomSimilarCount: {
    label: '相似内容数量',
    usage: '文章详情相似内容查询数量'
  },
  sitePostRandomSimilarRange: {
    label: '相似内容查询范围',
    usage: '文章详情相似内容的候选类型'
  },
  sitePostRandomSimilarShowRange: {
    label: '相似内容显示范围',
    usage: '文章详情在哪些文章类型展示相似内容'
  }
}

const SOURCE_CONFIG_VALUE_LABEL_MAP = {
  sitePostRandomSimilarRange: {
    1: '博文',
    2: '推文'
  },
  sitePostRandomSimilarShowRange: {
    1: '博文',
    2: '推文'
  }
}

export default {
  name: 'SourceConfig',
  components: {
    Refresh,
    RefreshRight
  },
  setup() {
    const loading = ref(false)
    const refreshing = ref(false)
    const configNames = ref([])
    const configValues = ref({})
    const updatedAt = ref('')

    const configList = computed(() => {
      return configNames.value.map(name => {
        return {
          name,
          value: configValues.value[name]
        }
      })
    })

    const updatedAtText = computed(() => {
      if (!updatedAt.value) {
        return '-'
      }
      return new Date(updatedAt.value).toLocaleString()
    })

    function applySourceConfigData(data = {}) {
      configNames.value = data.names || []
      configValues.value = data.values || {}
      updatedAt.value = data.updatedAt || ''
    }

    function getSourceConfig(noLoading = true) {
      loading.value = true
      return multilingualApi
        .getSourceConfig({}, noLoading)
        .then(response => {
          applySourceConfigData(response.data.data || {})
        })
        .finally(() => {
          loading.value = false
        })
    }

    function refreshSourceConfig() {
      refreshing.value = true
      return multilingualApi
        .refreshSourceConfig({})
        .then(response => {
          applySourceConfigData(response.data.data || {})
          ElMessage.success('源站配置已刷新')
        })
        .finally(() => {
          refreshing.value = false
        })
    }

    function getFieldLabel(name) {
      return SOURCE_CONFIG_FIELD_MAP[name]?.label || name
    }

    function getFieldUsage(name) {
      return SOURCE_CONFIG_FIELD_MAP[name]?.usage || '-'
    }

    function formatArrayValue(name, value) {
      const labelMap = SOURCE_CONFIG_VALUE_LABEL_MAP[name]

      if (!Array.isArray(value) || value.length === 0) {
        return '-'
      }

      if (!labelMap) {
        return value.join(', ')
      }

      return value
        .map(item => {
          const itemText = String(item)
          return labelMap[itemText] || itemText
        })
        .join(', ')
    }

    function formatValue(name, value) {
      if (Array.isArray(value)) {
        return formatArrayValue(name, value)
      }

      if (value === null || typeof value === 'undefined' || value === '') {
        return '-'
      }

      return String(value)
    }

    onMounted(() => {
      getSourceConfig(true)
    })

    return {
      loading,
      refreshing,
      configList,
      updatedAtText,
      getSourceConfig,
      refreshSourceConfig,
      getFieldLabel,
      getFieldUsage,
      formatValue
    }
  }
}
</script>

<style scoped>
.source-config-toolbar {
  min-height: 32px;
}
.source-config-summary {
  line-height: 32px;
  color: var(--el-text-color-secondary);
}
.source-config-table-body {
  min-height: 420px;
}
.source-config-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.source-config-key {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.source-config-value {
  word-break: break-word;
  white-space: pre-wrap;
}
@media (max-width: 767px) {
  .source-config-summary {
    float: none;
    margin-bottom: 10px;
  }
  .source-config-toolbar .fr {
    float: none;
  }
}
</style>
