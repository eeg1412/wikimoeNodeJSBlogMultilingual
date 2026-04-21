<template>
  <div class="login-page">
    <div class="login-card">
      <section class="login-panel login-panel--intro">
        <div class="login-badge">wikimoeNodeJSBlogMultilingual</div>
        <h1 class="login-title">多语言内容后台</h1>
        <p class="login-desc">
          这里不是一个精简演示面板，而是围绕导入、翻译、校验、发布和共享实体管理组织的工作台。
        </p>
        <div class="login-info-list">
          <div class="login-info-item">
            <div class="login-info-item-title">工作流</div>
            <div class="login-info-item-body">
              原站导入 → 多语言编辑 → 发布校验 → 前台生效
            </div>
          </div>
          <div class="login-info-item">
            <div class="login-info-item-title">共享实体</div>
            <div class="login-info-item-body">
              作者、分类、标签、地点、附件与关联内容统一管理
            </div>
          </div>
          <div class="login-info-item">
            <div class="login-info-item-title">首次启动默认值</div>
            <div class="login-info-item-body">
              账号与密码来自根目录 .env 的 INIT_ADMIN_* 配置
            </div>
          </div>
        </div>
      </section>

      <section class="login-panel login-panel--form">
        <div class="login-form-title">登录管理后台</div>
        <div class="login-form-sub">默认进入 {{ redirectPath }}</div>
        <el-form :model="form" label-position="top" @submit.prevent="submit">
          <el-form-item label="账号">
            <el-input v-model="form.username" autocomplete="username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              class="login-submit"
              @click="submit"
            >
              登录并进入工作台
            </el-button>
          </el-form-item>
        </el-form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { useSiteStore } from '@/store/site'

const form = reactive({ username: '', password: '' })
const loading = ref(false)
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const site = useSiteStore()

const redirectPath = computed(() => {
  if (typeof route.query.r === 'string' && route.query.r) {
    return route.query.r
  }
  return '/dashboard'
})

async function submit() {
  if (!form.username || !form.password) return
  loading.value = true
  try {
    const resp = await authApi.login(form)
    auth.set(resp.data.token, resp.data.admin)
    await site.load()
    router.replace(redirectPath.value)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(
      circle at top left,
      rgba(59, 130, 246, 0.2),
      transparent 24%
    ),
    radial-gradient(
      circle at bottom right,
      rgba(20, 184, 166, 0.18),
      transparent 30%
    ),
    linear-gradient(180deg, #f3f6fb 0%, #e8eef7 100%);
}

.login-card {
  width: min(1080px, 100%);
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(20px);
}

.login-panel {
  padding: 40px;
}

.login-panel--intro {
  background: linear-gradient(180deg, #152238 0%, #0f1727 100%);
  color: #edf4ff;
}

.login-panel--form {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-badge {
  display: inline-flex;
  width: fit-content;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.login-title {
  margin: 24px 0 12px;
  font-size: 40px;
  line-height: 1.1;
}

.login-desc {
  margin: 0;
  color: rgba(237, 244, 255, 0.76);
  line-height: 1.8;
}

.login-info-list {
  margin-top: 32px;
  display: grid;
  gap: 14px;
}

.login-info-item {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.login-info-item-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.login-info-item-body {
  color: rgba(237, 244, 255, 0.74);
  line-height: 1.7;
}

.login-form-title {
  font-size: 28px;
  font-weight: 700;
  color: #172033;
}

.login-form-sub {
  margin: 8px 0 28px;
  color: #6c7a93;
}

.login-submit {
  width: 100%;
}

@media (max-width: 900px) {
  .login-card {
    grid-template-columns: 1fr;
  }

  .login-panel {
    padding: 28px;
  }

  .login-title {
    font-size: 32px;
  }
}
</style>
