<template>
  <AdminPage
    title="导入文章"
    description="输入源文章 ID、别名或完整链接即可触发导入，必要时可直接覆盖已存在的语言版本。"
  >
    <el-card shadow="never">
        <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="源文章 ID 或别名" prop="sourceIdentifier">
          <el-input
            v-model="form.sourceIdentifier"
            placeholder="输入原文章 ID、别名，或完整文章 URL"
            clearable
          />
          <div class="text-xs text-gray-500 mt-1">
            支持直接输入 ID/别名，也支持粘贴完整文章 URL
          </div>
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

      <div v-if="result?.success && result?.postId" class="mt-4">
        <el-button type="primary" link @click="openImportedPost">
          直接打开导入后的文章
        </el-button>
      </div>
    </el-card>
  </AdminPage>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { importPost } from '../api/importJob.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminPage from '../components/AdminPage.vue'

export default {
  name: 'Import',
  components: { AdminPage },
  setup() {
    const router = useRouter()
    const formRef = ref(null)
    const loading = ref(false)
    const result = ref(null)

    const form = reactive({
      sourceIdentifier: '',
      languageCode: 'en'
    })

    const rules = {
      sourceIdentifier: [
        { required: true, message: '请填入源文章 ID、别名或 URL', trigger: 'blur' }
      ],
      languageCode: [
        { required: true, message: '请选择目标语言', trigger: 'change' }
      ]
    }

    async function submitImport(confirmOverwrite = false) {
      return importPost({
        sourceIdentifier: form.sourceIdentifier,
        languageCode: form.languageCode,
        confirmOverwrite
      })
    }

    async function handleSubmit() {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      loading.value = true
      result.value = null

      try {
        const res = await submitImport(false)
        result.value = {
          success: true,
          postId: res.data?.postId || '',
          message: `导入成功，文章 ID: ${res.data?.postId || ''}${res.data?.isNew ? '（新建）' : '（已更新）'}`
        }
        form.sourceIdentifier = ''
        ElMessage.success('导入成功')
      } catch (err) {
        const data = err?.response?.data
        if (err?.response?.status === 409) {
          try {
            await ElMessageBox.confirm(
              data?.message || '当前语言文章已存在，是否覆盖导入？',
              '重复导入确认',
              {
                type: 'warning',
                confirmButtonText: '确认覆盖',
                cancelButtonText: '取消'
              }
            )
            const res = await submitImport(true)
            result.value = {
              success: true,
              postId: res.data?.postId || '',
              message: `覆盖导入成功，文章 ID: ${res.data?.postId || ''}`
            }
            form.sourceIdentifier = ''
            ElMessage.success('覆盖导入成功')
            return
          } catch (confirmError) {
            if (confirmError === 'cancel') {
              result.value = {
                success: false,
                message: data?.message || '已取消覆盖导入'
              }
              return
            }
            throw confirmError
          }
        }
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

    function openImportedPost() {
      if (!result.value?.postId) {
        return
      }
      router.push(`/multilingual-admin/posts/edit/${result.value.postId}`)
    }

    return {
      formRef,
      form,
      rules,
      loading,
      result,
      handleSubmit,
      openImportedPost
    }
  }
}
</script>
