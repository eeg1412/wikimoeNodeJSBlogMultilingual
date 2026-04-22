<template>
  <AdminPage
    title="AI 翻译日志"
    description="对照原文摘要、模型输出和失败信息，快速分析翻译链路的质量与稳定性。"
  >
    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">日志总数</div>
          <div class="admin-stat-card__value">{{ total }}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">当前语言</div>
          <div class="admin-stat-card__value">
            {{ query.languageCode || '全部' }}
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
            v-model="query.success"
            placeholder="状态"
            clearable
            style="width: 140px"
          >
            <el-option label="成功" :value="true" />
            <el-option label="失败" :value="false" />
          </el-select>
          <el-select
            v-model="query.entityType"
            placeholder="实体类型"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="item in entityTypeOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
          <el-button type="primary" @click="fetchList">查询</el-button>
        </div>
        <div class="admin-filter-row__hint">
          便于追踪模型输出、接口报错和字段级翻译结果。
        </div>
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
          <ResponsiveTableColumn prop="entityType" label="实体" width="120" />
          <ResponsiveTableColumn prop="model" label="模型" width="140" />
          <ResponsiveTableColumn label="时间" width="160">
            <template #default="{ row }">{{
              new Date(row.createdAt).toLocaleString()
            }}</template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="详情" width="100">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openDetail(row)">
                查看
              </el-button>
            </template>
          </ResponsiveTableColumn>

          <template #mobile-card="{ row }">
            <div class="space-y-1 text-sm">
              <div class="text-xs text-gray-400">
                {{ row.languageCode }} · {{ row.fieldPath || '-' }} ·
                {{ row.model }}
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
              <div>
                <el-button type="primary" link size="small" @click="openDetail(row)">
                  查看完整详情
                </el-button>
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

    <el-dialog v-model="detailVisible" title="翻译日志详情" width="760px">
      <div v-if="currentLog" class="space-y-3">
        <div class="text-sm text-gray-500">
          {{ currentLog.entityType }} · {{ currentLog.fieldPath || '-' }} ·
          {{ currentLog.model || '-' }}
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="原文预览">
            {{ currentLog.requestPayload?.sourceTextPreview || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="翻译结果">
            {{ currentLog.normalizedResult?.text || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="错误信息">
            {{ currentLog.errorMessage || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="请求载荷">
            <pre class="source-snapshot-preview">{{ formatJson(currentLog.requestPayload) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="响应载荷">
            <pre class="source-snapshot-preview">{{ formatJson(currentLog.responsePayload) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </AdminPage>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { getAiTranslationLogList } from '../api/translation.js'
import AdminPage from '../components/AdminPage.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'

export default {
  name: 'AiTranslationLog',
  components: { AdminPage, ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const detailVisible = ref(false)
    const currentLog = ref(null)
    const entityTypeOptions = [
      'post',
      'author',
      'sort',
      'tag',
      'mappoint',
      'attachment',
      'Bangumi',
      'Movie',
      'Game',
      'Book',
      'Event',
      'Vote'
    ]
    const query = reactive({
      page: 1,
      languageCode: '',
      success: '',
      entityType: ''
    })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (!params.languageCode) delete params.languageCode
        if (params.success === '') delete params.success
        if (!params.entityType) delete params.entityType
        const res = await getAiTranslationLogList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function openDetail(row) {
      currentLog.value = row
      detailVisible.value = true
    }

    function formatJson(value) {
      if (!value) {
        return '-'
      }
      return JSON.stringify(value, null, 2)
    }

    onMounted(fetchList)
    return {
      list,
      total,
      loading,
      query,
      detailVisible,
      currentLog,
      entityTypeOptions,
      fetchList,
      openDetail,
      formatJson
    }
  }
}
</script>
