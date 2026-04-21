<template>
  <div class="post-edit-page" v-loading="loading">
    <div v-if="post" class="post-edit-page-body">
      <div class="post-edit-page-header">
        <div class="post-edit-page-header-left">
          <el-tag size="small">{{ post.languageCode }}</el-tag>
          <el-tag size="small" type="info">
            {{ post.type === 1 ? '博文' : '推文' }}
          </el-tag>
          <el-tag
            size="small"
            :type="post.status === 1 ? 'success' : 'warning'"
          >
            {{
              post.status === 1
                ? '已发布'
                : post.status === 99
                  ? '回收站'
                  : '草稿'
            }}
          </el-tag>
          <el-tag
            size="small"
            :type="translationTagType(form.translationStatus)"
          >
            {{ form.translationStatus }}
          </el-tag>
          <span class="post-edit-page-sub">sourceId: {{ post.sourceId }}</span>
        </div>
        <div class="post-edit-page-header-right">
          <el-button @click="$router.back()">返回</el-button>
          <el-button type="primary" :loading="saving" @click="onSave"
            >保存草稿</el-button
          >
        </div>
      </div>

      <el-tabs v-model="activeTab" class="post-edit-page-tabs">
        <el-tab-pane label="正文与元信息" name="main">
          <el-form :model="form" label-width="100px" class="post-edit-form">
            <el-form-item label="标题">
              <el-input v-model="form.title" maxlength="512" show-word-limit />
              <el-button
                link
                type="primary"
                size="small"
                style="margin-top: 4px"
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
                style="margin-top: 4px"
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
            <el-form-item label="翻译状态">
              <el-select v-model="form.translationStatus">
                <el-option
                  v-for="s in translationStatuses"
                  :key="s"
                  :label="s"
                  :value="s"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="正文">
              <RichEditor5
                v-model="form.content"
                :language-code="post.languageCode"
              />
              <el-button
                link
                type="primary"
                size="small"
                style="margin-top: 4px"
                :loading="translating.content"
                @click="translateHtmlContent"
              >
                AI 翻译正文 HTML
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="关联与推荐" name="refs">
          <el-form :model="form" label-width="120px" class="post-edit-form">
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
            <el-form-item label="封面图">
              <AttachmentFieldPicker
                v-model="form.coverImages"
                :language-code="post.languageCode"
                multiple
              />
            </el-form-item>

            <el-divider>正文内强相关</el-divider>
            <el-form-item
              v-for="def in contentRelatedFields"
              :key="def.key"
              :label="def.label"
            >
              <EntityPicker
                v-model="form[def.key]"
                :type="def.type"
                :language-code="post.languageCode"
                multiple
              />
            </el-form-item>

            <el-divider>详情页下方推荐</el-divider>
            <el-form-item
              v-for="def in recommendFields"
              :key="def.key"
              :label="def.label"
            >
              <EntityPicker
                v-model="form[def.key]"
                :type="def.type"
                :language-code="post.languageCode"
                multiple
              />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="发布校验" name="publish">
          <PublishValidatePanel
            :post-id="post._id"
            :initial-state="validationInitial"
            @status-change="onPublishStatusChange"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
    <el-empty v-else-if="!loading" description="文章不存在" />
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getPostApi, updatePostApi } from '@/api/post'
import { translateTextApi, translateHtmlApi } from '@/api/translation'
import RichEditor5 from '@/components/RichEditor5.vue'
import PublishValidatePanel from '@/components/PublishValidatePanel.vue'
import EntityPicker from '@/components/EntityPicker.vue'
import AttachmentFieldPicker from '@/components/AttachmentFieldPicker.vue'

const TRANSLATION_STATUSES = [
  'pending',
  'ai_draft',
  'manual_draft',
  'approved',
  'not_required',
  'stub',
  'outdated'
]
const TRANSLATION_TAG_TYPE = {
  approved: 'success',
  not_required: 'success',
  ai_draft: 'warning',
  manual_draft: 'warning',
  outdated: 'danger',
  pending: 'info',
  stub: 'info'
}

const CONTENT_RELATED_FIELDS = [
  { key: 'contentBangumiList', label: '正文番剧', type: 'bangumi' },
  { key: 'contentMovieList', label: '正文电影', type: 'movie' },
  { key: 'contentGameList', label: '正文游戏', type: 'game' },
  { key: 'contentBookList', label: '正文书籍', type: 'book' },
  { key: 'contentEventList', label: '正文活动', type: 'event' },
  { key: 'contentVoteList', label: '正文投票', type: 'vote' }
]
const RECOMMEND_FIELDS = [
  { key: 'bangumiList', label: '推荐番剧', type: 'bangumi' },
  { key: 'movieList', label: '推荐电影', type: 'movie' },
  { key: 'gameList', label: '推荐游戏', type: 'game' },
  { key: 'bookList', label: '推荐书籍', type: 'book' },
  { key: 'eventList', label: '推荐活动', type: 'event' },
  { key: 'voteList', label: '推荐投票', type: 'vote' }
]

const EDITABLE_KEYS = [
  'title',
  'excerpt',
  'content',
  'alias',
  'date',
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
  'eventList',
  'voteList',
  'contentBangumiList',
  'contentMovieList',
  'contentGameList',
  'contentBookList',
  'contentEventList',
  'contentVoteList'
]

export default {
  name: 'PostEdit',
  components: {
    RichEditor5,
    PublishValidatePanel,
    EntityPicker,
    AttachmentFieldPicker
  },
  setup() {
    const route = useRoute()
    const loading = ref(false)
    const saving = ref(false)
    const post = ref(null)
    const activeTab = ref('main')
    const translating = reactive({
      title: false,
      excerpt: false,
      content: false
    })
    const form = reactive({
      title: '',
      excerpt: '',
      content: '',
      alias: '',
      date: null,
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
      eventList: [],
      voteList: [],
      contentBangumiList: [],
      contentMovieList: [],
      contentGameList: [],
      contentBookList: [],
      contentEventList: [],
      contentVoteList: []
    })

    const validationInitial = computed(() => ({
      passed: post.value?.validationState?.passed || false,
      issues: post.value?.validationState?.issues || [],
      checkedAt: post.value?.validationState?.checkedAt || null
    }))

    function translationTagType(s) {
      return TRANSLATION_TAG_TYPE[s] || 'info'
    }

    function pickId(v) {
      if (!v) return null
      if (typeof v === 'string') return v
      return v._id || null
    }
    function pickIds(arr) {
      if (!Array.isArray(arr)) return []
      return arr.map(pickId).filter(Boolean)
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
        form.eventList = pickIds(post.value.eventList)
        form.voteList = pickIds(post.value.voteList)
        form.contentBangumiList = pickIds(post.value.contentBangumiList)
        form.contentMovieList = pickIds(post.value.contentMovieList)
        form.contentGameList = pickIds(post.value.contentGameList)
        form.contentBookList = pickIds(post.value.contentBookList)
        form.contentEventList = pickIds(post.value.contentEventList)
        form.contentVoteList = pickIds(post.value.contentVoteList)
      } finally {
        loading.value = false
      }
    }

    async function onSave() {
      if (!post.value) return
      saving.value = true
      try {
        const patch = { _id: post.value._id }
        EDITABLE_KEYS.forEach(k => {
          patch[k] = form[k]
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

    function onPublishStatusChange() {
      load()
    }

    onMounted(load)

    return {
      loading,
      saving,
      post,
      form,
      activeTab,
      translating,
      translationStatuses: TRANSLATION_STATUSES,
      contentRelatedFields: CONTENT_RELATED_FIELDS,
      recommendFields: RECOMMEND_FIELDS,
      validationInitial,
      translationTagType,
      onSave,
      translateField,
      translateHtmlContent,
      onPublishStatusChange
    }
  }
}
</script>

<style scoped>
.post-edit-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.post-edit-page-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.post-edit-page-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.post-edit-page-sub {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 4px;
}
</style>
