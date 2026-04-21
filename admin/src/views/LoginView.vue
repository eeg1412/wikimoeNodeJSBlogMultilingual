<template>
  <div class="login-view">
    <el-card class="login-card">
      <div class="login-title">多语言站后台登录</div>
      <el-form :model="form" label-position="top" @submit.prevent>
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.remember">记住我</el-checkbox>
        </el-form-item>
        <el-button type="primary" class="w_10" @click="submit">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import store from '@/store'
import { authApi } from '@/api'

const router = useRouter()

const form = reactive({
  username: 'admin',
  password: 'admin123456',
  remember: true
})

async function submit() {
  try {
    const result = await authApi.login(form)
    store.commit('setAdminAuth', result)
    ElMessage.success('登录成功')
    router.push({ name: 'Import' })
  } catch (error) {
    ElMessage.error(error.message)
  }
}
</script>

<style scoped>
.login-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(209, 159, 97, 0.25), transparent 36%),
    linear-gradient(180deg, #f2e8db 0%, #fbf9f5 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: 24px;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 20px;
}
</style>