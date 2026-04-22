<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <h2 class="text-xl font-bold text-center">Multilingual Admin</h2>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            clearable
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-button
          type="primary"
          class="w-full mt-2"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/auth.js'
import { ElMessage } from 'element-plus'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()
    const formRef = ref(null)
    const loading = ref(false)

    const form = reactive({
      username: '',
      password: ''
    })

    const rules = {
      username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
      password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
    }

    async function handleLogin() {
      const valid = await formRef.value?.validate().catch(() => false)
      if (!valid) return

      loading.value = true
      try {
        await authStore.login(form.username, form.password)
        const redirect = route.query.redirect || '/multilingual-admin'
        router.push(redirect)
      } catch (err) {
        const serverMsg = err?.response?.data?.message
        ElMessage.error(serverMsg || '登录失败，请检查用户名和密码')
      } finally {
        loading.value = false
      }
    }

    return { formRef, form, rules, loading, handleLogin }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}

.login-card {
  width: 360px;
}
</style>
