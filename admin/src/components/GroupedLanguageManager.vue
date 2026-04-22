<template>
  <div>
    <h2 class="text-xl font-bold mb-6">{{ title }}</h2>

    <el-card>
      <div class="flex flex-wrap gap-3 mb-4">
        <el-select
          v-model="query.languageCode"
          placeholder="语言"
          clearable
          style="width: 120px"
        >
          <el-option label="en" value="en" />
          <el-option label="jp" value="jp" />
          <el-option label="tw" value="tw" />
        </el-select>
        <slot name="filters" :query="query" :fetch-list="fetchList" />
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

      <ResponsiveTable :data="list" :loading="loading">
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

      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
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
  components: { ResponsiveTable, ResponsiveTableColumn },
  props: {
    title: { type: String, required: true },
    getList: { type: Function, required: true },
    initialQuery: {
      type: Object,
      default: () => ({ page: 1, languageCode: '' })
    },
    pageSize: { type: Number, default: 20 },
    sourceIdLabel: { type: String, default: 'Source ID' },
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
