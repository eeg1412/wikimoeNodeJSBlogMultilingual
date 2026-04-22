<template>
  <div>
    <h2 class="text-xl font-bold mb-6">AI 翻译日志</h2>
    <el-card>
      <div class="flex gap-3 mb-4">
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
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

        <ResponsiveTable :data="list" :loading="loading">
          <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
          <ResponsiveTableColumn prop="fieldPath" label="字段" width="110" />
          <ResponsiveTableColumn
            label="原文摘要"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.requestPayload?.sourceTextPreview || '-' }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn
            label="结果"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.normalizedResult?.text || row.errorMessage || '-' }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn prop="success" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                {{ row.success ? '成功' : '失败' }}
              </el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn prop="model" label="模型" width="140" />
        <ResponsiveTableColumn label="时间" width="160">
          <template #default="{ row }">{{
            new Date(row.createdAt).toLocaleString()
          }}</template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="space-y-1 text-sm">
            <div class="text-xs text-gray-400">
              {{ row.languageCode }} · {{ row.fieldPath || '-' }} · {{ row.model }}
            </div>
            <div class="truncate text-gray-700">
              {{ row.requestPayload?.sourceTextPreview || '-' }}
            </div>
            <div
              class="truncate"
              :class="row.success ? 'text-blue-600' : 'text-red-500'"
            >
              {{ row.normalizedResult?.text || row.errorMessage || '-' }}
            </div>
            <div class="text-xs text-gray-400">
              {{ new Date(row.createdAt).toLocaleString() }}
            </div>
          </div>
        </template>
      </ResponsiveTable>

      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { getAiTranslationLogList } from '../api/translation.js'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'

export default {
  name: 'AiTranslationLog',
  components: { ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const query = reactive({ page: 1, languageCode: '' })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (!params.languageCode) delete params.languageCode
        const res = await getAiTranslationLogList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    onMounted(fetchList)
    return { list, total, loading, query, fetchList }
  }
}
</script>
