<template>
  <div class="options-page">
    <div class="options-header">
      <h2>站点配置</h2>
      <div class="options-header-actions">
        <el-button @click="reload" :loading="loading">刷新</el-button>
        <el-button type="primary" :loading="saving" @click="save"
          >保存全部</el-button
        >
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="站点信息" name="site">
        <el-form label-width="200px" :model="form">
          <el-form-item label="站点标题">
            <el-input v-model="form.siteTitle" />
          </el-form-item>
          <el-form-item label="副标题">
            <el-input v-model="form.siteSubTitle" />
          </el-form-item>
          <el-form-item label="站点描述">
            <el-input
              v-model="form.siteDescription"
              type="textarea"
              :rows="2"
            />
          </el-form-item>
          <el-form-item label="关键词">
            <el-input v-model="form.siteKeywords" />
          </el-form-item>
          <el-form-item label="站点地址 (siteUrl)">
            <el-input
              v-model="form.siteUrl"
              placeholder="https://example.com"
            />
          </el-form-item>
          <el-form-item label="Logo">
            <el-input v-model="form.siteLogo" />
          </el-form-item>
          <el-form-item label="暗色 Logo">
            <el-input v-model="form.siteDarkLogo" />
          </el-form-item>
          <el-form-item label="Favicon">
            <el-input v-model="form.siteFavicon" />
          </el-form-item>
          <el-form-item label="页脚信息">
            <el-input v-model="form.siteFooterInfo" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="默认语言">
            <el-select v-model="form.siteDefaultLanguageCode">
              <el-option
                v-for="code in site.supportedLanguageCodes"
                :key="code"
                :label="code"
                :value="code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="时区">
            <el-input v-model="form.siteTimeZone" placeholder="Asia/Tokyo" />
          </el-form-item>
          <el-form-item label="每页条数">
            <el-input-number v-model="form.sitePageSize" :min="1" :max="200" />
          </el-form-item>
          <el-form-item label="主题模式">
            <el-select v-model="form.siteThemeMode">
              <el-option label="跟随系统" value="auto" />
              <el-option label="浅色" value="light" />
              <el-option label="深色" value="dark" />
            </el-select>
          </el-form-item>
          <el-form-item label="允许切换主题">
            <el-switch v-model="form.siteAllowSwitchTheme" />
          </el-form-item>
          <el-form-item label="显示站点版本">
            <el-switch v-model="form.siteShowBlogVersion" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="SEO / Sitemap" name="seo">
        <el-form label-width="200px" :model="form">
          <el-form-item label="启用 Sitemap">
            <el-switch v-model="form.siteEnableSitemap" />
          </el-form-item>
          <el-form-item label="robots.txt">
            <el-input v-model="form.siteRobotsTxt" type="textarea" :rows="10" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="谷歌广告" name="ads">
        <el-alert type="info" show-icon :closable="false">
          广告开关和参数变更会立即失效缓存并同步到前台。
        </el-alert>
        <el-form label-width="200px" :model="form" class="options-form-block">
          <el-form-item label="启用谷歌广告">
            <el-switch v-model="form.googleAdEnabled" />
          </el-form-item>
          <el-form-item label="AdSense 发布商 ID">
            <el-input
              v-model="form.googleAdId"
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
            />
          </el-form-item>
          <el-form-item label="文章底部广告位">
            <el-switch v-model="form.googleAdPostBottomEnabled" />
          </el-form-item>
          <el-form-item label="文章底部广告参数 (JSON)">
            <el-input
              v-model="postBottomParamsText"
              type="textarea"
              :rows="6"
              placeholder='例如: {"data-ad-slot":"1234567890","data-ad-format":"auto"}'
            />
            <div v-if="postBottomParamsError" class="options-json-error">
              {{ postBottomParamsError }}
            </div>
          </el-form-item>
          <el-form-item label="ads.txt 内容">
            <el-input v-model="form.AdAdsTxt" type="textarea" :rows="8" />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="AI 翻译" name="translation">
        <el-form label-width="200px" :model="form">
          <el-form-item label="翻译系统提示词">
            <el-input
              v-model="form.translationSystemPrompt"
              type="textarea"
              :rows="6"
            />
          </el-form-item>
          <el-form-item label="HTML 每批最大段数">
            <el-input-number
              v-model="form.translationHtmlBatchMaxSegments"
              :min="1"
              :max="500"
            />
          </el-form-item>
          <el-form-item label="HTML 每批最大字符">
            <el-input-number
              v-model="form.translationHtmlBatchMaxChars"
              :min="100"
              :max="200000"
            />
          </el-form-item>
          <el-form-item label="AI 重试次数">
            <el-input-number
              v-model="form.translationRetryLimit"
              :min="0"
              :max="10"
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="额外注入" name="extra">
        <el-form label-width="200px" :model="form">
          <el-form-item label="额外 CSS">
            <el-input v-model="form.siteExtraCss" type="textarea" :rows="8" />
          </el-form-item>
          <el-form-item label="额外 JS">
            <el-input v-model="form.siteExtraJs" type="textarea" :rows="8" />
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listOptionsApi, updateOptionsApi } from '@/api/options'
import { useSiteStore } from '@/store/site'

const site = useSiteStore()
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('site')
const form = reactive({})
const postBottomParamsText = ref('{}')
const postBottomParamsError = ref('')

function applyOptions(data) {
  Object.keys(data || {}).forEach(k => {
    form[k] = data[k]
  })
  try {
    const val = data.googleAdPostBottomParams || {}
    postBottomParamsText.value = JSON.stringify(val, null, 2)
    postBottomParamsError.value = ''
  } catch (e) {
    postBottomParamsText.value = '{}'
  }
}

watch(postBottomParamsText, text => {
  if (!text || !text.trim()) {
    form.googleAdPostBottomParams = {}
    postBottomParamsError.value = ''
    return
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      form.googleAdPostBottomParams = parsed
      postBottomParamsError.value = ''
    } else {
      postBottomParamsError.value = '必须是 JSON 对象'
    }
  } catch (err) {
    postBottomParamsError.value = 'JSON 解析失败：' + err.message
  }
})

async function reload() {
  loading.value = true
  try {
    const resp = await listOptionsApi()
    if (resp && resp.data) {
      applyOptions(resp.data)
    }
  } catch (err) {
    ElMessage.error(err && err.message ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (postBottomParamsError.value) {
    ElMessage.error('请先修复谷歌广告参数 JSON')
    return
  }
  saving.value = true
  try {
    const updates = {}
    Object.keys(form).forEach(k => {
      updates[k] = form[k]
    })
    const resp = await updateOptionsApi(updates)
    if (resp && resp.data && resp.data.options) {
      applyOptions(resp.data.options)
      site.applyInfo({ options: resp.data.options })
    }
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error(err && err.message ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  reload()
})
</script>

<style scoped>
.options-page {
  max-width: 920px;
}
.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.options-header-actions {
  display: flex;
  gap: 8px;
}
.options-form-block {
  margin-top: 16px;
}
.options-json-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}
</style>
