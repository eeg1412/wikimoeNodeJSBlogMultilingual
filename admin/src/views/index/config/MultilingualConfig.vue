<template>
  <div class="common-right-panel-form multilingual-config-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>设置</el-breadcrumb-item>
        <el-breadcrumb-item>多语言站点配置</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-tabs
      v-if="inited"
      v-model="activeLanguage"
      class="language-config-tabs"
    >
      <el-tab-pane
        v-for="item in languageOptions"
        :key="item.value"
        :label="item.label"
        :name="item.value"
        lazy
      >
        <el-form
          class="language-config-form"
          :model="settingsMap[item.value]"
          label-width="180px"
        >
          <div
            v-for="group in fieldGroupOptions"
            :key="group.value"
            class="language-config-group"
          >
            <div class="language-config-group-title">{{ group.label }}</div>
            <el-row :gutter="18">
              <el-col
                v-for="field in getFieldListByGroup(group.value)"
                :key="field.name"
                :xs="24"
                :md="getColumnSpan(field)"
              >
                <el-form-item :label="field.label">
                  <Cropper
                    v-if="isAssetField(field.name)"
                    :src="settingsMap[item.value][field.name]"
                    v-bind="getAssetCropperProps(field.name)"
                    @crop="
                      value => setFieldValue(item.value, field.name, value)
                    "
                  />
                  <RichEditor5Switch
                    v-else-if="isRichContentField(field.name)"
                    v-model:content="settingsMap[item.value][field.name]"
                    v-model:isRichMode="
                      settingsMap[item.value][getRichModeFieldName(field.name)]
                    "
                  />
                  <el-switch
                    v-else-if="field.type === 'boolean'"
                    v-model="settingsMap[item.value][field.name]"
                  />
                  <el-input
                    v-else-if="field.type === 'textarea'"
                    v-model="settingsMap[item.value][field.name]"
                    type="textarea"
                    :rows="4"
                  />
                  <el-input
                    v-else
                    v-model="settingsMap[item.value][field.name]"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <el-form-item class="language-config-actions">
            <el-button @click="getLanguageSettings(false)">刷新</el-button>
            <el-button
              :disabled="item.value === defaultLanguageCode"
              @click="copyDefaultLanguage(item.value)"
            >
              复制简体中文
            </el-button>
            <el-button type="primary" @click="submitLanguage(item.value)">
              保存当前语言
            </el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Cropper from '@/components/Cropper.vue'
import RichEditor5Switch from '@/components/RichEditor5Switch.vue'
import { multilingualApi } from '@/api'
import { SUPPORTED_LANGUAGE_OPTIONS } from '@/utils/multilingual'

const DEFAULT_LANGUAGE_CODE = 'zh-CN'

const FIELD_GROUP_OPTIONS = [
  { label: '站点展示', value: 'site' },
  { label: 'SEO', value: 'seo' },
  { label: '品牌图片', value: 'assets' },
  { label: '分享与页脚', value: 'share' },
  { label: '文章页', value: 'post' }
]

export default {
  name: 'MultilingualConfig',
  components: {
    Cropper,
    RichEditor5Switch
  },
  setup() {
    const activeLanguage = ref(DEFAULT_LANGUAGE_CODE)
    const inited = ref(false)
    const fieldList = ref([])
    const settingsMap = reactive({})
    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS

    function getDefaultValue(field) {
      if (field.type === 'boolean') {
        return Boolean(field.defaultValue)
      }

      if (typeof field.defaultValue === 'undefined') {
        return ''
      }

      return field.defaultValue
    }

    function ensureLanguageForm(languageCode) {
      if (!settingsMap[languageCode]) {
        settingsMap[languageCode] = {}
      }

      fieldList.value.forEach(field => {
        if (typeof settingsMap[languageCode][field.name] === 'undefined') {
          settingsMap[languageCode][field.name] = getDefaultValue(field)
        }
      })
    }

    function applySettingsData(data) {
      fieldList.value = data.fields || []
      languageOptions.forEach(language => {
        ensureLanguageForm(language.value)
        const values = data.settings?.[language.value] || {}
        fieldList.value.forEach(field => {
          if (typeof values[field.name] !== 'undefined') {
            settingsMap[language.value][field.name] = values[field.name]
          }
        })
      })
    }

    function getColumnSpan(field) {
      if (field.type === 'textarea') {
        return 24
      }

      return 12
    }

    function isHiddenRichModeField(fieldName) {
      return [
        'sitePostBlogCommonFooterContentIsRichMode',
        'sitePostTweetCommonFooterContentIsRichMode'
      ].includes(fieldName)
    }

    function getFieldListByGroup(group) {
      return fieldList.value.filter(field => {
        if (field.group !== group) {
          return false
        }

        return !isHiddenRichModeField(field.name)
      })
    }

    function isAssetField(fieldName) {
      return [
        'siteLogo',
        'siteDarkLogo',
        'siteFavicon',
        'siteDefaultCover'
      ].includes(fieldName)
    }

    function getAssetCropperProps(fieldName) {
      if (fieldName === 'siteFavicon') {
        return {
          aspectRatio: 1,
          width: 256,
          height: 256,
          putImageType: 'image/png'
        }
      }

      if (fieldName === 'siteDefaultCover') {
        return {
          aspectRatio: 1344 / 648,
          width: 1344,
          height: 648
        }
      }

      return {
        maxWidth: 1024,
        maxHeight: 1024,
        putImageType: 'image/webp'
      }
    }

    function setFieldValue(languageCode, fieldName, value) {
      settingsMap[languageCode][fieldName] = value
    }

    function isRichContentField(fieldName) {
      return [
        'sitePostBlogCommonFooterContent',
        'sitePostTweetCommonFooterContent'
      ].includes(fieldName)
    }

    function getRichModeFieldName(fieldName) {
      if (fieldName === 'sitePostBlogCommonFooterContent') {
        return 'sitePostBlogCommonFooterContentIsRichMode'
      }

      return 'sitePostTweetCommonFooterContentIsRichMode'
    }

    function getLanguageSettings(noLoading = true) {
      return multilingualApi
        .getLanguageSettings({}, noLoading)
        .then(res => {
          applySettingsData(res.data.data)
        })
        .finally(() => {
          inited.value = true
        })
    }

    function copyDefaultLanguage(languageCode) {
      if (languageCode === DEFAULT_LANGUAGE_CODE) {
        return
      }

      ElMessageBox.confirm('确定复制简体中文配置到当前语言吗？', '复制配置', {
        type: 'warning'
      })
        .then(() => {
          fieldList.value.forEach(field => {
            settingsMap[languageCode][field.name] =
              settingsMap[DEFAULT_LANGUAGE_CODE][field.name]
          })
          ElMessage.success('已复制，请保存当前语言')
        })
        .catch(() => {})
    }

    function submitLanguage(languageCode) {
      const values = {}
      fieldList.value.forEach(field => {
        values[field.name] = settingsMap[languageCode][field.name]
      })

      return multilingualApi
        .updateLanguageSettings({
          languageCode,
          values
        })
        .then(res => {
          const savedValues = res.data.data.values || {}
          Object.keys(savedValues).forEach(name => {
            settingsMap[languageCode][name] = savedValues[name]
          })
          ElMessage.success('保存成功')
        })
    }

    onMounted(() => {
      getLanguageSettings()
    })

    return {
      activeLanguage,
      copyDefaultLanguage,
      defaultLanguageCode: DEFAULT_LANGUAGE_CODE,
      fieldGroupOptions: FIELD_GROUP_OPTIONS,
      fieldList,
      getColumnSpan,
      getFieldListByGroup,
      getAssetCropperProps,
      getRichModeFieldName,
      getLanguageSettings,
      inited,
      isAssetField,
      isRichContentField,
      languageOptions,
      setFieldValue,
      settingsMap,
      submitLanguage
    }
  }
}
</script>

<style scoped>
.multilingual-config-page {
  max-width: 1080px;
}

.language-config-tabs {
  max-width: 1040px;
}

.language-config-form {
  padding-top: 8px;
}

.language-config-group {
  padding: 10px 0 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.language-config-group-title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.language-config-actions {
  margin-top: 22px;
}

@media (max-width: 767px) {
  .multilingual-config-page,
  .language-config-tabs {
    max-width: none;
  }

  :deep(.el-form-item) {
    display: block;
  }

  :deep(.el-form-item__label) {
    width: auto !important;
    justify-content: flex-start;
  }

  :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
