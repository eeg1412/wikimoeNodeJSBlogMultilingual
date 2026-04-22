<template>
  <div>
    <h2 class="text-xl font-bold mb-6">导入记录</h2>

    <el-card>
      <div class="flex gap-3 mb-4">
        <el-select
          v-model="query.languageCode"
          placeholder="语言"
          clearable
          style="width: 140px"
        >
          <el-option label="en" value="en" />
          <el-option label="jp" value="jp" />
          <el-option label="tw" value="tw" />
        </el-select>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

      <ResponsiveTable :data="list" :loading="loading">
        <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
        <ResponsiveTableColumn
          prop="sourceIdentifier"
          label="来源标识"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          prop="stage"
          label="阶段"
          width="120"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn label="错误" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatErrors(row.errors) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="text-sm space-y-1">
            <div class="flex justify-between">
              <span class="text-gray-500">语言</span>
              <span>{{ row.languageCode }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">状态</span>
              <el-tag :type="statusTagType(row.status)" size="small">{{
                row.status
              }}</el-tag>
            </div>
            <div class="text-gray-500 text-xs truncate">
              {{ row.sourceIdentifier }}
            </div>
            <div class="text-gray-400 text-xs">
              {{ formatDate(row.createdAt) }}
            </div>
            <div v-if="formatErrors(row.errors)" class="text-red-500 text-xs">
              {{ formatErrors(row.errors) }}
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
import { getImportJobList } from '../api/importJob.js'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'

export default {
  name: 'ImportJobList',
  components: { ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)

    const query = reactive({ page: 1, languageCode: '' })

    async function fetchList() {
      loading.value = true
      try {
        const res = await getImportJobList(query)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function statusTagType(status) {
        const map = {
          success: 'success',
          failed: 'danger',
          cancelled: 'warning',
          running: 'primary'
        }
        return map[status] || 'info'
      }

      function formatDate(val) {
        if (!val) return '-'
        return new Date(val).toLocaleString()
      }

      function formatErrors(errors) {
        if (!Array.isArray(errors) || errors.length === 0) return ''
        return errors.join('；')
      }

      onMounted(fetchList)

      return {
        list,
        total,
        loading,
        query,
        fetchList,
        statusTagType,
        formatDate,
        formatErrors
      }
  }
}
</script>
