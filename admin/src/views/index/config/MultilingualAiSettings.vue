<template>
  <div class="common-right-panel-form multilingual-ai-settings-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>AI</el-breadcrumb-item>
        <el-breadcrumb-item>AI 设置</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />
    <el-form v-else :model="settingsForm" label-width="180px">
      <template v-for="group in fieldGroupOptions" :key="group.value">
        <el-divider
          v-if="isImageGenerationSectionStart(group)"
          content-position="left"
          class="ai-settings-section-divider"
        >
          图像生成
        </el-divider>
        <el-divider
          v-if="isImageRecognitionSectionStart(group)"
          content-position="left"
          class="ai-settings-section-divider"
        >
          图像识别
        </el-divider>
        <el-divider
          v-if="isInternetSearchSectionStart(group)"
          content-position="left"
          class="ai-settings-section-divider"
        >
          互联网搜索
        </el-divider>
        <div class="config-border-item ai-settings-group">
          <div class="config-border-item-title mb10">{{ group.label }}</div>
          <el-row :gutter="18">
            <el-col
              v-for="field in getFieldListByGroup(group.value)"
              :key="field.name"
              :xs="24"
              :md="getColumnSpan(field)"
            >
              <el-form-item :label="field.label">
                <el-switch
                  v-if="field.type === 'boolean'"
                  v-model="settingsForm[field.name]"
                />
                <el-input-number
                  v-else-if="field.type === 'number' || field.type === 'float'"
                  v-model="settingsForm[field.name]"
                  controls-position="right"
                  :min="field.min"
                  :max="field.max"
                  :step="getNumberStep(field)"
                  :precision="getNumberPrecision(field)"
                />
                <el-radio-group
                  v-else-if="field.type === 'radio'"
                  v-model="settingsForm[field.name]"
                >
                  <el-radio
                    v-for="option in field.options || []"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </el-radio>
                </el-radio-group>
                <el-select
                  v-else-if="isSelectField(field)"
                  v-model="settingsForm[field.name]"
                  filterable
                  :allow-create="Boolean(field.allowCreate)"
                  default-first-option
                  class="w_10"
                >
                  <el-option
                    v-for="option in field.options || []"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  >
                    <span>{{ option.label }}</span>
                    <span
                      v-if="option.deprecatedAt"
                      class="ai-model-deprecated"
                    >
                      将于 {{ option.deprecatedAt }} 弃用
                    </span>
                    <span v-if="option.tag" class="ai-model-tag">
                      {{ option.tag }}
                    </span>
                  </el-option>
                </el-select>
                <el-input
                  v-else-if="field.type === 'textarea'"
                  v-model="settingsForm[field.name]"
                  type="textarea"
                  :rows="5"
                />
                <div
                  v-else-if="field.type === 'languagePromptMap'"
                  class="language-prompt-list"
                >
                  <div
                    v-for="language in languageOptions"
                    :key="language.value"
                    class="language-prompt-item"
                  >
                    <div class="language-prompt-title">
                      {{ language.label }}
                      <span class="language-prompt-code">
                        {{ language.value }}
                      </span>
                    </div>
                    <el-input
                      v-model="settingsForm[field.name][language.value]"
                      type="textarea"
                      :rows="4"
                    />
                  </div>
                </div>
                <el-input
                  v-else-if="field.type === 'password'"
                  v-model="settingsForm[field.name]"
                  type="password"
                  show-password
                  autocomplete="off"
                />
                <el-input v-else v-model="settingsForm[field.name]" />
                <div v-if="field.helpText" class="ai-field-help">
                  {{ field.helpText }}
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </div>
      </template>

      <el-form-item class="ai-settings-actions">
        <el-button @click="getAiSettings(false)">刷新</el-button>
        <el-button type="primary" :loading="saving" @click="submitAiSettings">
          保存设置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'
import { SUPPORTED_LANGUAGE_OPTIONS } from '@/utils/multilingual'

const FIELD_GROUP_OPTIONS = [
  { label: '服务商', value: 'provider' },
  { label: 'DeepSeek 连接', value: 'deepseek' },
  { label: '模型与输出', value: 'model' },
  { label: '请求控制', value: 'request' },
  { label: '默认提示词', value: 'prompt' },
  { label: '图像生成服务', value: 'imageProvider' },
  { label: 'Gemini 图像生成', value: 'geminiImage' },
  { label: '图像生成请求', value: 'imageRequest' },
  { label: '图像生成提示词', value: 'imagePrompt' },
  { label: '图像识别服务', value: 'imageRecognitionProvider' },
  { label: 'Gemini 图像识别', value: 'geminiImageRecognition' },
  { label: '图像识别请求', value: 'imageRecognitionRequest' },
  { label: '图像识别提示词', value: 'imageRecognitionPrompt' },
  { label: '互联网搜索服务', value: 'internetSearchProvider' },
  { label: 'Gemini 互联网搜索', value: 'geminiInternetSearch' },
  { label: '互联网搜索请求', value: 'internetSearchRequest' }
]

const AI_GATEWAY_FIELD_LIST = [
  {
    name: 'deepSeekUseCloudflareAiGateway',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'deepseek',
    defaultValue: false,
    insertAfter: 'deepSeekApiKey',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发文本翻译请求。'
  },
  {
    name: 'geminiImageCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'imageProvider',
    defaultValue: false,
    insertAfter: 'imageGenerationProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像生成请求。'
  },
  {
    name: 'geminiImageRecognitionCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'imageRecognitionProvider',
    defaultValue: false,
    insertAfter: 'imageRecognitionProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像识别请求。'
  },
  {
    name: 'geminiInternetSearchCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'internetSearchProvider',
    defaultValue: false,
    insertAfter: 'internetSearchProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发互联网搜索请求。'
  }
]

const AI_FIELD_DISPLAY_OVERRIDES = {
  deepSeekApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连模型服务时填写服务商 API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  deepSeekUseCloudflareAiGateway: {
    label: '使用 AI Gateway',
    group: 'deepseek',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发文本翻译请求。'
  },
  deepSeekBaseUrl: {
    label: 'Base URL',
    helpText:
      '直连时填写模型服务地址；使用 AI Gateway 时填写 Cloudflare 的 /compat 地址。'
  },
  geminiImageApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  geminiImageCloudflareAiGatewayEnabled: {
    label: '使用 AI Gateway',
    group: 'imageProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像生成请求。'
  },
  geminiImageBaseUrl: {
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 Cloudflare 的 /google-ai-studio 地址。'
  },
  geminiImageRecognitionApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  geminiImageRecognitionCloudflareAiGatewayEnabled: {
    label: '使用 AI Gateway',
    group: 'imageRecognitionProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像识别请求。'
  },
  geminiImageRecognitionBaseUrl: {
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 Cloudflare 的 /google-ai-studio 地址。'
  },
  geminiInternetSearchApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  geminiInternetSearchCloudflareAiGatewayEnabled: {
    label: '使用 AI Gateway',
    group: 'internetSearchProvider',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发互联网搜索请求。'
  },
  geminiInternetSearchBaseUrl: {
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 Cloudflare 的 /google-ai-studio 地址。'
  }
}

const IMAGE_PROVIDER_GROUP_MAP = {
  gemini: 'geminiImage'
}

const IMAGE_PROVIDER_GROUPS = Object.values(IMAGE_PROVIDER_GROUP_MAP)

const IMAGE_RECOGNITION_PROVIDER_GROUP_MAP = {
  gemini: 'geminiImageRecognition'
}

const IMAGE_RECOGNITION_PROVIDER_GROUPS = Object.values(
  IMAGE_RECOGNITION_PROVIDER_GROUP_MAP
)

const INTERNET_SEARCH_PROVIDER_GROUP_MAP = {
  gemini: 'geminiInternetSearch'
}

const INTERNET_SEARCH_PROVIDER_GROUPS = Object.values(
  INTERNET_SEARCH_PROVIDER_GROUP_MAP
)

export default {
  name: 'MultilingualAiSettings',
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const fieldList = ref([])
    const settingsForm = reactive({})
    const fieldGroupOptions = computed(() => {
      return FIELD_GROUP_OPTIONS.filter(group => isVisibleFieldGroup(group))
    })
    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS

    function getSelectedImageProvider() {
      const provider = String(settingsForm.imageGenerationProvider || '').trim()
      if (
        Object.prototype.hasOwnProperty.call(IMAGE_PROVIDER_GROUP_MAP, provider)
      ) {
        return provider
      }
      return 'gemini'
    }

    function getSelectedImageRecognitionProvider() {
      const provider = String(
        settingsForm.imageRecognitionProvider || ''
      ).trim()
      if (
        Object.prototype.hasOwnProperty.call(
          IMAGE_RECOGNITION_PROVIDER_GROUP_MAP,
          provider
        )
      ) {
        return provider
      }
      return 'gemini'
    }

    function getSelectedInternetSearchProvider() {
      const provider = String(settingsForm.internetSearchProvider || '').trim()
      if (
        Object.prototype.hasOwnProperty.call(
          INTERNET_SEARCH_PROVIDER_GROUP_MAP,
          provider
        )
      ) {
        return provider
      }
      return 'gemini'
    }

    function isImageProviderGroup(groupValue) {
      return IMAGE_PROVIDER_GROUPS.includes(groupValue)
    }

    function isImageRecognitionProviderGroup(groupValue) {
      return IMAGE_RECOGNITION_PROVIDER_GROUPS.includes(groupValue)
    }

    function isInternetSearchProviderGroup(groupValue) {
      return INTERNET_SEARCH_PROVIDER_GROUPS.includes(groupValue)
    }

    function isVisibleFieldGroup(group) {
      if (!group) {
        return true
      }

      if (isImageProviderGroup(group.value)) {
        const provider = getSelectedImageProvider()
        return IMAGE_PROVIDER_GROUP_MAP[provider] === group.value
      }

      if (isImageRecognitionProviderGroup(group.value)) {
        const provider = getSelectedImageRecognitionProvider()
        return IMAGE_RECOGNITION_PROVIDER_GROUP_MAP[provider] === group.value
      }

      if (isInternetSearchProviderGroup(group.value)) {
        const provider = getSelectedInternetSearchProvider()
        return INTERNET_SEARCH_PROVIDER_GROUP_MAP[provider] === group.value
      }

      return true
    }

    function isImageGenerationSectionStart(group) {
      return group && group.value === 'imageProvider'
    }

    function isImageRecognitionSectionStart(group) {
      return group && group.value === 'imageRecognitionProvider'
    }

    function isInternetSearchSectionStart(group) {
      return group && group.value === 'internetSearchProvider'
    }

    function getDefaultValue(field) {
      if (field.type === 'boolean') {
        return Boolean(field.defaultValue)
      }
      if (field.type === 'languagePromptMap') {
        const promptMap = {}
        languageOptions.forEach(language => {
          promptMap[language.value] = field.defaultValue?.[language.value] || ''
        })
        return promptMap
      }
      if (typeof field.defaultValue === 'undefined') {
        return ''
      }
      return field.defaultValue
    }

    function ensureFormFields() {
      fieldList.value.forEach(field => {
        if (typeof settingsForm[field.name] === 'undefined') {
          settingsForm[field.name] = getDefaultValue(field)
        }
      })
    }

    function buildDisplayField(field) {
      const displayField = { ...field }
      const displayOverride = AI_FIELD_DISPLAY_OVERRIDES[displayField.name]
      if (displayOverride) {
        Object.assign(displayField, displayOverride)
      }
      delete displayField.insertAfter
      return displayField
    }

    function mergeAiGatewayFields(apiFields) {
      let apiFieldList = []
      if (Array.isArray(apiFields)) {
        apiFieldList = apiFields
      }

      const apiFieldNames = new Set(apiFieldList.map(field => field.name))
      const insertedFieldNames = new Set()
      const mergedFields = []

      apiFieldList.forEach(field => {
        mergedFields.push(buildDisplayField(field))
        AI_GATEWAY_FIELD_LIST.forEach(localField => {
          if (apiFieldNames.has(localField.name)) {
            return
          }
          if (insertedFieldNames.has(localField.name)) {
            return
          }
          if (localField.insertAfter !== field.name) {
            return
          }
          mergedFields.push(buildDisplayField(localField))
          insertedFieldNames.add(localField.name)
        })
      })

      AI_GATEWAY_FIELD_LIST.forEach(localField => {
        if (apiFieldNames.has(localField.name)) {
          return
        }
        if (insertedFieldNames.has(localField.name)) {
          return
        }
        mergedFields.push(buildDisplayField(localField))
      })

      return mergedFields
    }

    function applySettingsData(data) {
      fieldList.value = mergeAiGatewayFields(data.fields)
      ensureFormFields()
      const values = data.values || {}
      fieldList.value.forEach(field => {
        if (typeof values[field.name] !== 'undefined') {
          if (field.type === 'languagePromptMap') {
            settingsForm[field.name] = {
              ...getDefaultValue(field),
              ...(values[field.name] || {})
            }
            return
          }
          settingsForm[field.name] = values[field.name]
        }
      })
    }

    function getFieldListByGroup(group) {
      return fieldList.value.filter(field => {
        if (field.hiddenInSettings === true) {
          return false
        }
        return field.group === group
      })
    }

    function getColumnSpan(field) {
      if (field.type === 'textarea' || field.type === 'languagePromptMap') {
        return 24
      }
      return 12
    }

    function isSelectField(field) {
      return field.type === 'select' || field.type === 'modelSelect'
    }

    function getNumberStep(field) {
      if (field.step) {
        return field.step
      }
      if (field.type === 'float') {
        return 0.1
      }
      return 1
    }

    function getNumberPrecision(field) {
      if (Number.isInteger(field.precision)) {
        return field.precision
      }
      if (field.type === 'float') {
        return 2
      }
      return 0
    }

    function getAiSettings(noLoading = true) {
      loading.value = !noLoading
      return multilingualApi
        .getAiSettings({}, noLoading)
        .then(response => {
          applySettingsData(response.data.data || {})
        })
        .finally(() => {
          loading.value = false
        })
    }

    function submitAiSettings() {
      const values = {}
      fieldList.value.forEach(field => {
        values[field.name] = settingsForm[field.name]
      })

      saving.value = true
      multilingualApi
        .updateAiSettings({ values })
        .then(response => {
          applySettingsData(response.data.data || {})
          ElMessage.success('AI 设置已保存')
        })
        .finally(() => {
          saving.value = false
        })
    }

    onMounted(() => {
      getAiSettings(false)
    })

    return {
      fieldGroupOptions,
      fieldList,
      getAiSettings,
      getColumnSpan,
      getFieldListByGroup,
      isImageGenerationSectionStart,
      isImageRecognitionSectionStart,
      isInternetSearchSectionStart,
      getNumberPrecision,
      getNumberStep,
      isSelectField,
      languageOptions,
      loading,
      saving,
      settingsForm,
      submitAiSettings
    }
  }
}
</script>

<style scoped>
.multilingual-ai-settings-page {
  max-width: 980px;
}

.ai-settings-group {
  margin-bottom: 18px;
}

.ai-settings-section-divider {
  margin: 8px 0 22px;
}

.ai-settings-actions {
  margin-top: 18px;
}

.ai-model-deprecated {
  float: right;
  margin-left: 12px;
  color: var(--el-color-warning);
  font-size: 12px;
}

.ai-model-tag {
  float: right;
  margin-left: 12px;
  color: var(--el-color-primary);
  font-size: 12px;
  text-transform: uppercase;
}

.ai-field-help {
  width: 100%;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.language-prompt-list {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.language-prompt-item {
  min-width: 0;
}

.language-prompt-title {
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.language-prompt-code {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}

@media (max-width: 767px) {
  .multilingual-ai-settings-page {
    max-width: none;
  }

  .language-prompt-list {
    grid-template-columns: 1fr;
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
