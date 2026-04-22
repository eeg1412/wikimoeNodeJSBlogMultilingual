<template>
  <div>
    <h2 class="text-xl font-bold mb-6">投票管理</h2>
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
        <ResponsiveTableColumn
          prop="title"
          label="标题"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn label="选项数" width="90">
          <template #default="{ row }">{{ row.options?.length || 0 }}</template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)"
              >编辑</el-button
            >
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="flex justify-between items-center">
            <div>
              <div class="font-medium truncate">{{ row.title }}</div>
              <div class="text-xs text-gray-400">{{ row.languageCode }}</div>
            </div>
            <el-button type="primary" link size="small" @click="openEdit(row)"
              >编辑</el-button
            >
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

    <el-dialog v-model="dialogVisible" title="编辑投票" width="560px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="选项">
          <div
            v-for="(opt, idx) in editForm.options"
            :key="idx"
            class="flex gap-2 mb-2"
          >
            <el-input v-model="opt.title" :placeholder="'选项 ' + (idx + 1)" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { getVoteList, updateVote } from '../api/entity.js'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'VoteList',
  components: { ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref(null)
    const query = reactive({ page: 1, languageCode: '' })
    const editForm = reactive({ title: '', options: [] })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (!params.languageCode) delete params.languageCode
        const res = await getVoteList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    function openEdit(row) {
      currentId.value = row._id
      editForm.title = row.title || ''
      editForm.options = (row.options || []).map(o => ({
        title: o.title || '',
        sourceOptionId: o.sourceOptionId
      }))
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateVote(currentId.value, {
          title: editForm.title,
          options: editForm.options
        })
        ElMessage.success('保存成功')
        dialogVisible.value = false
        fetchList()
      } finally {
        saving.value = false
      }
    }

    onMounted(fetchList)
    return {
      list,
      total,
      loading,
      saving,
      dialogVisible,
      query,
      editForm,
      fetchList,
      openEdit,
      handleSave
    }
  }
}
</script>
