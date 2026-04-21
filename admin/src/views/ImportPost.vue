<template>
  <div class="import-post-page">
    <section class="import-hero">
      <div>
        <div class="import-eyebrow">Import Workflow</div>
        <h2 class="import-title">从原站导入单篇文章</h2>
        <p class="import-subtitle">
          输入原站 ID 或
          alias，选择目标语言后导入。页面类型文章会被拒绝；重复导入会先提醒，再由你决定是否覆盖。
        </p>
      </div>
      <el-alert
        type="info"
        show-icon
        :closable="false"
        class="import-hero-alert"
        title="导入成功后会自动创建或覆盖当前语言文章，并同步共享实体与远程附件。"
      />
    </section>

    <section class="import-grid">
      <el-card shadow="never" class="import-card">
        <template #header>
          <div class="import-card-header">
            <span>导入表单</span>
            <span class="import-card-header-sub"
              >面向单篇文章或推文的精确导入</span
            >
          </div>
        </template>

        <el-form
          :model="form"
          label-position="top"
          class="import-form"
          @submit.prevent="submit"
        >
          <el-form-item label="原站 ID / alias" required>
            <el-input
              v-model="form.sourceIdentifier"
              placeholder="例如 66aa... 或 my-article-alias"
              autocomplete="off"
              maxlength="64"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="目标语言" required>
            <el-radio-group v-model="form.languageCode">
              <el-radio-button
                v-for="lang in LANGUAGES"
                :key="lang.code"
                :label="lang.code"
              >
                {{ lang.code.toUpperCase() }}
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="loading" @click="submit">
              开始导入
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <div class="import-side-column">
        <el-card shadow="never" class="import-card">
          <template #header>
            <div class="import-card-header">
              <span>导入规则</span>
              <span class="import-card-header-sub">与 plan 对齐的行为说明</span>
            </div>
          </template>
          <ol class="import-rule-list">
            <li>先按 type=[1,2] 查询原站，仅允许博文和推文。</li>
            <li>
              若当前语言已存在，会提示你是否覆盖；确认覆盖后状态会回到草稿。
            </li>
            <li>
              共享实体只做 upsert，不会重复插入；正文媒体会登记为 remote 附件。
            </li>
            <li>导入成功后跳转到文章编辑页继续翻译、校验和发布。</li>
          </ol>
        </el-card>

        <el-card v-if="lastResult" shadow="never" class="import-card">
          <template #header>
            <div class="import-card-header">
              <span>最近一次导入结果</span>
              <el-tag :type="modeTag(lastResult.mode)">{{
                lastResult.mode
              }}</el-tag>
            </div>
          </template>
          <div class="import-result-grid">
            <div>
              <div class="import-result-label">任务 ID</div>
              <div class="import-result-value">{{ lastResult.jobId }}</div>
            </div>
            <div>
              <div class="import-result-label">文章 ID</div>
              <div class="import-result-value">{{ lastResult.postId }}</div>
            </div>
          </div>
          <div class="import-result-actions">
            <el-button type="primary" plain @click="openPost"
              >打开文章</el-button
            >
            <el-button @click="router.push('/post/group/list')"
              >查看语言分组</el-button
            >
          </div>
          <div v-if="lastResult.warnings?.length" class="warnings">
            <div class="warnings-title">警告</div>
            <ul>
              <li v-for="(warning, index) in lastResult.warnings" :key="index">
                [{{ warning.code }}] {{ warning.message }}
              </li>
            </ul>
          </div>
        </el-card>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Joi from 'joi'
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const router = useRouter()

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

function openPost() {
  if (!lastResult.value?.postId) return
  router.push(`/post/edit/${lastResult.value.postId}`)
}

onMounted(() => {
  if (typeof route.query.sourceIdentifier === 'string') {
    form.sourceIdentifier = route.query.sourceIdentifier
  }
  if (
    typeof route.query.languageCode === 'string' &&
    LANGUAGES.some(item => item.code === route.query.languageCode)
  ) {
    form.languageCode = route.query.languageCode
  }
})
</script>

<style scoped>
.import-post-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.import-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f4f7fd 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.import-eyebrow {
  color: #677791;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.import-title {
  margin: 0;
  font-size: 32px;
  color: #172033;
}

.import-subtitle {
  margin: 12px 0 0;
  color: #64748b;
  line-height: 1.8;
}

.import-hero-alert {
  align-self: stretch;
}

.import-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 16px;
}

.import-side-column {
  display: grid;
  gap: 16px;
}

.import-card {
  border-radius: 24px;
}

.import-card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 600;
}

.import-card-header-sub {
  color: #718197;
  font-size: 12px;
  font-weight: 400;
}

.import-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-rule-list {
  margin: 0;
  padding-left: 18px;
  color: #55647f;
  line-height: 1.8;
}

.import-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.import-result-label {
  color: #6c7a93;
  font-size: 12px;
}

.import-result-value {
  margin-top: 6px;
  font-weight: 600;
  color: #172033;
  word-break: break-all;
}

.import-result-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.warnings {
  margin-top: 12px;
  color: #e6a23c;
}
.warnings-title {
  font-weight: 600;
  margin-bottom: 4px;
}

@media (max-width: 1024px) {
  .import-hero,
  .import-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .import-title {
    font-size: 28px;
  }

  .import-result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
