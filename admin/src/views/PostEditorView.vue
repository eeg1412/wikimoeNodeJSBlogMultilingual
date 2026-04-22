<template>
  <div class="editor-shell" v-loading="loading">
    <section class="page-header-card">
      <div>
        <p class="page-kicker">Post Editor</p>
        <h1 class="page-title">文章编辑</h1>
        <p class="page-copy">
          当前文章 ID：{{
            route.params.id
          }}。这里已经接入后台详情、保存和发布前校验，可直接修正文案、维护基础关联实体并切换草稿/发布状态。
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push({ name: 'PostList' })" plain
          >文章列表</el-button
        >
        <el-button @click="router.push({ name: 'AdminLoginLog' })" plain
          >登录日志</el-button
        >
        <el-button @click="router.push({ name: 'Import' })" plain
          >返回导入页</el-button
        >
        <el-button @click="handleValidate" :loading="validating"
          >校验发布</el-button
        >
        <el-button type="primary" @click="handleSave" :loading="saving"
          >保存文章</el-button
        >
      </div>
    </section>

    <div class="editor-grid" v-if="!loading">
      <section class="surface-card">
        <h2 class="section-title">正文编辑</h2>
        <el-form label-position="top">
          <el-form-item label="标题">
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item label="别名">
            <el-input v-model="form.alias" />
          </el-form-item>
          <el-form-item label="摘要">
            <el-input v-model="form.excerpt" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="正文 HTML">
            <el-input v-model="form.content" type="textarea" :rows="18" />
          </el-form-item>
        </el-form>
      </section>

      <section class="surface-card">
        <h2 class="section-title">发布信息</h2>
        <el-form label-position="top">
          <el-form-item label="文章类型">
            <el-select v-model="form.type" class="full-width">
              <el-option label="Post" :value="1" />
              <el-option label="Tweet" :value="2" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" class="full-width">
              <el-option label="草稿" :value="0" />
              <el-option label="已发布" :value="1" />
              <el-option label="已删除" :value="99" />
            </el-select>
          </el-form-item>
          <el-form-item label="发布时间">
            <el-date-picker
              v-model="form.date"
              class="full-width"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
              placeholder="选择发布时间"
            />
          </el-form-item>
          <el-form-item label="模板">
            <el-input v-model="form.template" />
          </el-form-item>
          <el-form-item label="扩展代码">
            <el-input v-model="form.code" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.allowRemark">允许评论</el-checkbox>
          </el-form-item>
        </el-form>
      </section>

      <section class="surface-card" v-loading="entityLoading">
        <h2 class="section-title">关联实体</h2>
        <el-form label-position="top">
          <el-form-item label="作者">
            <el-select
              v-model="form.author"
              class="full-width"
              clearable
              filterable
            >
              <el-option
                v-for="item in authorOptions"
                :key="item._id"
                :label="item.label"
                :value="item._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="分类">
            <el-select
              v-model="form.sort"
              class="full-width"
              clearable
              filterable
            >
              <el-option
                v-for="item in sortOptions"
                :key="item._id"
                :label="item.label"
                :value="item._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="标签">
            <el-select
              v-model="form.tags"
              class="full-width"
              multiple
              filterable
            >
              <el-option
                v-for="item in tagOptions"
                :key="item._id"
                :label="item.label"
                :value="item._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="地点">
            <el-select
              v-model="form.mappointList"
              class="full-width"
              multiple
              filterable
            >
              <el-option
                v-for="item in mappointOptions"
                :key="item._id"
                :label="item.label"
                :value="item._id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </section>

      <section class="surface-card">
        <div class="section-title-row">
          <h2 class="section-title no-margin">文章状态</h2>
          <el-tag :type="statusTagType(detail.status)">{{
            statusText(detail.status)
          }}</el-tag>
        </div>
        <div class="meta-list">
          <p><strong>语言：</strong>{{ detail.languageCode || '-' }}</p>
          <p>
            <strong>翻译状态：</strong>{{ detail.translationStatus || '-' }}
          </p>
          <p>
            <strong>人工编辑：</strong>{{ detail.isManualEdited ? '是' : '否' }}
          </p>
          <p><strong>原站 ID：</strong>{{ detail.sourceId || '-' }}</p>
          <p><strong>原站别名：</strong>{{ detail.sourceAlias || '-' }}</p>
          <p><strong>来源组 ID：</strong>{{ detail.groupSourceId || '-' }}</p>
        </div>
        <div v-if="detail.validationState" class="validation-panel">
          <p class="validation-title">最近一次校验</p>
          <p class="validation-line">
            结果：{{ detail.validationState.valid ? '通过' : '未通过' }}
          </p>
          <p class="validation-line">
            时间：{{ formatDate(detail.validationState.checkedAt) }}
          </p>
          <ul
            v-if="
              Array.isArray(detail.validationState.errors) &&
              detail.validationState.errors.length > 0
            "
            class="validation-list"
          >
            <li v-for="message in detail.validationState.errors" :key="message">
              {{ message }}
            </li>
          </ul>
        </div>
      </section>

      <section class="surface-card">
        <h2 class="section-title">导入与发布记录</h2>
        <pre class="json-panel">{{ formatJson(detail.importMeta) }}</pre>
        <pre class="json-panel mt16">{{ formatJson(detail.publishMeta) }}</pre>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  getEntityOptionsApi,
  getPostDetailApi,
  handleAuthFailure,
  showRequestErrors,
  updatePostApi,
  validatePostApi
} from '@/api'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const validating = ref(false)
const entityLoading = ref(false)
const authorOptions = ref([])
const sortOptions = ref([])
const tagOptions = ref([])
const mappointOptions = ref([])
const detail = reactive({
  status: 0,
  languageCode: '',
  translationStatus: '',
  isManualEdited: false,
  sourceId: '',
  sourceAlias: '',
  groupSourceId: '',
  author: null,
  sort: null,
  tags: [],
  mappointList: [],
  validationState: null,
  importMeta: null,
  publishMeta: null
})
const form = reactive({
  title: '',
  alias: '',
  excerpt: '',
  content: '',
  date: null,
  status: 0,
  type: 1,
  allowRemark: false,
  author: null,
  sort: null,
  tags: [],
  mappointList: [],
  template: '',
  code: '',
  editorVersion: 5
})

function assignDetail(data) {
  Object.assign(detail, data)
  form.title = data.title || ''
  form.alias = data.alias || ''
  form.excerpt = data.excerpt || ''
  form.content = data.content || ''
  form.date = data.date || null
  form.status = typeof data.status === 'number' ? data.status : 0
  form.type = typeof data.type === 'number' ? data.type : 1
  form.allowRemark = data.allowRemark === true
  form.author = data.author ? data.author._id : null
  form.sort = data.sort ? data.sort._id : null
  form.tags = Array.isArray(data.tags)
    ? data.tags.map(function (item) {
        return item._id
      })
    : []
  form.mappointList = Array.isArray(data.mappointList)
    ? data.mappointList.map(function (item) {
        return item._id
      })
    : []
  form.template = data.template || ''
  form.code = data.code || ''
  form.editorVersion = data.editorVersion || 5
}

function statusText(status) {
  if (status === 1) {
    return '已发布'
  }

  if (status === 99) {
    return '已删除'
  }

  return '草稿'
}

function statusTagType(status) {
  if (status === 1) {
    return 'success'
  }

  if (status === 99) {
    return 'danger'
  }

  return 'info'
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString('zh-CN')
}

function formatJson(value) {
  if (!value) {
    return '暂无记录'
  }

  return JSON.stringify(value, null, 2)
}

async function loadEntityOptions(languageCode) {
  entityLoading.value = true
  try {
    const [authors, sorts, tags, mappoints] = await Promise.all([
      getEntityOptionsApi({ type: 'authors', languageCode }),
      getEntityOptionsApi({ type: 'sorts', languageCode }),
      getEntityOptionsApi({ type: 'tags', languageCode }),
      getEntityOptionsApi({ type: 'mappoints', languageCode })
    ])
    authorOptions.value = Array.isArray(authors.data) ? authors.data : []
    sortOptions.value = Array.isArray(sorts.data) ? sorts.data : []
    tagOptions.value = Array.isArray(tags.data) ? tags.data : []
    mappointOptions.value = Array.isArray(mappoints.data) ? mappoints.data : []
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    entityLoading.value = false
  }
}

async function loadDetail() {
  loading.value = true
  try {
    const response = await getPostDetailApi(route.params.id)
    assignDetail(response.data)
    if (response.data.languageCode) {
      await loadEntityOptions(response.data.languageCode)
    }
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    loading.value = false
  }
}

async function handleValidate() {
  validating.value = true
  try {
    const response = await validatePostApi(route.params.id)
    detail.validationState = response.data
    if (response.data.valid) {
      ElMessage.success('发布校验通过')
    } else {
      ElMessage.warning('发布校验未通过')
    }
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    validating.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const response = await updatePostApi({
      id: route.params.id,
      title: form.title,
      alias: form.alias,
      excerpt: form.excerpt,
      content: form.content,
      date: form.date,
      status: form.status,
      type: form.type,
      allowRemark: form.allowRemark,
      author: form.author,
      sort: form.sort,
      tags: form.tags,
      mappointList: form.mappointList,
      template: form.template,
      code: form.code,
      editorVersion: form.editorVersion
    })
    assignDetail(response.data)
    ElMessage.success('文章已保存')
  } catch (error) {
    handleAuthFailure(error)
    if (
      error &&
      error.payload &&
      error.payload.data &&
      error.payload.data.validationState
    ) {
      detail.validationState = error.payload.data.validationState
    }
    showRequestErrors(error)
  } finally {
    saving.value = false
  }
}

onMounted(async function () {
  await loadDetail()
})
</script>

<style scoped>
.editor-shell {
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

.editor-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr);
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.no-margin {
  margin: 0;
}

.full-width {
  width: 100%;
}

.meta-list p {
  margin: 0 0 10px;
  color: #475569;
  line-height: 1.7;
  word-break: break-all;
}

.validation-panel {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
}

.validation-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.validation-line {
  margin: 0 0 8px;
  color: #475569;
}

.validation-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #b91c1c;
  line-height: 1.8;
}

.json-panel {
  margin: 0;
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #334155;
  font-size: 12px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.mt16 {
  margin-top: 16px;
}

@media (max-width: 1023px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .editor-shell {
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
:global(html.dark) .validation-title {
  color: #f8fafc;
}

:global(html.dark) .page-copy,
:global(html.dark) .meta-list p,
:global(html.dark) .validation-line {
  color: #cbd5e1;
}

:global(html.dark) .json-panel {
  background: rgba(30, 41, 59, 0.78);
  border-color: rgba(100, 116, 139, 0.3);
  color: #e2e8f0;
}
</style>
