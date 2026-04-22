<template>
  <div>
    <h2 class="text-xl font-bold mb-6">附件管理</h2>
    <el-card>
      <!-- 上传本地附件 -->
      <el-upload
        action=""
        :http-request="handleUpload"
        :show-file-list="false"
        accept="image/*"
        class="mb-4"
      >
        <el-button type="primary">上传本地附件</el-button>
      </el-upload>

      <div class="flex gap-3 mb-4">
        <el-select
          v-model="query.type"
          placeholder="类型"
          clearable
          style="width: 140px"
        >
          <el-option label="远程（源站）" value="remote" />
          <el-option label="本地上传" value="localized" />
        </el-select>
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

      <ResponsiveTable :data="list" :loading="loading">
        <ResponsiveTableColumn label="预览" width="80">
          <template #default="{ row }">
            <el-image
              :src="row.url"
              style="width: 48px; height: 48px; object-fit: cover"
            />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="type" label="类型" width="100" />
        <ResponsiveTableColumn
          prop="name"
          label="文件名"
          show-overflow-tooltip
        />
        <ResponsiveTableColumn prop="mimeType" label="MIME" width="120" />
        <ResponsiveTableColumn label="操作" width="100">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)"
              >编辑</el-button
            >
          </template>
        </ResponsiveTableColumn>

        <template #mobile-card="{ row }">
          <div class="flex gap-3 items-center">
            <el-image
              :src="row.url"
              style="
                width: 48px;
                height: 48px;
                object-fit: cover;
                flex-shrink: 0;
              "
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ row.name }}</div>
              <div class="text-xs text-gray-400">{{ row.type }}</div>
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

    <el-dialog v-model="dialogVisible" title="编辑附件" width="480px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="文件名">
          <el-input v-model="editForm.name" />
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
import {
  getAttachmentList,
  updateAttachment,
  uploadLocalizedAttachment
} from '../api/attachment.js'
import ResponsiveTable from '../components/ResponsiveTable.vue'
import ResponsiveTableColumn from '../components/ResponsiveTableColumn.vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'AttachmentList',
  components: { ResponsiveTable, ResponsiveTableColumn },
  setup() {
    const list = ref([])
    const total = ref(0)
    const loading = ref(false)
    const saving = ref(false)
    const dialogVisible = ref(false)
    const currentId = ref(null)
    const query = reactive({ page: 1, type: '' })
    const editForm = reactive({ name: '' })

    async function fetchList() {
      loading.value = true
      try {
        const params = { ...query }
        if (!params.type) delete params.type
        const res = await getAttachmentList(params)
        list.value = res.data?.list || []
        total.value = res.data?.total || 0
      } finally {
        loading.value = false
      }
    }

    async function handleUpload({ file }) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await uploadLocalizedAttachment(formData)
        ElMessage.success('上传成功')
        fetchList()
      } catch {
        ElMessage.error('上传失败')
      }
    }

    function openEdit(row) {
      currentId.value = row._id
      editForm.name = row.name || ''
      dialogVisible.value = true
    }

    async function handleSave() {
      saving.value = true
      try {
        await updateAttachment(currentId.value, { name: editForm.name })
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
      handleUpload,
      openEdit,
      handleSave
    }
  }
}
</script>
