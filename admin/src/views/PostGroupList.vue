<template>
  <div>
    <h2 class="text-xl font-bold mb-6">文章管理</h2>

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
        <el-select
          v-model="query.status"
          placeholder="状态"
          clearable
          style="width: 120px"
        >
          <el-option label="草稿" :value="0" />
          <el-option label="已发布" :value="1" />
        </el-select>
        <el-input
          v-model="query.title"
          placeholder="搜索标题"
          clearable
          style="width: 200px"
          @keyup.enter="fetchList"
        />
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

      <ResponsiveTable :data="list" :loading="loading">
        <ResponsiveTableColumn prop="languageCode" label="语言" width="80" />
        <ResponsiveTableColumn
          prop="title"
          label="标题"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goEdit(row._id)"
              >编辑</el-button
            >
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="flex justify-between items-start">
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ row.title }}</div>
              <div class="text-xs text-gray-500 mt-1">
                {{ row.languageCode }}
              </div>
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1">
              <el-tag
                :type="row.status === 1 ? 'success' : 'info'"
                size="small"
              >
                {{ row.status === 1 ? '已发布' : '草稿' }}
              </el-tag>
              <el-button
                type="primary"
                link
                size="small"
                @click="goEdit(row._id)"
                >编辑</el-button
              >
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
import { useRouter } from 'vue-router'
import { getPostGroupList } from '../api/post.js'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'

export default {
  name: 'PostGroupList',
  components: { ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const router = useRouter()
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)

    const query = reactive({
      page: 1,
      languageCode: '',
      status: null,
      title: ''
    })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (params.status === null || params.status === '') delete params.status
        if (!params.title) delete params.title
        if (!params.languageCode) delete params.languageCode

        const res = await getPostGroupList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function goEdit(id) {
      router.push(`/multilingual-admin/posts/edit/${id}`)
    }

    onMounted(fetchList)

    return { list, total, loading, query, fetchList, goEdit }
  }
}
</script>
