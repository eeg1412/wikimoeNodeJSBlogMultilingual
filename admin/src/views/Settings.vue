<template>
  <AdminPage
    title="系统设置"
    description="集中管理源站连接、AI 配置、站点展示信息与后台安全项，减少隐藏配置入口。"
  >
    <template #actions>
      <el-button
        :loading="regeneratingJwt"
        type="warning"
        @click="handleRegenerateJwtSecret"
      >
        重置管理端 JWT 密钥
      </el-button>
    </template>

    <template #meta>
      <div class="admin-stat-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">当前页签</div>
          <div class="admin-stat-card__value">
            {{ activeTab === 'system' ? '系统配置' : '站点配置' }}
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">保存状态</div>
          <div class="admin-stat-card__value">
            {{ saving.system || saving.site ? '保存中' : '空闲' }}
          </div>
        </div>
      </div>
    </template>

    <el-alert
      title="重置 JWT 密钥会让所有已登录后台会话失效，请在确认无人操作时执行。"
      type="warning"
      :closable="false"
      show-icon
    />

    <el-tabs v-model="activeTab">
      <el-tab-pane label="系统配置" name="system">
        <el-card v-if="systemConfig" shadow="never">
          <el-form :model="systemConfig" label-position="top">
            <el-form-item label="源博客接口地址（sourceBlogApiBaseUrl）">
              <el-input
                v-model="systemConfig.sourceBlogApiBaseUrl"
                placeholder="https://example.com/api/blog"
              />
            </el-form-item>
            <el-form-item label="源博客公共域名（sourceBlogPublicOrigin）">
              <el-input
                v-model="systemConfig.sourceBlogPublicOrigin"
                placeholder="https://example.com"
              />
            </el-form-item>
            <el-form-item label="AI 服务商（aiProvider）">
              <el-select v-model="systemConfig.aiProvider">
                <el-option
                  label="Google Gemini API (@google/genai)"
                  value="google-genai"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="AI API Key（aiApiKey）">
              <el-input
                v-model="systemConfig.aiApiKey"
                type="password"
                show-password
                placeholder="输入后保存，显示为脱敏"
              />
            </el-form-item>
            <el-form-item label="AI Model（aiModel）">
              <el-input
                v-model="systemConfig.aiModel"
                placeholder="例：gemini-2.5-flash"
              />
            </el-form-item>
            <el-form-item label="AI Gateway URL（aiGatewayUrl，可选）">
              <el-input
                v-model="systemConfig.aiGatewayUrl"
                placeholder="可选，AI 网关代理地址"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="saving.system"
                @click="saveSystem"
              >
                保存系统配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="站点配置" name="site">
        <el-card v-if="siteConfig" shadow="never">
          <el-form :model="siteConfig" label-position="top">
            <el-divider content-position="left">站点名称（多语言）</el-divider>
            <el-form-item label="站点名称 - 默认（siteName）">
              <el-input
                v-model="siteConfig.siteName"
                placeholder="所有语言的默认站点名称"
              />
            </el-form-item>
            <el-form-item label="站点名称 - English（siteNameEn）">
              <el-input
                v-model="siteConfig.siteNameEn"
                placeholder="优先级高于默认值"
              />
            </el-form-item>
            <el-form-item label="站点名称 - 日本語（siteNameJp）">
              <el-input
                v-model="siteConfig.siteNameJp"
                placeholder="優先級は既定値より高い"
              />
            </el-form-item>
            <el-form-item label="站点名称 - 繁體中文（siteNameTw）">
              <el-input
                v-model="siteConfig.siteNameTw"
                placeholder="優先級高於預設值"
              />
            </el-form-item>

            <el-divider content-position="left">站点描述（多语言）</el-divider>
            <el-form-item label="站点描述 - 默认（description）">
              <el-input
                v-model="siteConfig.description"
                type="textarea"
                :rows="2"
                placeholder="所有语言的默认站点描述"
              />
            </el-form-item>
            <el-form-item label="站点描述 - English（descriptionEn）">
              <el-input
                v-model="siteConfig.descriptionEn"
                type="textarea"
                :rows="2"
              />
            </el-form-item>
            <el-form-item label="站点描述 - 日本語（descriptionJp）">
              <el-input
                v-model="siteConfig.descriptionJp"
                type="textarea"
                :rows="2"
              />
            </el-form-item>
            <el-form-item label="站点描述 - 繁體中文（descriptionTw）">
              <el-input
                v-model="siteConfig.descriptionTw"
                type="textarea"
                :rows="2"
              />
            </el-form-item>

            <el-divider content-position="left">其他配置</el-divider>
            <el-form-item label="站点 URL（siteUrl）">
              <el-input
                v-model="siteConfig.url"
                placeholder="https://your-blog.com"
              />
            </el-form-item>
            <el-form-item label="默认语言（defaultLanguageCode）">
              <el-select v-model="siteConfig.defaultLanguageCode">
                <el-option label="en" value="en" />
                <el-option label="jp" value="jp" />
                <el-option label="tw" value="tw" />
              </el-select>
            </el-form-item>
            <el-form-item label="每页文章数（pageSize）">
              <el-input-number
                v-model="siteConfig.pageSize"
                :min="1"
                :max="100"
              />
            </el-form-item>
            <el-form-item label="允许切换主题">
              <el-switch v-model="siteConfig.allowSwitchTheme" />
            </el-form-item>
            <el-form-item label="Robots.txt">
              <el-input
                v-model="siteConfig.robotsTxt"
                type="textarea"
                :rows="4"
              />
            </el-form-item>
            <el-form-item label="Ads.txt 内容">
              <el-input
                v-model="siteConfig.adsTxtContent"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
            <el-form-item label="页脚说明（footerInfo）">
              <el-input v-model="siteConfig.footerInfo" />
            </el-form-item>
            <el-form-item label="额外 CSS（extraCss）">
              <el-input
                v-model="siteConfig.extraCss"
                type="textarea"
                :rows="4"
              />
            </el-form-item>
            <el-form-item label="额外 JS（extraJs）">
              <el-input
                v-model="siteConfig.extraJs"
                type="textarea"
                :rows="4"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving.site" @click="saveSite">
                保存站点配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </AdminPage>
</template>

<script>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AdminPage from '../components/AdminPage.vue'
import { regenerateJwtSecret } from '../api/auth.js'
import { getOptions, updateOptions } from '../api/option.js'
import { useAuthStore } from '../store/auth.js'

export default {
  name: 'Settings',
  components: { AdminPage },
  setup() {
    const authStore = useAuthStore()
    const activeTab = ref('system')
    const systemConfig = ref(null)
    const siteConfig = ref(null)
    const systemConfigSnapshot = ref(null)
    const siteConfigSnapshot = ref(null)
    const regeneratingJwt = ref(false)
    const saving = reactive({ system: false, site: false })

    function cloneConfig(config) {
      return { ...(config || {}) }
    }

    function isSameValue(left, right) {
      return JSON.stringify(left) === JSON.stringify(right)
    }

    function buildOptionList(namespace, currentConfig, snapshotConfig) {
      const optionList = []
      const current = currentConfig || {}
      const snapshot = snapshotConfig || {}

      for (const [key, value] of Object.entries(current)) {
        if (isSameValue(value, snapshot[key])) {
          continue
        }
        optionList.push({ namespace, key, value })
      }

      return optionList
    }

    async function fetchOptions() {
      const res = await getOptions()
      systemConfig.value = cloneConfig(res.data?.system)
      siteConfig.value = cloneConfig(res.data?.site)
      systemConfigSnapshot.value = cloneConfig(res.data?.system)
      siteConfigSnapshot.value = cloneConfig(res.data?.site)
    }

    const hasSystemChanges = computed(() => {
      return !isSameValue(systemConfig.value, systemConfigSnapshot.value)
    })

    const hasSiteChanges = computed(() => {
      return !isSameValue(siteConfig.value, siteConfigSnapshot.value)
    })

    const hasUnsavedChanges = computed(() => {
      return hasSystemChanges.value || hasSiteChanges.value
    })

    async function saveSystem() {
      saving.system = true
      try {
        const optionList = buildOptionList(
          'system',
          systemConfig.value,
          systemConfigSnapshot.value
        )

        if (optionList.length === 0) {
          ElMessage.info('没有可保存的系统配置更改')
          return
        }

        await updateOptions(optionList)
        await fetchOptions()
        ElMessage.success('系统配置保存成功')
      } catch {
        ElMessage.error('保存失败')
      } finally {
        saving.system = false
      }
    }

    async function saveSite() {
      saving.site = true
      try {
        const optionList = buildOptionList(
          'site',
          siteConfig.value,
          siteConfigSnapshot.value
        )

        if (optionList.length === 0) {
          ElMessage.info('没有可保存的站点配置更改')
          return
        }

        await updateOptions(optionList)
        await fetchOptions()
        ElMessage.success('站点配置保存成功')
      } catch {
        ElMessage.error('保存失败')
      } finally {
        saving.site = false
      }
    }

    async function handleRegenerateJwtSecret() {
      try {
        await ElMessageBox.confirm(
          '重置后所有已登录的后台用户都会被强制退出，是否继续？',
          '确认重置 JWT 密钥',
          {
            type: 'warning',
            confirmButtonText: '确认重置',
            cancelButtonText: '取消'
          }
        )
      } catch {
        return
      }

      regeneratingJwt.value = true
      try {
        await regenerateJwtSecret()
        ElMessage.success('JWT 密钥已重置，请重新登录')
        authStore.logout()
        window.location.href = '/multilingual-admin/login'
      } catch {
        ElMessage.error('JWT 密钥重置失败')
      } finally {
        regeneratingJwt.value = false
      }
    }

    function handleBeforeUnload(event) {
      if (!hasUnsavedChanges.value) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    async function confirmLeave() {
      if (!hasUnsavedChanges.value) {
        return true
      }

      try {
        await ElMessageBox.confirm(
          '当前有未保存的设置更改，离开后将会丢失，是否继续？',
          '未保存的设置',
          {
            type: 'warning',
            confirmButtonText: '继续离开',
            cancelButtonText: '留在当前页'
          }
        )
        return true
      } catch {
        return false
      }
    }

    onBeforeRouteLeave(async () => {
      return confirmLeave()
    })

    onMounted(() => {
      fetchOptions()
      window.addEventListener('beforeunload', handleBeforeUnload)
    })

    onUnmounted(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })

    return {
      activeTab,
      systemConfig,
      siteConfig,
      saving,
      regeneratingJwt,
      hasUnsavedChanges,
      saveSystem,
      saveSite,
      handleRegenerateJwtSecret
    }
  }
}
</script>
