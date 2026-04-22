<template>
  <AdminPage
    title="登录日志"
    description="查看管理员登录结果、IP 地理位置和设备信息，便于审计异常访问行为。"
  >
    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">日志总数</div>
          <div class="admin-stat-card__value">{{ total }}</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">当前页</div>
          <div class="admin-stat-card__value">{{ page }}</div>
        </div>
      </div>
    </template>

    <el-card shadow="never">
      <ResponsiveTable :data="list" :loading="loading">
        <ResponsiveTableColumn prop="username" label="用户名" width="140" />
        <ResponsiveTableColumn prop="success" label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="IP" width="160">
          <template #default="{ row }">
            <IpInfoDisplay :ip="row.IP" :ip-info="row.ipInfo" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="设备" show-overflow-tooltip>
          <template #default="{ row }">
            <DeviceInfoDisplay :device="row.deviceInfo" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="时间" width="160">
          <template #default="{ row }">{{
            new Date(row.createdAt).toLocaleString()
          }}</template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="font-medium">{{ row.username }}</span>
              <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{
                row.success ? '成功' : '失败'
              }}</el-tag>
            </div>
            <div><IpInfoDisplay :ip="row.IP" :ip-info="row.ipInfo" /></div>
            <div><DeviceInfoDisplay :device="row.deviceInfo" /></div>
            <div class="text-xs text-gray-400">
              {{ new Date(row.createdAt).toLocaleString() }}
            </div>
          </div>
        </template>
      </ResponsiveTable>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="page"
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
import { ref, onMounted } from 'vue'
import { getLoginLogList } from '../api/auth.js'
import AdminPage from '../components/AdminPage.vue'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'
import IpInfoDisplay from '../components/IpInfoDisplay.vue'
import DeviceInfoDisplay from '../components/DeviceInfoDisplay.vue'

export default {
  name: 'LoginLog',
  components: {
    AdminPage,
    ResponsiveTable,
    ResponsiveTableColumn,
    IpInfoDisplay,
    DeviceInfoDisplay
  },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const page = ref(1)

    async function fetchList() {
      loading.value = true
      try {
        const res = await getLoginLogList({ page: page.value })
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    onMounted(fetchList)
    return { list, total, loading, page, fetchList }
  }
}
</script>
