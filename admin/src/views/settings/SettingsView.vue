<template>
  <div class="settings-shell">
    <section class="page-header-card">
      <div>
        <p class="page-kicker">System Settings</p>
        <h1 class="page-title">基础配置</h1>
        <p class="page-copy">
          在这里配置原站接口地址、静态资源域名和多语言站的站点展示字段。导入和前台渲染都会直接依赖这些配置。
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="$router.push({ name: 'PostList' })" plain
          >文章列表</el-button
        >
        <el-button @click="$router.push({ name: 'AdminLoginLog' })" plain
          >登录日志</el-button
        >
        <el-button @click="$router.push({ name: 'Import' })" plain
          >导入页</el-button
        >
        <el-button @click="loadOptions" :loading="loading">刷新配置</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave"
          >保存修改</el-button
        >
      </div>
    </section>

    <div class="settings-grid">
      <section class="surface-card">
        <h2 class="section-title">系统配置</h2>
        <el-form label-position="top">
          <el-form-item label="原站公开接口基地址">
            <el-input
              v-model="systemForm.sourceBlogApiBaseUrl"
              placeholder="https://example.com/api/blog"
            />
          </el-form-item>
          <el-form-item label="原站静态资源域名">
            <el-input
              v-model="systemForm.sourceBlogPublicOrigin"
              placeholder="https://example.com"
            />
          </el-form-item>
          <el-form-item label="原站请求超时毫秒数">
            <el-input
              v-model.number="systemForm.sourceBlogRequestTimeoutMs"
              type="number"
            />
          </el-form-item>
          <el-form-item label="后台登录窗口分钟数">
            <el-input
              v-model.number="systemForm.adminLoginAttemptWindowMinutes"
              type="number"
            />
          </el-form-item>
          <el-form-item label="后台登录最大失败次数">
            <el-input
              v-model.number="systemForm.adminLoginMaxAttempts"
              type="number"
            />
          </el-form-item>
        </el-form>
      </section>

      <section class="surface-card">
        <h2 class="section-title">站点配置</h2>
        <el-form label-position="top">
          <el-form-item label="站点标题">
            <el-input v-model="siteForm.title" />
          </el-form-item>
          <el-form-item label="站点副标题">
            <el-input v-model="siteForm.subTitle" />
          </el-form-item>
          <el-form-item label="站点描述">
            <el-input
              v-model="siteForm.description"
              type="textarea"
              :rows="3"
            />
          </el-form-item>
          <el-form-item label="默认语言">
            <el-select
              v-model="siteForm.defaultLanguageCode"
              class="full-width"
            >
              <el-option label="English" value="en" />
              <el-option label="Japanese" value="jp" />
              <el-option label="Traditional Chinese" value="tw" />
            </el-select>
          </el-form-item>
          <el-form-item label="分页大小">
            <el-input v-model.number="siteForm.pageSize" type="number" />
          </el-form-item>
          <el-form-item label="站点 URL">
            <el-input
              v-model="siteForm.url"
              placeholder="https://multilingual.example.com"
            />
          </el-form-item>
          <el-form-item label="页脚信息">
            <el-input v-model="siteForm.footerInfo" />
          </el-form-item>
        </el-form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  getOptionListApi,
  handleAuthFailure,
  showRequestErrors,
  updateOptionApi
} from '@/api'

const loading = ref(false)
const saving = ref(false)
const systemForm = reactive({
  sourceBlogApiBaseUrl: '',
  sourceBlogPublicOrigin: '',
  sourceBlogRequestTimeoutMs: 10000,
  adminLoginAttemptWindowMinutes: 5,
  adminLoginMaxAttempts: 3
})
const siteForm = reactive({
  title: '',
  subTitle: '',
  description: '',
  defaultLanguageCode: 'en',
  pageSize: 10,
  url: '',
  footerInfo: ''
})

function assignOptionRecords(records) {
  const map = {}

  for (const item of records) {
    map[item.fullKey] = item.value
  }

  systemForm.sourceBlogApiBaseUrl = map['system.sourceBlogApiBaseUrl'] || ''
  systemForm.sourceBlogPublicOrigin = map['system.sourceBlogPublicOrigin'] || ''
  systemForm.sourceBlogRequestTimeoutMs =
    map['system.sourceBlogRequestTimeoutMs'] || 10000
  systemForm.adminLoginAttemptWindowMinutes =
    map['system.adminLoginAttemptWindowMinutes'] || 5
  systemForm.adminLoginMaxAttempts = map['system.adminLoginMaxAttempts'] || 3
  siteForm.title = map['site.title'] || ''
  siteForm.subTitle = map['site.subTitle'] || ''
  siteForm.description = map['site.description'] || ''
  siteForm.defaultLanguageCode = map['site.defaultLanguageCode'] || 'en'
  siteForm.pageSize = map['site.pageSize'] || 10
  siteForm.url = map['site.url'] || ''
  siteForm.footerInfo = map['site.footerInfo'] || ''
}

async function loadOptions() {
  loading.value = true
  try {
    const response = await getOptionListApi()
    assignOptionRecords(Array.isArray(response.data) ? response.data : [])
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await updateOptionApi([
      {
        fullKey: 'system.sourceBlogApiBaseUrl',
        value: systemForm.sourceBlogApiBaseUrl || null
      },
      {
        fullKey: 'system.sourceBlogPublicOrigin',
        value: systemForm.sourceBlogPublicOrigin || null
      },
      {
        fullKey: 'system.sourceBlogRequestTimeoutMs',
        value: systemForm.sourceBlogRequestTimeoutMs || null
      },
      {
        fullKey: 'system.adminLoginAttemptWindowMinutes',
        value: systemForm.adminLoginAttemptWindowMinutes || null
      },
      {
        fullKey: 'system.adminLoginMaxAttempts',
        value: systemForm.adminLoginMaxAttempts || null
      },
      { fullKey: 'site.title', value: siteForm.title || null },
      { fullKey: 'site.subTitle', value: siteForm.subTitle || null },
      { fullKey: 'site.description', value: siteForm.description || null },
      {
        fullKey: 'site.defaultLanguageCode',
        value: siteForm.defaultLanguageCode || 'en'
      },
      { fullKey: 'site.pageSize', value: siteForm.pageSize || null },
      { fullKey: 'site.url', value: siteForm.url || null },
      { fullKey: 'site.footerInfo', value: siteForm.footerInfo || null }
    ])
    ElMessage.success('配置已保存')
    await loadOptions()
  } catch (error) {
    handleAuthFailure(error)
    showRequestErrors(error)
  } finally {
    saving.value = false
  }
}

onMounted(async function () {
  await loadOptions()
})
</script>

<style scoped>
.settings-shell {
  padding: 24px;
}

.page-header-card {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.page-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #0f766e;
}

.page-title {
  margin: 14px 0 0;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.02;
  color: #0f172a;
}

.page-copy {
  margin: 16px 0 0;
  max-width: 70ch;
  font-size: 15px;
  line-height: 1.8;
  color: #475569;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.settings-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.surface-card {
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(16px);
}

.section-title {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.full-width {
  width: 100%;
}

@media (max-width: 1023px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .settings-shell {
    padding: 16px;
  }

  .page-header-card,
  .surface-card {
    padding: 20px;
    border-radius: 22px;
  }
}

:global(html.dark) .page-header-card,
:global(html.dark) .surface-card {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 24px 68px rgba(2, 6, 23, 0.42);
}

:global(html.dark) .page-title,
:global(html.dark) .section-title {
  color: #f8fafc;
}

:global(html.dark) .page-copy {
  color: #cbd5e1;
}
</style>
