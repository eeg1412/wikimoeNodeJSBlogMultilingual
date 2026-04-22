<template>
  <div>
    <h2 class="text-xl font-bold mb-6">导入文章</h2>

    <el-card>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="源博客文章 URL" prop="sourceUrl">
          <el-input
            v-model="form.sourceUrl"
            placeholder="https://example.com/post/some-post"
            clearable
          />
          <div class="text-xs text-gray-500 mt-1">填入源博客文章的完整 URL</div>
        </el-form-item>

        <el-form-item label="目标语言" prop="languageCode">
          <el-select v-model="form.languageCode" placeholder="请选择目标语言">
            <el-option label="English (en)" value="en" />
            <el-option label="日本語 (jp)" value="jp" />
            <el-option label="繁體中文 (tw)" value="tw" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            开始导入
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="result"
        :title="result.success ? '导入成功' : '导入失败'"
        :type="result.success ? 'success' : 'error'"
        :description="result.message"
        show-icon
        class="mt-4"
      />
    </el-card>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { importPost } from '../api/importJob.js'
import { ElMessage } from 'element-plus'

export default {
  name: 'Import',
  setup() {
    const formRef = ref(null)
    const loading = ref(false)
    const result = ref(null)

    const form = reactive({
      sourceUrl: '',
      languageCode: 'en'
    })

    const rules = {
      sourceUrl: [
        { required: true, message: '请填入源博客文章 URL', trigger: 'blur' }
      ],
      languageCode: [
        { required: true, message: '请选择目标语言', trigger: 'change' }
      ]
    }

    async function handleSubmit() {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      loading.value = true
      result.value = null

      try {
        const res = await importPost({
          sourceUrl: form.sourceUrl,
          languageCode: form.languageCode
        })
        result.value = {
          success: true,
          message: `导入成功，文章 ID: ${res.data?.postId || ''}${res.data?.isNew ? '（新建）' : '（已更新）'}`
        }
        form.sourceUrl = ''
        ElMessage.success('导入成功')
      } catch (err) {
        const data = err?.response?.data
        const errorMsg =
          data?.message ||
          data?.errors?.[0]?.message ||
          err.message ||
          '导入失败'
        result.value = {
          success: false,
          message: errorMsg
        }
      } finally {
        loading.value = false
      }
    }

    return { formRef, form, rules, loading, result, handleSubmit }
  }
}
</script>
