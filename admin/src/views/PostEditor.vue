<template>
  <AdminPage
    v-loading="loading"
    :title="post?.title || '文章编辑'"
    description="保留现有内容编辑能力，并补齐别名、发布时间与统一富文本媒体插入能力。"
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

          <div class="space-y-3">
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
          </div>
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
            <span>发布元数据</span>
          </template>

          <el-form label-position="top">
            <el-form-item label="URL 别名">
              <el-input
                v-model="form.alias"
                placeholder="留空则继续使用系统生成逻辑"
              />
            </el-form-item>
            <el-form-item label="发布时间">
              <el-date-picker
                v-model="form.date"
                type="datetime"
                placeholder="选择发布时间"
                style="width: 100%"
              />
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
          </el-form>
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
              alias：{{ post.alias || '未设置' }}
            </div>
            <div class="text-sm text-gray-500">
              更新时间：{{ formatDate(post.updatedAt) }}
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </AdminPage>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AdminPage from '../components/AdminPage.vue'
import RichEditor5 from '../components/RichEditor5.vue'
import {
  getPostDetail,
  publishPost,
  translatePost,
  unpublishPost,
  updatePost
} from '../api/post.js'
import { getSortList } from '../api/taxonomy.js'

export default {
  name: 'PostEditor',
  components: {
    AdminPage,
    RichEditor5
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const postId = route.params.id

    const post = ref(null)
    const sortList = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const publishing = ref(false)

    const form = reactive({
      title: '',
      excerpt: '',
      content: '',
      sort: '',
      alias: '',
      date: null
    })

    const translating = reactive({
      title: false,
      excerpt: false,
      content: false
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
        form.alias = res.data.alias || ''
        form.date = res.data.date ? new Date(res.data.date) : null
      } catch {
        ElMessage.error('加载文章失败')
        router.back()
      } finally {
        loading.value = false
      }
    }

    async function fetchSorts() {
      if (!post.value) {
        return
      }

      const res = await getSortList({
        languageCode: post.value.languageCode,
        page: 1,
        limit: 200
      })
      sortList.value = res.data?.list || []
    }

    async function handleSave() {
      saving.value = true
      try {
        await updatePost(postId, {
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          sort: form.sort || null,
          alias: form.alias,
          date: form.date || null
        })
        ElMessage.success('保存成功')
        await fetchPost()
      } catch {
        ElMessage.error('保存失败')
      } finally {
        saving.value = false
      }
    }

    async function handlePublish() {
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
      await fetchSorts()
    })

    return {
      post,
      form,
      sortList,
      loading,
      saving,
      publishing,
      translating,
      handleSave,
      handlePublish,
      handleUnpublish,
      handleTranslate,
      statusType,
      formatDate
    }
  }
}
</script>
