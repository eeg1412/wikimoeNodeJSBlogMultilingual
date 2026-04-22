<template>
  <div class="login-page">
    <div class="login-page__shell">
      <section class="login-page__intro">
        <div>
          <div class="login-page__intro-badge">Admin Console</div>
          <h1 class="login-page__intro-title">
            让多语言内容管理终于变得顺手。
          </h1>
          <p class="login-page__intro-description">
            统一管理导入、翻译、编辑、附件和系统配置，桌面端与移动端都能稳定使用。
          </p>
        </div>

        <div class="login-page__feature-list">
          <div class="login-page__feature">
            <div class="login-page__feature-title">清晰的信息密度</div>
            <div class="login-page__feature-description">
              关键入口、状态和反馈都集中展示，减少无效点击。
            </div>
          </div>
          <div class="login-page__feature">
            <div class="login-page__feature-title">响应式后台</div>
            <div class="login-page__feature-description">
              手机、小平板和桌面端都能获得一致的导航和操作体验。
            </div>
          </div>
          <div class="login-page__feature">
            <div class="login-page__feature-title">深色模式适配</div>
            <div class="login-page__feature-description">
              自动跟随主题，也可以在登录后手动切换浅色 / 深色模式。
            </div>
          </div>
        </div>
      </section>

      <el-card class="login-card" shadow="never">
        <template #header>
          <div>
            <h2 class="login-card__title">登录后台</h2>
            <p class="login-card__subtitle">
              使用管理员账号继续访问多语言内容管理中心。
            </p>
          </div>
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
            登录并进入后台
          </el-button>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../store/auth.js'

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
      if (!valid) {
        return
      }

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
