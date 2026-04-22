<template>
  <div class="page-shell">
    <section class="page-header-card">
      <div>
        <p class="page-kicker">Import Workspace</p>
        <h1 class="page-title">文章导入</h1>
        <p class="page-copy">
          按原文 ID
          或别名导入文章。当前导入流程已接入后台鉴权、重复导入检测、importJobs
          记录和共享实体基础同步。
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push({ name: 'PostList' })" plain
          >文章列表</el-button
        >
        <el-button @click="router.push({ name: 'AdminLoginLog' })" plain
          >登录日志</el-button
        >
        <el-button @click="router.push({ name: 'Settings' })" plain
          >基础配置</el-button
        >
        <el-button @click="refreshJobs" :loading="jobLoading"
          >刷新任务</el-button
        >
        <el-button @click="handleRotateSecret" plain
          >重置后台 JWT 密钥</el-button
        >
        <el-button type="danger" plain @click="handleLogout"
          >退出登录</el-button
        >
      </div>
    </section>

    <div class="page-grid">
      <section class="surface-card">
        <h2 class="section-title">发起导入</h2>
        <el-form label-position="top" @submit.prevent>
          <el-form-item label="原文 ID / 别名">
            <el-input
              v-model="form.sourceIdentifier"
              placeholder="例如 6623c7... 或 article-alias"
              @keydown.enter="handleImport"
            />
          </el-form-item>
          <el-form-item label="目标语言">
            <el-select v-model="form.languageCode" class="full-width">
              <el-option label="English" value="en" />
              <el-option label="Japanese" value="jp" />
              <el-option label="Traditional Chinese" value="tw" />
            </el-select>
          </el-form-item>
          <el-alert
            v-if="duplicateState.visible"
            type="warning"
            show-icon
            :closable="false"
            title="当前语言文章已存在，已解锁覆盖导入。"
            class="mb16"
          />
          <el-form-item>
            <el-checkbox v-model="form.confirmOverwrite">
              确认覆盖已存在文章
            </el-checkbox>
          </el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleImport">
            开始导入
          </el-button>
        </el-form>

        <div v-if="lastImportResult" class="import-result">
          <p class="result-title">最近一次导入结果</p>
          <p class="result-line">文章 ID：{{ lastImportResult.postId }}</p>
          <p class="result-line">任务 ID：{{ lastImportResult.importJobId }}</p>
          <router-link
            class="result-link"
            :to="editorRoute(lastImportResult.postId)"
          >
            前往编辑页占位
          </router-link>
        </div>
      </section>

      <section class="surface-card">
        <div class="jobs-header">
          <h2 class="section-title">导入任务</h2>
          <el-tag type="info">{{ jobs.length }} 条</el-tag>
        </div>
        <div v-if="jobLoading" class="job-empty">正在加载任务列表...</div>
        <div v-else-if="jobs.length === 0" class="job-empty">暂无导入任务</div>
        <div v-else class="job-list">
          <article v-for="job in jobs" :key="job._id" class="job-card">
            <div class="job-topline">
              <p class="job-id">{{ job.sourceIdentifier }}</p>
              <el-tag :type="statusTagType(job.status)">{{
                job.status
              }}</el-tag>
            </div>
            <p class="job-meta">
              语言：{{ job.languageCode }} | 阶段：{{ job.stage }}
            </p>
            <p class="job-meta">任务：{{ job._id }}</p>
            <p
              v-if="Array.isArray(job.errors) && job.errors.length > 0"
              class="job-error"
            >
              {{ job.errors[0] }}
            </p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  getImportJobListApi,
  handleAuthFailure,
  importPostApi,
  regenerateAdminSecretApi,
  showRequestErrors
} from '@/api'
import { clearAdminToken } from '@/utils/adminSession'

const router = useRouter()
const submitting = ref(false)
const jobLoading = ref(false)
const lastImportResult = ref(null)
const jobs = ref([])
const duplicateState = reactive({
  visible: false,
  existingPostId: null
})
const form = reactive({
  sourceIdentifier: '',
  languageCode: 'en',
  confirmOverwrite: false
})

function editorRoute(postId) {
  return {
    name: 'PostEditor',
    params: {
      id: postId
    }
  }
}

function statusTagType(status) {
  if (status === 'success') {
    return 'success'
  }

  if (status === 'failed') {
    return 'danger'
  }

  if (status === 'running') {
    return 'warning'
  }

  return 'info'
}

async function refreshJobs() {
  jobLoading.value = true
  try {
    const response = await getImportJobListApi({ page: 1, size: 20 })
    jobs.value = Array.isArray(response.list) ? response.list : []
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
    if (error && (error.status === 401 || error.status === 403)) {
      await router.replace({ name: 'Login' })
    }
  } finally {
    jobLoading.value = false
  }
}

async function handleImport() {
  submitting.value = true
  duplicateState.visible = false

  try {
    const response = await importPostApi({
      sourceIdentifier: form.sourceIdentifier,
      languageCode: form.languageCode,
      confirmOverwrite: form.confirmOverwrite
    })
    lastImportResult.value = response.data
    form.confirmOverwrite = false
    ElMessage.success('导入任务已完成')
    await refreshJobs()
  } catch (error) {
    handleAuthFailure(error)
    if (error && error.status === 409) {
      duplicateState.visible = true
      const firstError =
        error.payload && Array.isArray(error.payload.errors)
          ? error.payload.errors[0]
          : null
      duplicateState.existingPostId = firstError
        ? firstError.existingPostId
        : null
      form.confirmOverwrite = true
      showRequestErrors(error)
    } else {
      showRequestErrors(error)
    }

    if (error && (error.status === 401 || error.status === 403)) {
      await router.replace({ name: 'Login' })
    }
  } finally {
    submitting.value = false
  }
}

async function handleRotateSecret() {
  try {
    await ElMessageBox.confirm(
      '重置后台 JWT 密钥后，当前后台登录会立即失效。',
      '确认操作',
      {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '取消'
      }
    )
    await regenerateAdminSecretApi()
    ElMessage.success('后台 JWT 密钥已重置')
    handleLogout()
  } catch (error) {
    if (error === 'cancel') {
      return
    }

    handleAuthFailure(error)
    showRequestErrors(error)
  }
}

function handleLogout() {
  clearAdminToken()
  router.replace({ name: 'Login' })
}

onMounted(async function () {
  await refreshJobs()
})
</script>

<style scoped>
.page-shell {
  padding: 24px;
}

.page-header-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.page-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #0f766e;
}

.page-title {
  margin: 14px 0 0;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.02;
  color: #0f172a;
}

.page-copy {
  margin: 16px 0 0;
  max-width: 70ch;
  font-size: 15px;
  line-height: 1.8;
  color: #475569;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.page-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
}

.surface-card {
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
}

.section-title {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.full-width {
  width: 100%;
}

.mb16 {
  margin-bottom: 16px;
}

.import-result {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
}

.result-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.result-line {
  margin: 0 0 6px;
  font-size: 14px;
  color: #475569;
}

.result-link {
  display: inline-flex;
  margin-top: 10px;
  color: #0f766e;
  font-weight: 700;
  text-decoration: none;
}

.jobs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.job-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.job-list {
  display: grid;
  gap: 14px;
}

.job-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.job-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.job-id {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.job-meta {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}

.job-error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 1023px) {
  .page-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .page-shell {
    padding: 16px;
  }

  .page-header-card,
  .surface-card {
    padding: 20px;
    border-radius: 22px;
  }
}

:global(html.dark) .page-header-card,
:global(html.dark) .surface-card {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 24px 68px rgba(2, 6, 23, 0.42);
}

:global(html.dark) .page-title,
:global(html.dark) .section-title,
:global(html.dark) .result-title,
:global(html.dark) .job-id {
  color: #f8fafc;
}

:global(html.dark) .page-copy,
:global(html.dark) .result-line,
:global(html.dark) .job-meta,
:global(html.dark) .job-empty {
  color: #cbd5e1;
}

:global(html.dark) .job-card {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(100, 116, 139, 0.3);
}
</style>
