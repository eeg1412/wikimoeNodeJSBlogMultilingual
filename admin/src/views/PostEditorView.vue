<template>
  <div class="page-stack" v-if="form">
    <el-card>
      <div class="editor-header">
        <div>
          <div class="editor-title">{{ form.title || '未命名文章' }}</div>
          <div class="editor-meta">
            sourceId: {{ form.sourceId }} | languageCode: {{ form.languageCode }}
          </div>
        </div>
        <div class="editor-actions">
          <el-button @click="router.back()">返回</el-button>
          <el-button type="primary" @click="save">保存</el-button>
          <el-button type="warning" @click="translateAll">一键翻译</el-button>
          <el-button type="success" @click="publish">发布</el-button>
          <el-button type="info" @click="unpublish">撤回发布</el-button>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>基本信息</template>
      <el-form label-position="top" class="editor-grid">
        <el-form-item label="标题">
          <div class="field-with-actions">
            <el-input v-model="form.title" />
            <el-button @click="translateField('title')">翻译标题</el-button>
          </div>
        </el-form-item>
        <el-form-item label="摘要">
          <div class="field-with-actions">
            <el-input v-model="form.excerpt" type="textarea" :rows="4" />
            <el-button @click="translateField('excerpt')">翻译摘要</el-button>
          </div>
        </el-form-item>
        <el-form-item label="Alias">
          <el-input v-model="form.alias" />
        </el-form-item>
        <el-form-item label="文章类型">
          <el-select v-model="form.type" disabled>
            <el-option label="文章" :value="1" />
            <el-option label="推文" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="草稿" :value="0" />
            <el-option label="已发布" :value="1" />
            <el-option label="回收站" :value="99" />
          </el-select>
        </el-form-item>
        <el-form-item label="翻译状态">
          <el-select v-model="form.translationStatus">
            <el-option
              v-for="item in translationStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="发布时间">
          <el-date-picker
            v-model="form.date"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            class="w_10"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="section-header">
          <span>富文本正文</span>
          <el-button @click="translateContent">翻译正文</el-button>
        </div>
      </template>
      <MultilingualRichEditor v-model="form.content" />
    </el-card>

    <el-card>
      <template #header>共享实体与引用</template>
      <div class="relation-grid relation-grid--single">
        <div v-for="field in singleRelationFields" :key="field.key">
          <div class="relation-label">{{ field.label }}</div>
          <el-select
            v-model="form[field.key]"
            value-key="_id"
            filterable
            remote
            clearable
            class="w_10"
            :remote-method="keyword => fetchEntityOptions(field.entityType, keyword)"
          >
            <el-option
              v-for="item in entityOptions[field.entityType]"
              :key="item._id"
              :label="getEntityLabel(field.entityType, item)"
              :value="item"
            />
          </el-select>
        </div>
      </div>

      <div class="relation-grid mt20">
        <div v-for="field in multiRelationFields" :key="field.key">
          <div class="relation-label">{{ field.label }}</div>
          <el-select
            v-model="form[field.key]"
            value-key="_id"
            multiple
            filterable
            remote
            collapse-tags
            collapse-tags-tooltip
            class="w_10"
            :remote-method="keyword => fetchEntityOptions(field.entityType, keyword)"
          >
            <el-option
              v-for="item in entityOptions[field.entityType]"
              :key="item._id"
              :label="getEntityLabel(field.entityType, item)"
              :value="item"
            />
          </el-select>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>封面与本地化附件</template>
      <div class="cover-tags">
        <el-tag
          v-for="item in form.coverImages"
          :key="item._id"
          class="mr10 mb10"
          closable
          @close="removeCover(item._id)"
        >
          {{ getEntityLabel('attachment', item) || item.filename || item._id }}
        </el-tag>
      </div>
      <div class="relation-label mt20">上传当前语言本地化附件</div>
      <el-form label-position="top" class="editor-grid">
        <el-form-item label="attachmentGroupKey">
          <el-input
            v-model="uploadForm.attachmentGroupKey"
            placeholder="建议使用原远程附件的 group key 或 sourceId"
          />
        </el-form-item>
        <el-form-item label="附件名称">
          <el-input v-model="uploadForm.name" />
        </el-form-item>
        <el-form-item label="附件描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="onFileChange"
            :show-file-list="true"
          >
            <el-button>选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="uploadLocalizedAttachment">上传并加入封面</el-button>
    </el-card>

    <el-card>
      <template #header>发布校验</template>
      <el-alert
        v-if="validationMessages.length === 0"
        type="success"
        show-icon
        title="当前没有发现明显阻塞项。正式发布前仍建议保存一次并执行发布校验。"
      />
      <ul v-else class="validation-list">
        <li v-for="message in validationMessages" :key="message">{{ message }}</li>
      </ul>
    </el-card>

    <el-card>
      <template #header>原文快照</template>
      <el-input :model-value="sourceSnapshotText" type="textarea" :rows="14" readonly />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/api'
import MultilingualRichEditor from '@/components/MultilingualRichEditor.vue'
import {
  ENTITY_META,
  TRANSLATION_STATUS_OPTIONS,
  getEntityLabel
} from '@/constants/entities'

const route = useRoute()
const router = useRouter()
const form = ref(null)
const translationStatusOptions = TRANSLATION_STATUS_OPTIONS
const entityOptions = reactive(
  [...Object.keys(ENTITY_META), 'post'].reduce((result, key) => {
    result[key] = []
    return result
  }, {})
)
const uploadForm = reactive({
  attachmentGroupKey: '',
  description: '',
  file: null,
  name: ''
})

const singleRelationFields = [
  { key: 'author', entityType: 'author', label: '作者' },
  { key: 'sort', entityType: 'sort', label: '分类' }
]

const multiRelationFields = [
  { key: 'coverImages', entityType: 'attachment', label: '封面图 / 媒体' },
  { key: 'tags', entityType: 'tag', label: '标签' },
  { key: 'mappointList', entityType: 'mappoint', label: '地点' },
  { key: 'bangumiList', entityType: 'bangumi', label: '详情页 Bangumi' },
  { key: 'movieList', entityType: 'movie', label: '详情页 Movie' },
  { key: 'gameList', entityType: 'game', label: '详情页 Game' },
  { key: 'bookList', entityType: 'book', label: '详情页 Book' },
  { key: 'eventList', entityType: 'event', label: '详情页 Event' },
  { key: 'voteList', entityType: 'vote', label: '详情页 Vote' },
  { key: 'contentBangumiList', entityType: 'bangumi', label: '正文内 Bangumi' },
  { key: 'contentMovieList', entityType: 'movie', label: '正文内 Movie' },
  { key: 'contentGameList', entityType: 'game', label: '正文内 Game' },
  { key: 'contentBookList', entityType: 'book', label: '正文内 Book' },
  { key: 'contentEventList', entityType: 'event', label: '正文内 Event' },
  { key: 'contentVoteList', entityType: 'vote', label: '正文内 Vote' },
  { key: 'postList', entityType: 'post', label: '详情页相关文章' },
  { key: 'tweetList', entityType: 'post', label: '详情页关联推文' },
  { key: 'contentPostList', entityType: 'post', label: '正文内相关文章' },
  { key: 'contentTweetList', entityType: 'post', label: '正文内关联推文' }
]

function mergeEntityOptions(entityType, items) {
  const currentMap = new Map(entityOptions[entityType].map(item => [item._id, item]))
  for (const item of items || []) {
    currentMap.set(item._id, item)
  }
  entityOptions[entityType] = Array.from(currentMap.values())
}

function seedEntityOptionsFromPost(post) {
  singleRelationFields.forEach(field => {
    if (post[field.key]) {
      mergeEntityOptions(field.entityType, [post[field.key]])
    }
  })
  multiRelationFields.forEach(field => {
    mergeEntityOptions(field.entityType, post[field.key] || [])
  })
}

async function fetchEntityOptions(entityType, keyword = '') {
  const params = {
    keyword,
    page: 1,
    limit: 20,
    languageCode: form.value?.languageCode || undefined
  }

  if (entityType === 'post') {
    const result = await authApi.getPostList(params)
    mergeEntityOptions(entityType, result.list)
    return
  }

  const result = await authApi.getEntityList(entityType, params)
  mergeEntityOptions(entityType, result.list)
}

async function loadPost() {
  const detail = await authApi.getPostDetail(route.params.id)
  form.value = {
    ...detail,
    status: detail.status ?? 0,
    tags: detail.tags || [],
    mappointList: detail.mappointList || [],
    coverImages: detail.coverImages || [],
    bangumiList: detail.bangumiList || [],
    movieList: detail.movieList || [],
    gameList: detail.gameList || [],
    bookList: detail.bookList || [],
    postList: detail.postList || [],
    tweetList: detail.tweetList || [],
    eventList: detail.eventList || [],
    voteList: detail.voteList || [],
    contentBangumiList: detail.contentBangumiList || [],
    contentMovieList: detail.contentMovieList || [],
    contentGameList: detail.contentGameList || [],
    contentBookList: detail.contentBookList || [],
    contentPostList: detail.contentPostList || [],
    contentTweetList: detail.contentTweetList || [],
    contentEventList: detail.contentEventList || [],
    contentVoteList: detail.contentVoteList || [],
    seriesSortList: detail.seriesSortList || [],
    contentSeriesSortList: detail.contentSeriesSortList || []
  }
  seedEntityOptionsFromPost(form.value)
  uploadForm.attachmentGroupKey =
    form.value.coverImages?.[0]?.attachmentGroupKey ||
    form.value.coverImages?.[0]?.sourceId ||
    uploadForm.attachmentGroupKey
}

function toRelation(value) {
  return value?._id ? { _id: value._id } : null
}

function toRelationList(list) {
  return (list || []).map(item => ({ _id: item._id }))
}

async function save() {
  try {
    const payload = {
      id: form.value._id,
      title: form.value.title,
      excerpt: form.value.excerpt,
      content: form.value.content,
      alias: form.value.alias,
      date: form.value.date,
      lastChangDate: form.value.lastChangDate,
      status: form.value.status,
      translationStatus: form.value.translationStatus,
      author: toRelation(form.value.author),
      sort: toRelation(form.value.sort),
      tags: toRelationList(form.value.tags),
      mappointList: toRelationList(form.value.mappointList),
      coverImages: toRelationList(form.value.coverImages),
      bangumiList: toRelationList(form.value.bangumiList),
      movieList: toRelationList(form.value.movieList),
      gameList: toRelationList(form.value.gameList),
      bookList: toRelationList(form.value.bookList),
      postList: toRelationList(form.value.postList),
      tweetList: toRelationList(form.value.tweetList),
      eventList: toRelationList(form.value.eventList),
      voteList: toRelationList(form.value.voteList),
      seriesSortList: form.value.seriesSortList || [],
      contentBangumiList: toRelationList(form.value.contentBangumiList),
      contentMovieList: toRelationList(form.value.contentMovieList),
      contentGameList: toRelationList(form.value.contentGameList),
      contentBookList: toRelationList(form.value.contentBookList),
      contentPostList: toRelationList(form.value.contentPostList),
      contentTweetList: toRelationList(form.value.contentTweetList),
      contentEventList: toRelationList(form.value.contentEventList),
      contentVoteList: toRelationList(form.value.contentVoteList),
      contentSeriesSortList: form.value.contentSeriesSortList || [],
      validationState: form.value.validationState || {},
      publishMeta: form.value.publishMeta || {}
    }
    await authApi.updatePost(payload)
    ElMessage.success('保存成功')
    await loadPost()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function translateField(fieldPath) {
  try {
    const result = await authApi.translateField({
      entityType: 'post',
      entityId: form.value._id,
      fieldPath,
      languageCode: form.value.languageCode,
      sourceText: form.value[fieldPath]
    })
    form.value[fieldPath] = result.translatedText
    form.value.translationStatus = 'ai_draft'
    ElMessage.success(`${fieldPath} 翻译完成`)
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function translateContent() {
  try {
    const result = await authApi.translateHtml({
      entityType: 'post',
      entityId: form.value._id,
      fieldPath: 'content',
      languageCode: form.value.languageCode,
      html: form.value.content
    })
    form.value.content = result.translatedHtml
    form.value.translationStatus = 'ai_draft'
    ElMessage.success('正文翻译完成')
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function translateAll() {
  try {
    await authApi.translateAll({
      entityType: 'post',
      entityId: form.value._id,
      fieldPaths: ['title', 'excerpt', 'content'],
      languageCode: form.value.languageCode
    })
    await loadPost()
    ElMessage.success('一键翻译完成')
  } catch (error) {
    ElMessage.error(error.message)
  }
}

async function publish() {
  try {
    await authApi.publishPost(form.value._id)
    ElMessage.success('发布成功')
    await loadPost()
  } catch (error) {
    ElMessage.error(error.message)
    await loadPost()
  }
}

async function unpublish() {
  try {
    await authApi.unpublishPost(form.value._id)
    ElMessage.success('已撤回发布')
    await loadPost()
  } catch (error) {
    ElMessage.error(error.message)
  }
}

function onFileChange(file) {
  uploadForm.file = file.raw
}

async function uploadLocalizedAttachment() {
  if (!uploadForm.file) {
    ElMessage.error('请先选择上传文件')
    return
  }
  if (!uploadForm.attachmentGroupKey) {
    ElMessage.error('attachmentGroupKey 不能为空')
    return
  }

  try {
    const payload = new FormData()
    payload.append('attachmentGroupKey', uploadForm.attachmentGroupKey)
    payload.append('languageCode', form.value.languageCode)
    payload.append('name', uploadForm.name)
    payload.append('description', uploadForm.description)
    payload.append('file', uploadForm.file)
    const attachment = await authApi.uploadLocalizedAttachment(payload)
    mergeEntityOptions('attachment', [attachment])
    form.value.coverImages = [...form.value.coverImages, attachment]
    uploadForm.file = null
    ElMessage.success('本地化附件上传成功，已加入封面引用')
  } catch (error) {
    ElMessage.error(error.message)
  }
}

function removeCover(id) {
  form.value.coverImages = form.value.coverImages.filter(item => item._id !== id)
}

const sourceSnapshotText = computed(() =>
  JSON.stringify(form.value?.sourceSnapshot || {}, null, 2)
)

const validationMessages = computed(() => {
  const messages = [...(form.value?.validationState?.errors || [])]
  const translationReady = ['approved', 'not_required']

  if (form.value?.author && !translationReady.includes(form.value.author.translationStatus)) {
    messages.push('作者尚未完成翻译确认')
  }
  if (form.value?.sort && !translationReady.includes(form.value.sort.translationStatus)) {
    messages.push('分类尚未完成翻译确认')
  }

  for (const field of [
    'tags',
    'mappointList',
    'coverImages',
    'bangumiList',
    'movieList',
    'gameList',
    'bookList',
    'eventList',
    'voteList',
    'contentBangumiList',
    'contentMovieList',
    'contentGameList',
    'contentBookList',
    'contentEventList',
    'contentVoteList'
  ]) {
    for (const item of form.value?.[field] || []) {
      if (!translationReady.includes(item.translationStatus)) {
        messages.push(
          `${field} 中存在未确认翻译项：${getEntityLabel('attachment', item) || item.title || item._id}`
        )
      }
    }
  }

  for (const relationField of ['postList', 'tweetList', 'contentPostList', 'contentTweetList']) {
    for (const item of form.value?.[relationField] || []) {
      if (item.translationStatus === 'stub') {
        messages.push(`${relationField} 中存在 stub：${item.title || item.sourceId}`)
      }
    }
  }

  return Array.from(new Set(messages))
})

onMounted(loadPost)
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.editor-title {
  font-size: 28px;
  font-weight: 700;
}

.editor-meta {
  color: var(--el-text-color-secondary);
  margin-top: 6px;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}

.field-with-actions {
  display: grid;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.relation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.relation-grid--single {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.relation-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.cover-tags {
  display: flex;
  flex-wrap: wrap;
}

.validation-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
}

@media (max-width: 900px) {
  .editor-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>