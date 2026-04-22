<template>
  <div class="login-shell">
    <section class="login-panel">
      <p class="login-kicker">Multilingual Admin</p>
      <h1 class="login-title">后台登录</h1>
      <p class="login-copy">使用初始化管理员账号进入多语言站管理后台。</p>

      <el-form class="login-form" @submit.prevent>
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            @keydown.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            size="large"
            @keydown.enter="handleLogin"
          />
        </el-form-item>
        <div class="login-actions-row">
          <el-checkbox v-model="form.remember">保持登录</el-checkbox>
        </div>
        <el-button
          class="login-submit"
          type="primary"
          size="large"
          :loading="submitting"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import { handleAuthFailure, loginApi, showRequestErrors } from '@/api'
import { setAdminToken } from '@/utils/adminSession'

const router = useRouter()
const submitting = ref(false)
const form = reactive({
  username: '',
  password: '',
  remember: false
})

async function handleLogin() {
  if (!form.username.trim()) {
    ElMessage.error('请输入用户名')
    return
  }

  if (!form.password) {
    ElMessage.error('请输入密码')
    return
  }

  submitting.value = true

  try {
    const response = await loginApi({
      username: form.username,
      password: form.password,
      remember: form.remember
    })
    setAdminToken(response.token, form.remember)
    await router.replace({ name: 'Import' })
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-panel {
  width: min(100%, 460px);
  padding: 32px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 22px 64px rgba(15, 23, 42, 0.15);
  backdrop-filter: blur(18px);
}

.login-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  color: #0f766e;
}

.login-title {
  margin: 18px 0 0;
  font-size: clamp(34px, 5vw, 46px);
  line-height: 1.04;
  color: #0f172a;
}

.login-copy {
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.8;
  color: #475569;
}

.login-form {
  margin-top: 28px;
}

.login-actions-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20px;
}

.login-submit {
  width: 100%;
}

@media (max-width: 767px) {
  .login-panel {
    padding: 24px;
    border-radius: 24px;
  }
}

:global(html.dark) .login-panel {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(148, 163, 184, 0.2);
  box-shadow: 0 24px 68px rgba(2, 6, 23, 0.42);
}

:global(html.dark) .login-title {
  color: #f8fafc;
}

:global(html.dark) .login-copy {
  color: #cbd5e1;
}
</style>
