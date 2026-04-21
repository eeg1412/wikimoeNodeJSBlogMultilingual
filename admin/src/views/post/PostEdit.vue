<template>
  <div class="post-edit-page" v-loading="loading">
    <template v-if="post">
      <section class="post-edit-hero">
        <div>
          <div class="post-edit-eyebrow">Post Editor</div>
          <h2 class="post-edit-title">
            {{ form.title || post.title || '(未命名文章)' }}
          </h2>
          <div class="post-edit-meta-line">
            <el-tag size="small">{{ post.languageCode }}</el-tag>
            <el-tag size="small" type="info">{{
              postTypeLabel(post.type)
            }}</el-tag>
            <el-tag size="small" :type="postStatusType(post.status)">
              {{ postStatusLabel(post.status) }}
            </el-tag>
            <el-tag
              size="small"
              :type="translationTagType(form.translationStatus)"
            >
              {{ form.translationStatus }}
            </el-tag>
            <span class="post-edit-meta-sub"
              >sourceId: {{ post.sourceId }}</span
            >
            <span class="post-edit-meta-sub"
              >group: {{ post.groupSourceId }}</span
            >
          </div>
        </div>
        <div class="post-edit-hero-actions">
          <el-button @click="router.back()">返回</el-button>
          <el-button type="primary" :loading="saving" @click="onSave"
            >保存草稿</el-button
          >
        </div>
      </section>

      <div class="post-edit-layout">
        <div class="post-edit-main">
          <el-tabs v-model="activeTab" class="post-edit-tabs">
            <el-tab-pane label="正文与元信息" name="main">
              <el-form
                :model="form"
                label-position="top"
                class="post-edit-form-grid"
              >
                <div class="post-edit-form-grid post-edit-form-grid--meta">
                  <el-form-item label="标题">
                    <el-input
                      v-model="form.title"
                      maxlength="512"
                      show-word-limit
                    />
                    <el-button
                      link
                      type="primary"
                      size="small"
                      :loading="translating.title"
                      @click="translateField('title')"
                    >
                      AI 翻译标题
                    </el-button>
                  </el-form-item>

                  <el-form-item label="摘要">
                    <el-input
                      v-model="form.excerpt"
                      type="textarea"
                      :rows="3"
                      maxlength="4000"
                      show-word-limit
                    />
                    <el-button
                      link
                      type="primary"
                      size="small"
                      :loading="translating.excerpt"
                      @click="translateField('excerpt')"
                    >
                      AI 翻译摘要
                    </el-button>
                  </el-form-item>

                  <el-form-item label="别名 alias">
                    <el-input v-model="form.alias" maxlength="128" />
                  </el-form-item>

                  <el-form-item label="发布时间">
                    <el-date-picker
                      v-model="form.date"
                      type="datetime"
                      value-format="YYYY-MM-DDTHH:mm:ssZ"
                    />
                  </el-form-item>

                  <el-form-item label="模板 template">
                    <el-input v-model="form.template" maxlength="128" />
                  </el-form-item>

                  <el-form-item label="翻译状态">
                    <el-select v-model="form.translationStatus">
                      <el-option
                        v-for="status in translationStatuses"
                        :key="status"
                        :label="status"
                        :value="status"
                      />
                    </el-select>
                  </el-form-item>
                </div>

                <el-form-item label="源码 code">
                  <el-input
                    v-model="form.code"
                    type="textarea"
                    :rows="6"
                    placeholder="保留原项目中的 code 字段，用于兼容特殊内容或嵌入片段。"
                  />
                </el-form-item>

                <el-form-item label="正文 HTML">
                  <RichEditor5
                    v-model="form.content"
                    :language-code="post.languageCode"
                  />
                  <div class="post-edit-inline-actions">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      :loading="translating.content"
                      @click="translateHtmlContent"
                    >
                      AI 翻译正文 HTML
                    </el-button>
                    <el-button
                      link
                      type="warning"
                      size="small"
                      :loading="translating.all"
                      @click="translateCoreFields"
                    >
                      一键翻译标题 / 摘要 / 正文
                    </el-button>
                  </div>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="基础关联" name="taxonomy">
              <el-alert
                type="warning"
                show-icon
                :closable="false"
                title="作者、分类、标签、地点和附件都属于共享实体，保存会影响当前语言下所有引用文章。"
                class="post-edit-alert"
              />
              <el-form
                :model="form"
                label-position="top"
                class="post-edit-form-grid post-edit-form-grid--taxonomy"
              >
                <el-form-item label="作者">
                  <EntityPicker
                    v-model="form.author"
                    type="author"
                    :language-code="post.languageCode"
                  />
                </el-form-item>
                <el-form-item label="分类">
                  <EntityPicker
                    v-model="form.sort"
                    type="sort"
                    :language-code="post.languageCode"
                  />
                </el-form-item>
                <el-form-item label="标签">
                  <EntityPicker
                    v-model="form.tags"
                    type="tag"
                    :language-code="post.languageCode"
                    multiple
                  />
                </el-form-item>
                <el-form-item label="地点">
                  <EntityPicker
                    v-model="form.mappointList"
                    type="mappoint"
                    :language-code="post.languageCode"
                    multiple
                  />
                </el-form-item>
                <el-form-item label="封面图" class="post-edit-span-2">
                  <AttachmentFieldPicker
                    v-model="form.coverImages"
                    :language-code="post.languageCode"
                    multiple
                  />
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="关联与推荐" name="related">
              <div class="post-edit-related-grid">
                <el-card shadow="never" class="post-edit-section-card">
                  <template #header>详情页推荐</template>
                  <el-form
                    :model="form"
                    label-position="top"
                    class="post-edit-form-grid post-edit-form-grid--taxonomy"
                  >
                    <el-form-item
                      v-for="def in recommendFields"
                      :key="def.key"
                      :label="def.label"
                    >
                      <EntityPicker
                        v-if="def.kind === 'entity'"
                        v-model="form[def.key]"
                        :type="def.type"
                        :language-code="post.languageCode"
                        multiple
                      />
                      <PostReferencePicker
                        v-else
                        v-model="form[def.key]"
                        :post-type="def.postType"
                        :language-code="post.languageCode"
                        multiple
                      />
                    </el-form-item>
                    <el-form-item label="推荐系列标识" class="post-edit-span-2">
                      <StringArrayEditor
                        v-model="form.seriesSortList"
                        placeholder="输入 seriesSortList，回车确认"
                      />
                    </el-form-item>
                  </el-form>
                </el-card>

                <el-card shadow="never" class="post-edit-section-card">
                  <template #header>正文内强相关</template>
                  <el-form
                    :model="form"
                    label-position="top"
                    class="post-edit-form-grid post-edit-form-grid--taxonomy"
                  >
                    <el-form-item
                      v-for="def in contentRelatedFields"
                      :key="def.key"
                      :label="def.label"
                    >
                      <EntityPicker
                        v-if="def.kind === 'entity'"
                        v-model="form[def.key]"
                        :type="def.type"
                        :language-code="post.languageCode"
                        multiple
                      />
                      <PostReferencePicker
                        v-else
                        v-model="form[def.key]"
                        :post-type="def.postType"
                        :language-code="post.languageCode"
                        multiple
                      />
                    </el-form-item>
                    <el-form-item label="正文系列标识" class="post-edit-span-2">
                      <StringArrayEditor
                        v-model="form.contentSeriesSortList"
                        placeholder="输入 contentSeriesSortList，回车确认"
                      />
                    </el-form-item>
                  </el-form>
                </el-card>
              </div>
            </el-tab-pane>

            <el-tab-pane label="发布校验" name="publish">
              <PublishValidatePanel
                :post-id="post._id"
                :initial-state="validationInitial"
                @status-change="onPublishStatusChange"
              />
            </el-tab-pane>

            <el-tab-pane label="原文快照" name="source">
              <div class="post-edit-source-grid">
                <el-card shadow="never" class="post-edit-section-card">
                  <template #header>导入与发布元信息</template>
                  <el-descriptions :column="1" size="small" border>
                    <el-descriptions-item label="sourceId">{{
                      post.sourceId
                    }}</el-descriptions-item>
                    <el-descriptions-item label="groupSourceId">{{
                      post.groupSourceId
                    }}</el-descriptions-item>
                    <el-descriptions-item label="sourceHash">{{
                      post.sourceHash
                    }}</el-descriptions-item>
                    <el-descriptions-item label="最近导入">
                      {{
                        formatTime(post.importMeta?.lastImportedAt) || '暂无'
                      }}
                    </el-descriptions-item>
                    <el-descriptions-item label="发布时间">
                      {{
                        formatTime(post.publishMeta?.publishedAt) || '未发布'
                      }}
                    </el-descriptions-item>
                    <el-descriptions-item label="最后更新时间">
                      {{ formatTime(post.updatedAt) }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>

                <el-card shadow="never" class="post-edit-section-card">
                  <template #header>原始快照 JSON</template>
                  <pre class="post-edit-snapshot">{{ snapshotText }}</pre>
                </el-card>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <aside class="post-edit-side">
          <el-card shadow="never" class="post-edit-side-card">
            <template #header>当前版本概览</template>
            <div class="post-edit-side-list">
              <div>语言：{{ post.languageCode }}</div>
              <div>类型：{{ postTypeLabel(post.type) }}</div>
              <div>状态：{{ postStatusLabel(post.status) }}</div>
              <div>alias：{{ form.alias || '未设置' }}</div>
              <div>editorVersion：{{ post.editorVersion || 5 }}</div>
            </div>
          </el-card>

          <el-card shadow="never" class="post-edit-side-card">
            <template #header>关联规模</template>
            <div class="post-edit-side-list">
              <div>标签：{{ form.tags.length }}</div>
              <div>地点：{{ form.mappointList.length }}</div>
              <div>封面：{{ form.coverImages.length }}</div>
              <div>详情页推荐：{{ detailReferenceCount }}</div>
              <div>正文内关联：{{ contentReferenceCount }}</div>
            </div>
          </el-card>

          <el-card shadow="never" class="post-edit-side-card">
            <template #header>快速操作</template>
            <div class="post-edit-side-actions">
              <el-button
                type="primary"
                plain
                :loading="translating.all"
                @click="translateCoreFields"
              >
                一键翻译核心字段
              </el-button>
              <el-button @click="activeTab = 'publish'">查看发布校验</el-button>
              <el-button @click="activeTab = 'source'">查看原文快照</el-button>
            </div>
          </el-card>
        </aside>
      </div>
    </template>

    <el-empty v-else-if="!loading" description="文章不存在" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getPostApi, updatePostApi } from '@/api/post'
import { translateHtmlApi, translateTextApi } from '@/api/translation'
import AttachmentFieldPicker from '@/components/AttachmentFieldPicker.vue'
import EntityPicker from '@/components/EntityPicker.vue'
import PostReferencePicker from '@/components/PostReferencePicker.vue'
import PublishValidatePanel from '@/components/PublishValidatePanel.vue'
import RichEditor5 from '@/components/RichEditor5.vue'
import StringArrayEditor from '@/components/StringArrayEditor.vue'

const route = useRoute()
const router = useRouter()

const TRANSLATION_STATUSES = [
  'pending',
  'ai_draft',
  'manual_draft',
  'approved',
  'not_required',
  'stub',
  'outdated'
]

const RECOMMEND_FIELDS = [
  { key: 'bangumiList', label: '推荐番剧', type: 'bangumi', kind: 'entity' },
  { key: 'movieList', label: '推荐电影', type: 'movie', kind: 'entity' },
  { key: 'gameList', label: '推荐游戏', type: 'game', kind: 'entity' },
  { key: 'bookList', label: '推荐书籍', type: 'book', kind: 'entity' },
  { key: 'eventList', label: '推荐活动', type: 'event', kind: 'entity' },
  { key: 'voteList', label: '推荐投票', type: 'vote', kind: 'entity' },
  { key: 'postList', label: '推荐文章', kind: 'post', postType: 1 },
  { key: 'tweetList', label: '推荐推文', kind: 'post', postType: 2 }
]

const CONTENT_RELATED_FIELDS = [
  {
    key: 'contentBangumiList',
    label: '正文番剧',
    type: 'bangumi',
    kind: 'entity'
  },
  { key: 'contentMovieList', label: '正文电影', type: 'movie', kind: 'entity' },
  { key: 'contentGameList', label: '正文游戏', type: 'game', kind: 'entity' },
  { key: 'contentBookList', label: '正文书籍', type: 'book', kind: 'entity' },
  { key: 'contentEventList', label: '正文活动', type: 'event', kind: 'entity' },
  { key: 'contentVoteList', label: '正文投票', type: 'vote', kind: 'entity' },
  { key: 'contentPostList', label: '正文文章', kind: 'post', postType: 1 },
  { key: 'contentTweetList', label: '正文推文', kind: 'post', postType: 2 }
]

const EDITABLE_KEYS = [
  'title',
  'excerpt',
  'content',
  'alias',
  'date',
  'template',
  'code',
  'translationStatus',
  'author',
  'sort',
  'tags',
  'mappointList',
  'coverImages',
  'bangumiList',
  'movieList',
  'gameList',
  'bookList',
  'postList',
  'tweetList',
  'eventList',
  'voteList',
  'seriesSortList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentPostList',
  'contentTweetList',
  'contentEventList',
  'contentVoteList',
  'contentSeriesSortList'
]

const loading = ref(false)
const saving = ref(false)
const post = ref(null)
const activeTab = ref('main')
const translating = reactive({
  title: false,
  excerpt: false,
  content: false,
  all: false
})
const form = reactive({
  title: '',
  excerpt: '',
  content: '',
  alias: '',
  date: null,
  template: '',
  code: '',
  translationStatus: 'pending',
  author: null,
  sort: null,
  tags: [],
  mappointList: [],
  coverImages: [],
  bangumiList: [],
  movieList: [],
  gameList: [],
  bookList: [],
  postList: [],
  tweetList: [],
  eventList: [],
  voteList: [],
  seriesSortList: [],
  contentBangumiList: [],
  contentMovieList: [],
  contentGameList: [],
  contentBookList: [],
  contentPostList: [],
  contentTweetList: [],
  contentEventList: [],
  contentVoteList: [],
  contentSeriesSortList: []
})

const validationInitial = computed(() => ({
  passed: post.value?.validationState?.passed || false,
  issues: post.value?.validationState?.issues || [],
  checkedAt: post.value?.validationState?.checkedAt || null
}))

const snapshotText = computed(() => {
  if (!post.value?.sourceSnapshot) return '(无快照)'
  return JSON.stringify(post.value.sourceSnapshot, null, 2)
})

const detailReferenceCount = computed(() => {
  return (
    form.bangumiList.length +
    form.movieList.length +
    form.gameList.length +
    form.bookList.length +
    form.postList.length +
    form.tweetList.length +
    form.eventList.length +
    form.voteList.length +
    form.seriesSortList.length
  )
})

const contentReferenceCount = computed(() => {
  return (
    form.contentBangumiList.length +
    form.contentMovieList.length +
    form.contentGameList.length +
    form.contentBookList.length +
    form.contentPostList.length +
    form.contentTweetList.length +
    form.contentEventList.length +
    form.contentVoteList.length +
    form.contentSeriesSortList.length
  )
})

function translationTagType(status) {
  if (status === 'approved' || status === 'not_required') return 'success'
  if (status === 'ai_draft' || status === 'manual_draft') return 'warning'
  if (status === 'outdated') return 'danger'
  return 'info'
}

function postTypeLabel(type) {
  if (type === 1) return '博文'
  if (type === 2) return '推文'
  return '未知'
}

function postStatusType(status) {
  if (status === 1) return 'success'
  if (status === 99) return 'info'
  return 'warning'
}

function postStatusLabel(status) {
  if (status === 1) return '已发布'
  if (status === 99) return '回收站'
  return '草稿'
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (_) {
    return String(value)
  }
}

function pickId(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  return value._id || null
}

function pickIds(value) {
  if (!Array.isArray(value)) return []
  return value.map(pickId).filter(Boolean)
}

function pickStrings(value) {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'string' && item)
}

async function load() {
  loading.value = true
  try {
    const resp = await getPostApi(route.params.id)
    post.value = resp && resp.data ? resp.data : null
    if (!post.value) return
    form.title = post.value.title || ''
    form.excerpt = post.value.excerpt || ''
    form.content = post.value.content || ''
    form.alias = post.value.alias || ''
    form.date = post.value.date || null
    form.template = post.value.template || ''
    form.code = post.value.code || ''
    form.translationStatus = post.value.translationStatus || 'pending'
    form.author = pickId(post.value.author)
    form.sort = pickId(post.value.sort)
    form.tags = pickIds(post.value.tags)
    form.mappointList = pickIds(post.value.mappointList)
    form.coverImages = pickIds(post.value.coverImages)
    form.bangumiList = pickIds(post.value.bangumiList)
    form.movieList = pickIds(post.value.movieList)
    form.gameList = pickIds(post.value.gameList)
    form.bookList = pickIds(post.value.bookList)
    form.postList = pickIds(post.value.postList)
    form.tweetList = pickIds(post.value.tweetList)
    form.eventList = pickIds(post.value.eventList)
    form.voteList = pickIds(post.value.voteList)
    form.seriesSortList = pickStrings(post.value.seriesSortList)
    form.contentBangumiList = pickIds(post.value.contentBangumiList)
    form.contentMovieList = pickIds(post.value.contentMovieList)
    form.contentGameList = pickIds(post.value.contentGameList)
    form.contentBookList = pickIds(post.value.contentBookList)
    form.contentPostList = pickIds(post.value.contentPostList)
    form.contentTweetList = pickIds(post.value.contentTweetList)
    form.contentEventList = pickIds(post.value.contentEventList)
    form.contentVoteList = pickIds(post.value.contentVoteList)
    form.contentSeriesSortList = pickStrings(post.value.contentSeriesSortList)
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!post.value) return
  saving.value = true
  try {
    const patch = { _id: post.value._id }
    EDITABLE_KEYS.forEach(key => {
      patch[key] = form[key]
    })
    await updatePostApi(patch)
    ElMessage.success('已保存')
    await load()
  } finally {
    saving.value = false
  }
}

async function translateField(field) {
  if (!post.value) return
  const text = form[field]
  if (!text) {
    ElMessage.warning('内容为空')
    return
  }
  translating[field] = true
  try {
    const resp = await translateTextApi({
      sourceText: text,
      targetLanguageCode: post.value.languageCode,
      fieldKind: 'shortText',
      entityType: 'post',
      entityId: post.value._id,
      fieldPath: field
    })
    const translated = (resp && resp.data && resp.data.translatedText) || ''
    if (translated) {
      form[field] = translated
      ElMessage.success('已填入 AI 翻译结果，请人工复核后保存')
    }
  } finally {
    translating[field] = false
  }
}

async function translateHtmlContent() {
  if (!post.value) return
  if (!form.content) {
    ElMessage.warning('正文为空')
    return
  }
  translating.content = true
  try {
    const resp = await translateHtmlApi({
      sourceHtml: form.content,
      targetLanguageCode: post.value.languageCode,
      entityType: 'post',
      entityId: post.value._id,
      fieldPath: 'content'
    })
    const translated = (resp && resp.data && resp.data.translatedHtml) || ''
    if (translated) {
      form.content = translated
      ElMessage.success('已替换正文，请人工复核后保存')
    }
  } finally {
    translating.content = false
  }
}

async function translateCoreFields() {
  translating.all = true
  try {
    if (form.title) {
      await translateField('title')
    }
    if (form.excerpt) {
      await translateField('excerpt')
    }
    if (form.content) {
      await translateHtmlContent()
    }
  } finally {
    translating.all = false
  }
}

function onPublishStatusChange() {
  load()
}

onMounted(load)
</script>

<style scoped>
.post-edit-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.post-edit-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #f4f8ff 100%);
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.post-edit-eyebrow {
  color: #667791;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  margin-bottom: 8px;
}

.post-edit-title {
  margin: 0;
  color: #172033;
  font-size: 30px;
}

.post-edit-meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.post-edit-meta-sub {
  color: #6b7b95;
  font-size: 12px;
}

.post-edit-hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.post-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.post-edit-main,
.post-edit-side {
  min-width: 0;
}

.post-edit-main :deep(.el-tabs__nav-wrap) {
  padding: 0 12px;
}

.post-edit-form-grid {
  display: grid;
  gap: 16px;
}

.post-edit-form-grid--meta,
.post-edit-form-grid--taxonomy {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.post-edit-span-2 {
  grid-column: 1 / -1;
}

.post-edit-inline-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.post-edit-alert {
  margin-bottom: 16px;
}

.post-edit-related-grid,
.post-edit-source-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.post-edit-section-card,
.post-edit-side-card {
  border-radius: 22px;
}

.post-edit-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.post-edit-side-list {
  display: grid;
  gap: 10px;
  color: #5f6f89;
  font-size: 13px;
}

.post-edit-side-actions {
  display: grid;
  gap: 10px;
}

.post-edit-snapshot {
  max-height: 520px;
  overflow: auto;
  background: #f6f8fc;
  border-radius: 16px;
  padding: 14px;
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 1200px) {
  .post-edit-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .post-edit-hero {
    flex-direction: column;
    padding: 20px;
  }

  .post-edit-title {
    font-size: 26px;
  }

  .post-edit-form-grid--meta,
  .post-edit-form-grid--taxonomy {
    grid-template-columns: 1fr;
  }
}
</style>
