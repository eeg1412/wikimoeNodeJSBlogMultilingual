<template>
  <AdminPage
    v-loading="loading"
    :title="post?.title || '文章编辑'"
    description="补齐作者、标签、封面图等编辑流程，并优化发布确认与链接预览体验。"
  >
    <template #actions>
      <el-button @click="$router.back()">返回列表</el-button>
      <el-button type="success" :loading="saving" @click="handleSave">
        保存
      </el-button>
      <el-button
        v-if="post && post.status !== 1"
        type="primary"
        :loading="publishing"
        @click="handlePublish"
      >
        发布
      </el-button>
      <el-button
        v-if="post && post.status === 1"
        type="warning"
        :loading="publishing"
        @click="handleUnpublish"
      >
        取消发布
      </el-button>
    </template>

    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">语言</div>
          <div class="admin-stat-card__value">
            {{ post?.languageCode || '-' }}
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">发布状态</div>
          <div class="admin-stat-card__value">
            {{ post?.status === 1 ? '已发布' : '草稿' }}
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">翻译状态</div>
          <div class="admin-stat-card__value">
            {{ post?.translationStatus || '-' }}
          </div>
        </div>
      </div>
    </template>

    <div v-if="post" class="post-editor__grid">
      <div class="post-editor__stack">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <span>标题与摘要</span>
              <div class="flex gap-2">
                <el-button
                  size="small"
                  :loading="translating.title"
                  @click="handleTranslate('title')"
                >
                  AI 翻译标题
                </el-button>
                <el-button
                  size="small"
                  :loading="translating.excerpt"
                  @click="handleTranslate('excerpt')"
                >
                  AI 翻译摘要
                </el-button>
              </div>
            </div>
          </template>

          <el-form label-position="top">
            <el-form-item label="文章标题">
              <el-input v-model="form.title" placeholder="请输入文章标题" />
            </el-form-item>
            <el-form-item label="文章摘要">
              <el-input
                v-model="form.excerpt"
                type="textarea"
                :rows="4"
                placeholder="请输入文章摘要"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <span>正文</span>
              <div class="post-editor__editor-actions">
                <el-button
                  size="small"
                  :loading="translating.content"
                  @click="handleTranslate('content')"
                >
                  AI 翻译正文
                </el-button>
              </div>
            </div>
          </template>

          <RichEditor5
            v-model:content="form.content"
            :language-code="post.languageCode"
            :is-post="true"
          />
        </el-card>
      </div>

      <div class="post-editor__stack">
        <el-card shadow="never">
          <template #header>
            <span>发布与内容元数据</span>
          </template>

          <el-form label-position="top">
            <el-form-item label="URL 别名">
              <el-input
                v-model="form.alias"
                placeholder="仅支持字母、数字、下划线和短横线"
              />
              <div class="text-xs text-gray-500 mt-1">
                预览地址：{{ aliasPreview }}
              </div>
            </el-form-item>
            <el-form-item label="发布时间">
              <el-date-picker
                v-model="form.date"
                type="datetime"
                placeholder="选择发布时间"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="作者">
              <el-select
                v-model="form.author"
                filterable
                clearable
                placeholder="选择作者"
                style="width: 100%"
              >
                <el-option
                  v-for="author in authorOptions"
                  :key="author._id"
                  :label="author.nickname || author.sourceId"
                  :value="author._id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-select
                v-model="form.sort"
                placeholder="选择分类"
                clearable
                style="width: 100%"
              >
                <el-option
                  v-for="sort in sortList"
                  :key="sort._id"
                  :label="sort.sortname"
                  :value="sort._id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="标签">
              <el-select
                v-model="form.tags"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择标签"
                style="width: 100%"
              >
                <el-option
                  v-for="tag in tagOptions"
                  :key="tag._id"
                  :label="tag.tagname || tag.sourceId"
                  :value="tag._id"
                />
              </el-select>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <span>封面图</span>
              <el-button size="small" @click="openCoverSelector">
                选择封面图
              </el-button>
            </div>
          </template>

          <div v-if="coverImageList.length > 0" class="post-cover-grid">
            <div
              v-for="item in coverImageList"
              :key="item._id"
              class="post-cover-card"
            >
              <el-image
                :src="item.previewUrl || item.filepath || item.externalUrl"
                fit="cover"
                style="width: 100%; height: 120px"
              />
              <div class="post-cover-card__body">
                <div class="font-medium truncate">
                  {{ item.name || item.filename || item._id }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ item.description || item.filepath || '-' }}
                </div>
              </div>
              <div class="post-cover-card__actions">
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="removeCoverImage(item._id)"
                >
                  移除
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂未设置封面图" />
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span>状态与来源</span>
          </template>

          <div class="space-y-3">
            <div class="post-editor__status-row">
              <el-tag :type="post.status === 1 ? 'success' : 'info'">
                {{ post.status === 1 ? '已发布' : '草稿' }}
              </el-tag>
              <el-tag size="small">{{ post.languageCode }}</el-tag>
              <el-tag size="small" :type="statusType(post.translationStatus)">
                {{ post.translationStatus || '-' }}
              </el-tag>
            </div>
            <div class="text-sm text-gray-500">
              sourceId：{{ post.sourceId || '-' }}
            </div>
            <div class="text-sm text-gray-500">
              sourceAlias：{{ post.sourceAlias || '-' }}
            </div>
            <div class="text-sm text-gray-500">
              更新时间：{{ formatDate(post.updatedAt) }}
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <AttachmentSelectorDialog
      ref="coverSelectorRef"
      :language-code="post?.languageCode || ''"
      :type-list="['image']"
      @select-attachments="handleCoverSelection"
    />
  </AdminPage>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminPage from '../components/AdminPage.vue'
import AttachmentSelectorDialog from '../components/AttachmentSelectorDialog.vue'
import RichEditor5 from '../components/RichEditor5.vue'
import {
  getPostDetail,
  publishPost,
  translatePost,
  unpublishPost,
  updatePost
} from '../api/post.js'
import { getAuthorList, getSortList, getTagList } from '../api/taxonomy.js'

function flattenGroupedEntries(list, languageCode) {
  return (list || [])
    .map(group => {
      const langs = Array.isArray(group.langs) ? group.langs : []
      return (
        langs.find(item => item.languageCode === languageCode) ||
        langs[0] ||
        null
      )
    })
    .filter(Boolean)
}

function uniqAttachments(list) {
  const map = new Map()
  for (const item of list || []) {
    if (item?._id) {
      map.set(item._id, item)
    }
  }
  return Array.from(map.values())
}

export default {
  name: 'PostEditor',
  components: {
    AdminPage,
    AttachmentSelectorDialog,
    RichEditor5
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const postId = route.params.id

    const post = ref(null)
    const sortList = ref([])
    const authorOptions = ref([])
    const tagOptions = ref([])
    const coverImageList = ref([])
    const coverSelectorRef = ref(null)
    const loading = ref(false)
    const saving = ref(false)
    const publishing = ref(false)

    const form = reactive({
      title: '',
      excerpt: '',
      content: '',
      sort: '',
      author: '',
      tags: [],
      coverImages: [],
      alias: '',
      date: null
    })

    const translating = reactive({
      title: false,
      excerpt: false,
      content: false
    })

    const aliasPreview = computed(() => {
      const alias = form.alias || post.value?.alias
      if (!alias) {
        return `/${post.value?.languageCode || 'lang'}/post/自动生成`
      }
      return `/${post.value?.languageCode || 'lang'}/post/${alias}`
    })

    async function fetchPost() {
      loading.value = true
      try {
        const res = await getPostDetail(postId)
        post.value = res.data
        form.title = res.data.title || ''
        form.excerpt = res.data.excerpt || ''
        form.content = res.data.content || ''
        form.sort = res.data.sort?._id || res.data.sort || ''
        form.author = res.data.author?._id || res.data.author || ''
        form.tags = Array.isArray(res.data.tags)
          ? res.data.tags.map(item => item._id || item)
          : []
        form.coverImages = Array.isArray(res.data.coverImages)
          ? res.data.coverImages.map(item => item._id || item)
          : []
        coverImageList.value = Array.isArray(res.data.coverImages)
          ? res.data.coverImages
          : []
        form.alias = res.data.alias || ''
        form.date = res.data.date ? new Date(res.data.date) : null
      } catch {
        ElMessage.error('加载文章失败')
        router.back()
      } finally {
        loading.value = false
      }
    }

    async function fetchMetadataOptions() {
      if (!post.value) {
        return
      }

      const baseParams = {
        languageCode: post.value.languageCode,
        page: 1,
        limit: 200
      }

      const [sortRes, authorRes, tagRes] = await Promise.all([
        getSortList(baseParams),
        getAuthorList(baseParams),
        getTagList(baseParams)
      ])

      sortList.value = sortRes.data?.list || []
      authorOptions.value = flattenGroupedEntries(
        authorRes.data?.list || [],
        post.value.languageCode
      )
      tagOptions.value = flattenGroupedEntries(
        tagRes.data?.list || [],
        post.value.languageCode
      )
    }

    async function handleSave() {
      saving.value = true
      try {
        await updatePost(postId, {
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          sort: form.sort || null,
          author: form.author || null,
          tags: form.tags,
          coverImages: form.coverImages,
          alias: form.alias,
          date: form.date || null
        })
        ElMessage.success('保存成功')
        await fetchPost()
      } catch (err) {
        ElMessage.error(err?.response?.data?.errors?.[0]?.message || '保存失败')
      } finally {
        saving.value = false
      }
    }

    async function handlePublish() {
      try {
        await ElMessageBox.confirm(
          '发布后前台将立即可见，是否确认发布当前内容？',
          '确认发布',
          {
            type: 'warning',
            confirmButtonText: '确认发布',
            cancelButtonText: '取消'
          }
        )
      } catch {
        return
      }

      publishing.value = true
      try {
        await publishPost(postId)
        ElMessage.success('发布成功')
        await fetchPost()
      } catch (err) {
        ElMessage.error(err?.response?.data?.message || '发布失败')
      } finally {
        publishing.value = false
      }
    }

    async function handleUnpublish() {
      try {
        await ElMessageBox.confirm(
          '取消发布后前台将不再展示这篇内容，是否继续？',
          '确认取消发布',
          {
            type: 'warning',
            confirmButtonText: '确认取消',
            cancelButtonText: '保留发布状态'
          }
        )
      } catch {
        return
      }

      publishing.value = true
      try {
        await unpublishPost(postId)
        ElMessage.success('已取消发布')
        await fetchPost()
      } finally {
        publishing.value = false
      }
    }

    async function handleTranslate(field) {
      translating[field] = true
      try {
        const res = await translatePost(postId, { field })
        if (res.data?.translatedValue !== undefined) {
          form[field] = res.data.translatedValue
          ElMessage.success(`${field} 翻译完成`)
        }
        await fetchPost()
      } catch {
        ElMessage.error('翻译失败')
      } finally {
        translating[field] = false
      }
    }

    function openCoverSelector() {
      coverSelectorRef.value?.open()
    }

    function handleCoverSelection(attachments) {
      coverImageList.value = uniqAttachments([
        ...coverImageList.value,
        ...(attachments || [])
      ])
      form.coverImages = coverImageList.value.map(item => item._id)
    }

    function removeCoverImage(id) {
      coverImageList.value = coverImageList.value.filter(item => item._id !== id)
      form.coverImages = coverImageList.value.map(item => item._id)
    }

    function statusType(status) {
      const map = {
        approved: 'success',
        not_required: 'success',
        ai_draft: 'warning',
        manual_draft: 'warning',
        pending: 'info',
        outdated: 'danger',
        stub: 'danger'
      }
      return map[status] || 'info'
    }

    function formatDate(value) {
      if (!value) {
        return '-'
      }
      return new Date(value).toLocaleString()
    }

    onMounted(async () => {
      await fetchPost()
      await fetchMetadataOptions()
    })

    return {
      post,
      form,
      sortList,
      authorOptions,
      tagOptions,
      coverImageList,
      coverSelectorRef,
      loading,
      saving,
      publishing,
      translating,
      aliasPreview,
      handleSave,
      handlePublish,
      handleUnpublish,
      handleTranslate,
      openCoverSelector,
      handleCoverSelection,
      removeCoverImage,
      statusType,
      formatDate
    }
  }
}
</script>
