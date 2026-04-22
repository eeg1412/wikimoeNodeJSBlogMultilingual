<template>
  <div v-loading="loading" class="post-editor">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <el-button @click="$router.back()">返回</el-button>
        <h2 class="text-xl font-bold truncate max-w-lg">
          {{ post?.title || '文章编辑' }}
        </h2>
        <el-tag
          v-if="post"
          :type="post.status === 1 ? 'success' : 'info'"
          size="small"
        >
          {{ post.status === 1 ? '已发布' : '草稿' }}
        </el-tag>
        <el-tag v-if="post" size="small">{{ post.languageCode }}</el-tag>
      </div>

      <div class="flex gap-2">
        <el-button type="success" :loading="saving" @click="handleSave"
          >保存</el-button
        >
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
      </div>
    </div>

    <el-row :gutter="20" v-if="post">
      <el-col :span="16">
        <!-- 标题 -->
        <el-card class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <span>标题</span>
              <el-button
                size="small"
                :loading="translating.title"
                @click="handleTranslate('title')"
                >AI 翻译</el-button
              >
            </div>
          </template>
          <el-input v-model="form.title" placeholder="文章标题" />
        </el-card>

        <!-- 摘要 -->
        <el-card class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <span>摘要</span>
              <el-button
                size="small"
                :loading="translating.excerpt"
                @click="handleTranslate('excerpt')"
                >AI 翻译</el-button
              >
            </div>
          </template>
          <el-input
            v-model="form.excerpt"
            type="textarea"
            :rows="3"
            placeholder="文章摘要"
          />
        </el-card>

        <!-- 正文 -->
        <el-card class="mb-4">
          <template #header>
            <div class="flex items-center justify-between">
              <span>正文</span>
              <el-button
                size="small"
                :loading="translating.content"
                @click="handleTranslate('content')"
                >AI 翻译正文</el-button
              >
            </div>
          </template>
          <div class="rich-editor-wrap">
            <Toolbar
              :editor="editorRef"
              :default-config="toolbarConfig"
              mode="default"
              style="border-bottom: 1px solid #e5e7eb"
            />
            <Editor
              v-model="form.content"
              :default-config="editorConfig"
              mode="default"
              style="min-height: 400px"
              @on-created="handleEditorCreated"
            />
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 分类 -->
        <el-card class="mb-4">
          <template #header><span>分类</span></template>
          <el-select
            v-model="form.sort"
            placeholder="选择分类"
            clearable
            class="w-full"
          >
            <el-option
              v-for="s in sortList"
              :key="s._id"
              :label="s.sortname"
              :value="s._id"
            />
          </el-select>
        </el-card>

        <!-- 翻译状态信息 -->
        <el-card class="mb-4">
          <template #header><span>翻译状态</span></template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="标题">
              <el-tag
                size="small"
                :type="statusType(post.translationStatus?.title)"
              >
                {{ post.translationStatus?.title || '-' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="摘要">
              <el-tag
                size="small"
                :type="statusType(post.translationStatus?.excerpt)"
              >
                {{ post.translationStatus?.excerpt || '-' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="正文">
              <el-tag
                size="small"
                :type="statusType(post.translationStatus?.content)"
              >
                {{ post.translationStatus?.content || '-' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, reactive, onBeforeUnmount, shallowRef, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import {
  getPostDetail,
  updatePost,
  translatePost,
  publishPost,
  unpublishPost
} from '../api/post.js'
import { getSortList } from '../api/taxonomy.js'
import { ElMessage } from 'element-plus'

export default {
  name: 'PostEditor',
  components: { Editor, Toolbar },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const postId = route.params.id

    const post = ref(null)
    const loading = ref(false)
    const saving = ref(false)
    const publishing = ref(false)
    const sortList = ref([])

    const form = reactive({ title: '', excerpt: '', content: '', sort: '' })
    const translating = reactive({
      title: false,
      excerpt: false,
      content: false
    })

    // WangEditor
    const editorRef = shallowRef(null)
    const toolbarConfig = {}
    const editorConfig = { placeholder: '请输入正文...' }

    function handleEditorCreated(editor) {
      editorRef.value = editor
    }

    onBeforeUnmount(() => {
      if (editorRef.value) editorRef.value.destroy()
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
      } catch {
        ElMessage.error('加载文章失败')
        router.back()
      } finally {
        loading.value = false
      }
    }

    async function fetchSorts() {
      if (!post.value) return
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
          sort: form.sort || undefined
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
      const map = { approved: 'success', pending: 'warning', none: 'info' }
      return map[status] || 'info'
    }

    onMounted(async () => {
      await fetchPost()
      await fetchSorts()
    })

    return {
      post,
      form,
      loading,
      saving,
      publishing,
      sortList,
      translating,
      editorRef,
      toolbarConfig,
      editorConfig,
      handleEditorCreated,
      handleSave,
      handlePublish,
      handleUnpublish,
      handleTranslate,
      statusType
    }
  }
}
</script>

<style scoped>
.rich-editor-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
</style>
