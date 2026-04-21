<template>
  <div class="page-stack">
    <el-card>
      <template #header>原站导入</template>
      <el-form :model="form" inline class="form-row">
        <el-form-item label="原文 ID / 别名">
          <el-input v-model="form.sourceIdentifier" placeholder="例如 66f8... 或 post-alias" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.languageCode" style="width: 140px">
            <el-option label="English" value="en" />
            <el-option label="Japanese" value="jp" />
            <el-option label="Traditional Chinese" value="tw" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitImport">开始导入</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>最近导入任务</template>
      <ResponsiveTable :data="jobList">
        <ResponsiveTableColumn label="源标识" prop="sourceIdentifier" />
        <ResponsiveTableColumn label="解析后 ID" prop="sourceResolvedId" />
        <ResponsiveTableColumn label="语言" prop="languageCode" />
        <ResponsiveTableColumn label="状态" prop="status" />
        <ResponsiveTableColumn label="阶段" prop="stage" />
        <ResponsiveTableColumn label="完成时间">
          <template #default="{ row }">
            {{ formatDate(row.finishedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="结果">
          <template #default="{ row }">
            <el-button
              v-if="row.resultPostId"
              type="primary"
              link
              @click="goToEditor(row.resultPostId)"
            >
              打开文章
            </el-button>
            <span v-else>-</span>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { authApi } from '@/api'

const router = useRouter()
const form = reactive({
  sourceIdentifier: '',
  languageCode: 'en'
})
const jobList = ref([])

function formatDate(value) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

function goToEditor(id) {
  router.push({ name: 'PostEditor', params: { id } })
}

async function loadJobs() {
  const result = await authApi.getImportJobs({ page: 1, limit: 20 })
  jobList.value = result.list
}

async function executeImport(confirmOverwrite = false) {
  const result = await authApi.importPost({ ...form, confirmOverwrite })
  ElMessage.success('导入成功')
  await loadJobs()
  goToEditor(result.post._id)
}

async function submitImport() {
  try {
    await executeImport(false)
  } catch (error) {
    if (error.message.includes('当前语言文章已存在')) {
      try {
        await ElMessageBox.confirm(
          '当前语言文章已存在。确认后目标文章会被打回草稿并覆盖同步字段，是否继续？',
          '重复导入确认',
          { type: 'warning' }
        )
        await executeImport(true)
      } catch (confirmError) {
        if (confirmError !== 'cancel') {
          ElMessage.error(confirmError.message || '覆盖导入失败')
        }
      }
      return
    }
    ElMessage.error(error.message)
  }
}

onMounted(loadJobs)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>