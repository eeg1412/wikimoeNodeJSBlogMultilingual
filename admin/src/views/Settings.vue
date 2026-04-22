<template>
  <div>
    <h2 class="text-xl font-bold mb-6">系统设置</h2>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="系统配置" name="system">
        <el-card v-if="systemConfig">
          <el-form
            :model="systemConfig"
            label-position="top"
            label-width="200px"
          >
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
                >保存系统配置</el-button
              >
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="站点配置" name="site">
        <el-card v-if="siteConfig">
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
              <el-button type="primary" :loading="saving.site" @click="saveSite"
                >保存站点配置</el-button
              >
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { getOptions, updateOption } from '../api/option.js'
import { ElMessage } from 'element-plus'

export default {
  name: 'Settings',
  setup() {
    const activeTab = ref('system')
    const systemConfig = ref(null)
    const siteConfig = ref(null)
    const saving = reactive({ system: false, site: false })

    async function fetchOptions() {
      const res = await getOptions()
      systemConfig.value = { ...res.data?.system }
      siteConfig.value = { ...res.data?.site }
    }

    async function saveSystem() {
      saving.system = true
      try {
        const payload = { ...systemConfig.value }
        // 不发送脱敏 key（后端识别 '***' 则跳过更新）
        for (const [key, value] of Object.entries(payload)) {
          await updateOption({ namespace: 'system', key, value })
        }
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
        const payload = { ...siteConfig.value }
        for (const [key, value] of Object.entries(payload)) {
          await updateOption({ namespace: 'site', key, value })
        }
        ElMessage.success('站点配置保存成功')
      } catch {
        ElMessage.error('保存失败')
      } finally {
        saving.site = false
      }
    }

    onMounted(fetchOptions)
    return { activeTab, systemConfig, siteConfig, saving, saveSystem, saveSite }
  }
}
</script>
