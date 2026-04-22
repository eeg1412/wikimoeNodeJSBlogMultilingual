<template>
  <AdminPage :title="title" :description="description">
    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">当前语言</div>
          <div class="admin-stat-card__value">
            {{ query.languageCode || '全部' }}
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">结果数量</div>
          <div class="admin-stat-card__value">{{ total }}</div>
        </div>
      </div>
    </template>

    <el-card shadow="never">
      <div class="admin-filter-row">
        <div class="admin-filter-row__main">
          <el-select
            v-model="query.languageCode"
            placeholder="语言"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="languageCode in languageCodes"
              :key="languageCode"
              :label="languageCode"
              :value="languageCode"
            />
          </el-select>
          <el-input
            v-if="keywordPlaceholder"
            v-model="query.keyword"
            :placeholder="keywordPlaceholder"
            clearable
            style="min-width: 220px; max-width: 320px"
            @keyup.enter="fetchList"
          />
          <slot name="filters" :query="query" :fetch-list="fetchList" />
          <el-button type="primary" @click="fetchList">查询</el-button>
        </div>
        <div class="admin-filter-row__hint">
          按源数据聚合展示每个语言版本，适合在移动端快速对比。
        </div>
      </div>

      <ResponsiveTable :data="list" :loading="loading" row-key="groupKey">
        <ResponsiveTableColumn :label="sourceIdLabel" width="160">
          <template #default="{ row }">
            <div class="text-sm break-all">
              {{ getDisplaySourceId(row) }}
            </div>
          </template>
        </ResponsiveTableColumn>

        <ResponsiveTableColumn label="源数据" min-width="260">
          <template #default="{ row }">
            <slot
              name="source"
              :row="row"
              :primary-entry="getPrimaryEntry(row)"
              :source-snapshot="getSourceSnapshot(row)"
            >
              <div class="space-y-1">
                <div class="font-medium">{{ getDisplaySourceId(row) }}</div>
                <div class="text-xs text-gray-500">未提供源数据摘要</div>
              </div>
            </slot>
          </template>
        </ResponsiveTableColumn>

        <ResponsiveTableColumn
          v-for="languageCode in languageCodes"
          :key="languageCode"
          :label="languageCode"
          min-width="220"
        >
          <template #default="{ row }">
            <slot
              name="language"
              :row="row"
              :entry="getLangEntry(row, languageCode)"
              :language-code="languageCode"
            >
              <el-tag size="small" type="info">未实现语言列</el-tag>
            </slot>
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <slot
            name="mobile-card"
            :row="row"
            :primary-entry="getPrimaryEntry(row)"
            :source-snapshot="getSourceSnapshot(row)"
            :get-lang-entry="getLangEntry"
          >
            <div class="space-y-2">
              <div class="font-medium break-all">
                {{ getDisplaySourceId(row) }}
              </div>
              <div class="text-xs text-gray-500">
                {{
                  getSourceSnapshot(row)?.title ||
                  getSourceSnapshot(row)?.name ||
                  '未提供源数据摘要'
                }}
              </div>
            </div>
          </slot>
        </template>
      </ResponsiveTable>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </AdminPage>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import AdminPage from './AdminPage.vue'
import ResponsiveTable from './ResponsiveTable.vue'
import ResponsiveTableColumn from './ResponsiveTableColumn.vue'

const DEFAULT_LANGUAGE_CODES = ['en', 'jp', 'tw']

function cloneInitialQuery(initialQuery) {
  const nextQuery = { page: 1, languageCode: '' }

  if (!initialQuery) {
    return nextQuery
  }

  for (const [key, value] of Object.entries(initialQuery)) {
    nextQuery[key] = value
  }

  return nextQuery
}

export default {
  name: 'GroupedLanguageManager',
  components: { AdminPage, ResponsiveTable, ResponsiveTableColumn },
  props: {
    title: { type: String, required: true },
    description: {
      type: String,
      default: '统一展示源数据与各语言条目，便于核对翻译结果与缺失内容。'
    },
    getList: { type: Function, required: true },
    initialQuery: {
      type: Object,
      default: () => ({ page: 1, languageCode: '' })
    },
    pageSize: { type: Number, default: 20 },
    sourceIdLabel: { type: String, default: 'Source ID' },
    keywordPlaceholder: { type: String, default: '' },
    languageCodes: {
      type: Array,
      default: () => [...DEFAULT_LANGUAGE_CODES]
    }
  },
  setup(props) {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const query = reactive(cloneInitialQuery(props.initialQuery))

    async function fetchList() {
      loading.value = true
      try {
        const params = {}

        for (const [key, value] of Object.entries(query)) {
          if (value === '' || value === null || value === undefined) {
            continue
          }
          params[key] = value
        }

        const res = await props.getList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function getLangEntry(row, languageCode) {
      if (!row || !Array.isArray(row.langs)) {
        return null
      }

      return row.langs.find(item => item.languageCode === languageCode) || null
    }

    function getPrimaryEntry(row) {
      if (!row || !Array.isArray(row.langs)) {
        return null
      }

      for (const languageCode of props.languageCodes) {
        const matchedEntry = getLangEntry(row, languageCode)
        if (matchedEntry) {
          return matchedEntry
        }
      }

      if (row.langs.length > 0) {
        return row.langs[0]
      }

      return null
    }

    function getSourceSnapshot(row) {
      if (!row) {
        return null
      }
      if (row.sourceSnapshot) {
        return row.sourceSnapshot
      }

      const primaryEntry = getPrimaryEntry(row)
      if (!primaryEntry) {
        return null
      }
      if (primaryEntry.sourceSnapshot) {
        return primaryEntry.sourceSnapshot
      }
      if (primaryEntry.rawData) {
        return primaryEntry.rawData
      }

      return null
    }

    function getDisplaySourceId(row) {
      if (!row) {
        return '-'
      }
      if (row.sourceId) {
        return row.sourceId
      }
      if (row.groupKey) {
        return row.groupKey
      }

      return '-'
    }

    onMounted(fetchList)

    return {
      list,
      total,
      loading,
      query,
      fetchList,
      getLangEntry,
      getPrimaryEntry,
      getSourceSnapshot,
      getDisplaySourceId
    }
  }
}
</script>
