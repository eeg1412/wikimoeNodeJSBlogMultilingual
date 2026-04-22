<template>
  <AdminPage
    title="翻译记忆库"
    description="统一审核 AI 和人工积累的翻译条目，减少重复翻译并提升术语一致性。"
  >
    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">条目总数</div>
          <div class="admin-stat-card__value">{{ total }}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">筛选状态</div>
          <div class="admin-stat-card__value">
            {{ query.status || '全部' }}
          </div>
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
          style="width: 120px"
        >
          <el-option label="en" value="en" />
          <el-option label="jp" value="jp" />
          <el-option label="tw" value="tw" />
        </el-select>
        <el-select
          v-model="query.status"
          placeholder="状态"
          clearable
          style="width: 120px"
        >
          <el-option label="待审核" value="pending" />
          <el-option label="已批准" value="approved" />
        </el-select>
        <el-button type="primary" @click="fetchList">查询</el-button>
        </div>
        <div class="admin-filter-row__hint">
          支持只看待审核内容，快速完成翻译记忆库清理。
        </div>
      </div>

      <ResponsiveTable :data="list" :loading="loading">
        <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
        <ResponsiveTableColumn
          prop="sourceText"
          label="原文"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn
          prop="translatedText"
          label="译文"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn prop="fieldKind" label="类型" width="100" />
        <ResponsiveTableColumn prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'approved' ? 'success' : 'warning'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="100">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'approved'"
              type="success"
              link
              size="small"
              :loading="row._approving"
              @click="handleApprove(row)"
            >
              批准
            </el-button>
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="space-y-1 text-sm">
            <div class="text-gray-500 text-xs">
              {{ row.languageCode }} · {{ row.fieldKind }}
            </div>
            <div class="truncate">{{ row.sourceText }}</div>
            <div class="truncate text-blue-600">{{ row.translatedText }}</div>
            <div class="flex justify-between items-center">
              <el-tag
                :type="row.status === 'approved' ? 'success' : 'warning'"
                size="small"
                >{{ row.status }}</el-tag
              >
              <el-button
                v-if="row.status !== 'approved'"
                type="success"
                link
                size="small"
                @click="handleApprove(row)"
                >批准</el-button
              >
            </div>
          </div>
        </template>
      </ResponsiveTable>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="query.page"
          :page-size="20"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchList"
        />
      </div>
    </el-card>
  </AdminPage>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import {
  getTranslationMemoryList,
  approveTranslationMemory
} from '../api/translation.js'
import AdminPage from '../components/AdminPage.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'TranslationMemory',
  components: { AdminPage, ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const query = reactive({ page: 1, languageCode: '', status: '' })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (!params.languageCode) delete params.languageCode
        if (!params.status) delete params.status
        const res = await getTranslationMemoryList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    async function handleApprove(row) {
      row._approving = true
      try {
        await approveTranslationMemory(row._id)
        ElMessage.success('批准成功')
        fetchList()
      } finally {
        row._approving = false
      }
    }

    onMounted(fetchList)
    return { list, total, loading, query, fetchList, handleApprove }
  }
}
</script>
