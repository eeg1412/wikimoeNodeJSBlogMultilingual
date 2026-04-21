<template>
  <div class="import-post-page">
    <h2>导入文章</h2>
    <el-alert
      type="info"
      show-icon
      :closable="false"
      class="tip"
      title="输入原站文章 ID 或 alias，选择目标语言后导入。type=3 的页面会被拒绝。"
    />

    <el-form
      :model="form"
      label-width="120px"
      class="import-form"
      @submit.prevent="submit"
    >
      <el-form-item label="原站 ID/别名" required>
        <el-input
          v-model="form.sourceIdentifier"
          placeholder="例如 66aa... 或 my-article-alias"
          autocomplete="off"
          maxlength="64"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="目标语言" required>
        <el-select v-model="form.languageCode" placeholder="请选择语言">
          <el-option
            v-for="lang in LANGUAGES"
            :key="lang.code"
            :label="lang.label"
            :value="lang.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="loading" @click="submit">
          导入
        </el-button>
      </el-form-item>
    </el-form>

    <el-card v-if="lastResult" class="result-card">
      <template #header>
        <div class="result-header">
          <span>最近一次导入结果</span>
          <el-tag :type="modeTag(lastResult.mode)">{{
            lastResult.mode
          }}</el-tag>
        </div>
      </template>
      <div>任务 ID：{{ lastResult.jobId }}</div>
      <div>文章 ID：{{ lastResult.postId }}</div>
      <div v-if="lastResult.warnings?.length" class="warnings">
        <div class="warnings-title">警告：</div>
        <ul>
          <li v-for="(w, i) in lastResult.warnings" :key="i">
            [{{ w.code }}] {{ w.message }}
          </li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Joi from 'joi'
import { importApi } from '@/api/import'

const LANGUAGES = [
  { code: 'en', label: '英语 (en)' },
  { code: 'jp', label: '日语 (jp)' },
  { code: 'tw', label: '繁体中文 (tw)' }
]

const clientSchema = Joi.object({
  sourceIdentifier: Joi.string().trim().min(1).max(64).required(),
  languageCode: Joi.string()
    .valid(...LANGUAGES.map(l => l.code))
    .required(),
  confirmOverwrite: Joi.boolean().default(false)
})

const form = reactive({
  sourceIdentifier: '',
  languageCode: 'en'
})
const loading = ref(false)
const lastResult = ref(null)

function modeTag(mode) {
  if (mode === 'created') return 'success'
  if (mode === 'stub-upgraded') return 'warning'
  if (mode === 'overwritten') return 'danger'
  return 'info'
}

async function submit() {
  await runImport(false)
}

async function runImport(confirmOverwrite) {
  const payload = {
    sourceIdentifier: (form.sourceIdentifier || '').trim(),
    languageCode: form.languageCode,
    confirmOverwrite: !!confirmOverwrite
  }
  const { error, value } = clientSchema.validate(payload, { abortEarly: false })
  if (error) {
    ElMessage.error(error.message)
    return
  }
  loading.value = true
  try {
    const resp = await importApi.importPost(value)
    lastResult.value = resp.data
    ElMessage.success(value.confirmOverwrite ? '覆盖导入成功' : '导入成功')
  } catch (err) {
    await handleImportError(err)
  } finally {
    loading.value = false
  }
}

async function handleImportError(err) {
  const status = err?.response?.status
  const errs = err?.response?.data?.errors
  const detail = errs && errs[0]
  if (status === 409 && detail && detail.code === 'POST_EXISTS') {
    const existingStatus = detail.details?.translationStatus || 'unknown'
    try {
      await ElMessageBox.confirm(
        `该语言已存在译文（状态：${existingStatus}），是否覆盖？覆盖将重置为草稿并清空已有翻译。`,
        '确认覆盖',
        {
          confirmButtonText: '覆盖',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch (cancel) {
      return
    }
    await runImport(true)
  }
}
</script>

<style scoped>
.import-post-page {
  padding: 16px 24px;
}
.tip {
  margin-bottom: 16px;
}
.import-form {
  max-width: 640px;
}
.result-card {
  max-width: 640px;
  margin-top: 16px;
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.warnings {
  margin-top: 12px;
  color: #e6a23c;
}
.warnings-title {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
