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
      <div
        v-for="section in sectionList"
        :key="section.key"
        class="config-border-item ai-settings-section"
      >
        <div class="config-border-item-title mb10">{{ section.title }}</div>
        <div v-if="section.description" class="ai-section-description">
          {{ section.description }}
        </div>
        <div
          v-for="group in section.groups"
          :key="group.value"
          class="ai-settings-group"
        >
          <div class="ai-settings-group-title">{{ group.label }}</div>
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
                  class="ai-radio-group"
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
      </div>

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

function buildLocalLanguagePromptMap() {
  return SUPPORTED_LANGUAGE_OPTIONS.reduce((result, language) => {
    result[language.value] = ''
    return result
  }, {})
}

const TEXT_WORKFLOW_CONFIGS = [
  { key: 'mainTranslation' },
  { key: 'properNounPreprocess' },
  { key: 'properNounKnowledge' }
]

const TEXT_WORKFLOW_GROUP_LABEL_MAP = TEXT_WORKFLOW_CONFIGS.reduce(
  (result, workflow) => {
    result[`${workflow.key}Deepseek`] = 'DeepSeek 连接'
    result[`${workflow.key}DeepseekModel`] = 'DeepSeek 模型与输出'
    result[`${workflow.key}DeepseekRequest`] = 'DeepSeek 请求控制'
    result[`${workflow.key}GeminiText`] = 'Gemini 连接'
    result[`${workflow.key}GeminiTextRequest`] = 'Gemini 请求控制'
    return result
  },
  {}
)

function buildLocalTextWorkflowProviderFields(docs = {}) {
  const deepSeekModelOptions = docs.modelOptions || []
  const geminiTextDocs = docs.geminiText || {}
  const geminiModelOptions = geminiTextDocs.geminiModelOptions || []
  const geminiThinkingLevelOptions =
    geminiTextDocs.geminiThinkingLevelOptions || []

  return TEXT_WORKFLOW_CONFIGS.flatMap(workflow => {
    const groupPrefix = workflow.key
    return [
      {
        name: `${groupPrefix}DeepSeekApiKey`,
        label: 'API Key / Token',
        type: 'password',
        group: `${groupPrefix}Deepseek`,
        defaultValue: ''
      },
      {
        name: `${groupPrefix}DeepSeekUseCloudflareAiGateway`,
        label: '使用 AI Gateway',
        type: 'boolean',
        group: `${groupPrefix}Deepseek`,
        defaultValue: false
      },
      {
        name: `${groupPrefix}DeepSeekBaseUrl`,
        label: '服务地址',
        type: 'string',
        group: `${groupPrefix}Deepseek`,
        defaultValue: 'https://api.deepseek.com'
      },
      {
        name: `${groupPrefix}DeepSeekModel`,
        label: '模型',
        type: 'modelSelect',
        group: `${groupPrefix}DeepseekModel`,
        defaultValue: 'deepseek-v4-flash',
        allowCreate: true,
        options: deepSeekModelOptions
      },
      {
        name: `${groupPrefix}DeepSeekThinkingType`,
        label: '思考模式',
        type: 'radio',
        group: `${groupPrefix}DeepseekModel`,
        defaultValue: 'disabled',
        options: [
          { label: '关闭', value: 'disabled' },
          { label: '开启', value: 'enabled' }
        ]
      },
      {
        name: `${groupPrefix}DeepSeekReasoningEffort`,
        label: '思考强度',
        type: 'radio',
        group: `${groupPrefix}DeepseekModel`,
        defaultValue: 'high',
        options: [
          { label: 'High', value: 'high' },
          { label: 'Max', value: 'max' }
        ]
      },
      {
        name: `${groupPrefix}DeepSeekTemperature`,
        label: 'Temperature',
        type: 'float',
        group: `${groupPrefix}DeepseekModel`,
        defaultValue: 0.2,
        min: 0,
        max: 2,
        step: 0.1,
        precision: 2
      },
      {
        name: `${groupPrefix}DeepSeekMaxTokens`,
        label: '最大输出 Token',
        type: 'number',
        group: `${groupPrefix}DeepseekModel`,
        defaultValue: 8192,
        min: 256,
        max: 384000
      },
      {
        name: `${groupPrefix}DeepSeekTimeoutSeconds`,
        label: '请求超时',
        type: 'number',
        group: `${groupPrefix}DeepseekRequest`,
        defaultValue: 300,
        min: 10,
        max: 600
      },
      {
        name: `${groupPrefix}GeminiTextApiKey`,
        label: 'API Key / Token',
        type: 'password',
        group: `${groupPrefix}GeminiText`,
        defaultValue: ''
      },
      {
        name: `${groupPrefix}GeminiTextCloudflareAiGatewayEnabled`,
        label: '使用 AI Gateway',
        type: 'boolean',
        group: `${groupPrefix}GeminiText`,
        defaultValue: false
      },
      {
        name: `${groupPrefix}GeminiTextBaseUrl`,
        label: '服务地址',
        type: 'string',
        group: `${groupPrefix}GeminiText`,
        defaultValue: 'https://generativelanguage.googleapis.com/v1beta'
      },
      {
        name: `${groupPrefix}GeminiTextModel`,
        label: '模型',
        type: 'modelSelect',
        group: `${groupPrefix}GeminiText`,
        defaultValue: 'gemini-3.1-flash-lite',
        allowCreate: true,
        options: geminiModelOptions
      },
      {
        name: `${groupPrefix}GeminiTextThinkingLevel`,
        label: 'Gemini 思考深度',
        type: 'radio',
        group: `${groupPrefix}GeminiText`,
        defaultValue: 'default',
        options: geminiThinkingLevelOptions
      },
      {
        name: `${groupPrefix}GeminiTextTemperature`,
        label: 'Temperature',
        type: 'float',
        group: `${groupPrefix}GeminiTextRequest`,
        defaultValue: 0.2,
        min: 0,
        max: 2,
        step: 0.1,
        precision: 2
      },
      {
        name: `${groupPrefix}GeminiTextMaxOutputTokens`,
        label: '最大输出 Token',
        type: 'number',
        group: `${groupPrefix}GeminiTextRequest`,
        defaultValue: 8192,
        min: 256,
        max: 65536
      },
      {
        name: `${groupPrefix}GeminiTextTimeoutSeconds`,
        label: '请求超时',
        type: 'number',
        group: `${groupPrefix}GeminiTextRequest`,
        defaultValue: 300,
        min: 10,
        max: 600
      }
    ]
  })
}

const FIELD_GROUP_LABEL_MAP = {
  ...TEXT_WORKFLOW_GROUP_LABEL_MAP,
  mainTranslationWorkflow: '选择 Provider',
  mainTranslationPrompt: '提示词',
  properNounPreprocessWorkflow: '选择 Provider',
  properNounPreprocessPrompt: '提示词',
  properNounKnowledgeWorkflow: '选择 Provider',
  properNounKnowledgePrompt: '提示词',
  internetSearchProvider: '选择 Provider',
  internetSearchPrompt: '提示词',
  geminiInternetSearch: 'Gemini 连接',
  internetSearchRequest: 'Gemini 请求控制',
  imageRecognitionProvider: '选择 Provider',
  geminiImageRecognition: 'Gemini 连接',
  imageRecognitionRequest: 'Gemini 请求控制',
  imageRecognitionPrompt: '提示词',
  imageProvider: '选择 Provider',
  geminiImage: 'Gemini 连接',
  imageRequest: 'Gemini 请求控制',
  imagePrompt: '提示词'
}

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

const WORKFLOW_PROMPT_FIELD_LIST = [
  {
    name: 'properNounPreprocessDefaultPrompt',
    label: '默认提示词',
    type: 'textarea',
    group: 'properNounPreprocessPrompt',
    defaultValue: ''
  },
  {
    name: 'properNounPreprocessLanguagePrompts',
    label: '按目标语言提示词',
    type: 'languagePromptMap',
    group: 'properNounPreprocessPrompt',
    defaultValue: buildLocalLanguagePromptMap()
  },
  {
    name: 'properNounKnowledgeDefaultPrompt',
    label: '默认提示词',
    type: 'textarea',
    group: 'properNounKnowledgePrompt',
    defaultValue: ''
  },
  {
    name: 'properNounKnowledgeLanguagePrompts',
    label: '按目标语言提示词',
    type: 'languagePromptMap',
    group: 'properNounKnowledgePrompt',
    defaultValue: buildLocalLanguagePromptMap()
  },
  {
    name: 'internetSearchDefaultPrompt',
    label: '默认提示词',
    type: 'textarea',
    group: 'internetSearchPrompt',
    defaultValue: ''
  },
  {
    name: 'internetSearchLanguagePrompts',
    label: '按目标语言提示词',
    type: 'languagePromptMap',
    group: 'internetSearchPrompt',
    defaultValue: buildLocalLanguagePromptMap()
  },
  {
    name: 'imageRecognitionDefaultPrompt',
    label: '默认提示词',
    type: 'textarea',
    group: 'imageRecognitionPrompt',
    defaultValue: ''
  },
  {
    name: 'imageRecognitionLanguagePrompts',
    label: '按目标语言提示词',
    type: 'languagePromptMap',
    group: 'imageRecognitionPrompt',
    defaultValue: buildLocalLanguagePromptMap()
  },
  {
    name: 'imageGenerationDefaultPrompt',
    label: '默认提示词',
    type: 'textarea',
    group: 'imagePrompt',
    defaultValue: ''
  },
  {
    name: 'imageGenerationLanguagePrompts',
    label: '按目标语言提示词',
    type: 'languagePromptMap',
    group: 'imagePrompt',
    defaultValue: buildLocalLanguagePromptMap()
  }
]

const AI_FIELD_DISPLAY_OVERRIDES = {
  deepSeekApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连模型服务时填写服务商 API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  mainTranslationProvider: {
    label: '选择 Provider'
  },
  properNounPreprocessProvider: {
    label: '选择 Provider'
  },
  properNounKnowledgeProvider: {
    label: '选择 Provider'
  },
  internetSearchProvider: {
    label: '选择 Provider'
  },
  imageGenerationProvider: {
    label: '选择 Provider'
  },
  imageRecognitionProvider: {
    label: '选择 Provider'
  },
  deepSeekUseCloudflareAiGateway: {
    label: '使用 AI Gateway',
    group: 'deepseek',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发文本翻译请求。'
  },
  deepSeekEnabled: {
    label: '启用 DeepSeek',
    hiddenInSettings: true
  },
  deepSeekBaseUrl: {
    label: '服务地址',
    helpText:
      '直连时填写模型服务地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat。'
  },
  deepSeekModel: {
    label: '模型'
  },
  deepSeekMaxTokens: {
    label: '最大输出 Token'
  },
  deepSeekTimeoutSeconds: {
    label: '请求超时'
  },
  mainTranslationDefaultPrompt: {
    label: '默认提示词'
  },
  mainTranslationLanguagePrompts: {
    label: '按目标语言提示词'
  },
  properNounPreprocessDefaultPrompt: {
    label: '默认提示词'
  },
  properNounPreprocessLanguagePrompts: {
    label: '按目标语言提示词'
  },
  properNounKnowledgeDefaultPrompt: {
    label: '默认提示词'
  },
  properNounKnowledgeLanguagePrompts: {
    label: '按目标语言提示词'
  },
  geminiTextApiKey: {
    label: 'API Key / Token',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  geminiTextCloudflareAiGatewayEnabled: {
    label: '使用 AI Gateway',
    group: 'geminiText',
    helpText: '开启后，通过 Cloudflare AI Gateway 转发 Gemini 文本请求。'
  },
  geminiTextBaseUrl: {
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
  },
  geminiTextModel: {
    label: '模型'
  },
  geminiTextMaxOutputTokens: {
    label: '最大输出 Token'
  },
  geminiTextTimeoutSeconds: {
    label: '请求超时'
  },
  internetSearchDefaultPrompt: {
    label: '默认提示词'
  },
  internetSearchLanguagePrompts: {
    label: '按目标语言提示词'
  },
  imageGenerationDefaultPrompt: {
    label: '默认提示词'
  },
  imageGenerationLanguagePrompts: {
    label: '按目标语言提示词'
  },
  imageRecognitionDefaultPrompt: {
    label: '默认提示词'
  },
  imageRecognitionLanguagePrompts: {
    label: '按目标语言提示词'
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
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
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
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
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
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
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

const TEXT_WORKFLOW_PROVIDER_GROUP_MAP = {
  mainTranslation: {
    deepseek: [
      'mainTranslationDeepseek',
      'mainTranslationDeepseekModel',
      'mainTranslationDeepseekRequest'
    ],
    gemini: ['mainTranslationGeminiText', 'mainTranslationGeminiTextRequest']
  },
  properNounPreprocess: {
    deepseek: [
      'properNounPreprocessDeepseek',
      'properNounPreprocessDeepseekModel',
      'properNounPreprocessDeepseekRequest'
    ],
    gemini: [
      'properNounPreprocessGeminiText',
      'properNounPreprocessGeminiTextRequest'
    ]
  },
  properNounKnowledge: {
    deepseek: [
      'properNounKnowledgeDeepseek',
      'properNounKnowledgeDeepseekModel',
      'properNounKnowledgeDeepseekRequest'
    ],
    gemini: [
      'properNounKnowledgeGeminiText',
      'properNounKnowledgeGeminiTextRequest'
    ]
  }
}

export default {
  name: 'MultilingualAiSettings',
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const fieldList = ref([])
    const settingsDocs = ref({})
    const settingsForm = reactive({})
    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS

    function getSelectedImageProvider() {
      const provider = String(settingsForm.imageGenerationProvider || '').trim()
      if (
        Object.prototype.hasOwnProperty.call(IMAGE_PROVIDER_GROUP_MAP, provider)
      ) {
        return provider
      }
      return ''
    }

    function normalizeTextProvider(provider) {
      const normalizedProvider = String(provider || '')
        .trim()
        .toLowerCase()
      if (
        normalizedProvider === 'deepseek' ||
        normalizedProvider === 'gemini'
      ) {
        return normalizedProvider
      }
      return ''
    }

    function getSelectedMainTranslationProvider() {
      return normalizeTextProvider(settingsForm.mainTranslationProvider)
    }

    function getSelectedProperNounPreprocessProvider() {
      return normalizeTextProvider(settingsForm.properNounPreprocessProvider)
    }

    function getSelectedProperNounKnowledgeProvider() {
      return normalizeTextProvider(settingsForm.properNounKnowledgeProvider)
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
      return ''
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
      return ''
    }

    function buildSectionGroups(groupValues = []) {
      const seenGroups = new Set()
      return groupValues
        .filter(groupValue => {
          if (!groupValue || seenGroups.has(groupValue)) {
            return false
          }
          seenGroups.add(groupValue)
          return getFieldListByGroup(groupValue).length > 0
        })
        .map(groupValue => {
          return {
            value: groupValue,
            label: FIELD_GROUP_LABEL_MAP[groupValue] || groupValue
          }
        })
    }

    function getTextWorkflowProviderGroups(workflowKey, provider) {
      const normalizedProvider = normalizeTextProvider(provider)
      const workflowGroupMap =
        TEXT_WORKFLOW_PROVIDER_GROUP_MAP[workflowKey] || {}
      return workflowGroupMap[normalizedProvider] || []
    }

    function getImageProviderGroups(provider) {
      const groupValue = IMAGE_PROVIDER_GROUP_MAP[provider]
      if (!groupValue) {
        return []
      }
      return [groupValue]
    }

    function getImageRecognitionProviderGroups(provider) {
      const groupValue = IMAGE_RECOGNITION_PROVIDER_GROUP_MAP[provider]
      if (!groupValue) {
        return []
      }
      return [groupValue]
    }

    function getInternetSearchProviderGroups(provider) {
      const groupValue = INTERNET_SEARCH_PROVIDER_GROUP_MAP[provider]
      if (!groupValue) {
        return []
      }
      return [groupValue]
    }

    const sectionList = computed(() => {
      return [
        {
          key: 'mainTranslation',
          title: '主翻译 AI',
          description:
            '用于正文与内容主翻译。先选 provider，再配置该 provider 的模型和请求参数。',
          groups: buildSectionGroups([
            'mainTranslationWorkflow',
            ...getTextWorkflowProviderGroups(
              'mainTranslation',
              getSelectedMainTranslationProvider()
            ),
            'mainTranslationPrompt'
          ])
        },
        {
          key: 'properNounPreprocess',
          title: '专有名词预处理 AI',
          description: '用于从原文中抽取候选专有名词、筛掉已有词库命中项。',
          groups: buildSectionGroups([
            'properNounPreprocessWorkflow',
            ...getTextWorkflowProviderGroups(
              'properNounPreprocess',
              getSelectedProperNounPreprocessProvider()
            ),
            'properNounPreprocessPrompt'
          ])
        },
        {
          key: 'properNounKnowledge',
          title: '专有名词本地知识库查询 AI',
          description:
            '用于先走本地知识库语义整理，判断哪些语言还需要联网补充。',
          groups: buildSectionGroups([
            'properNounKnowledgeWorkflow',
            ...getTextWorkflowProviderGroups(
              'properNounKnowledge',
              getSelectedProperNounKnowledgeProvider()
            ),
            'properNounKnowledgePrompt'
          ])
        },
        {
          key: 'internetSearch',
          title: '专有名词联网搜索 AI',
          description: '用于补齐本地知识库未确认的译名，目前仅支持 Gemini。',
          groups: buildSectionGroups([
            'internetSearchProvider',
            ...getInternetSearchProviderGroups(
              getSelectedInternetSearchProvider()
            ),
            'internetSearchRequest',
            'internetSearchPrompt'
          ])
        },
        {
          key: 'imageRecognition',
          title: '图片识别 AI',
          description: '用于识别封面图中的文字和主题，目前仅支持 Gemini。',
          groups: buildSectionGroups([
            'imageRecognitionProvider',
            ...getImageRecognitionProviderGroups(
              getSelectedImageRecognitionProvider()
            ),
            'imageRecognitionRequest',
            'imageRecognitionPrompt'
          ])
        },
        {
          key: 'imageGeneration',
          title: '图片生成 AI',
          description: '用于生成目标语言封面图，目前仅支持 Gemini。',
          groups: buildSectionGroups([
            'imageProvider',
            ...getImageProviderGroups(getSelectedImageProvider()),
            'imageRequest',
            'imagePrompt'
          ])
        }
      ].filter(section => section.groups.length > 0)
    })

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

    function getLocalFieldList() {
      return AI_GATEWAY_FIELD_LIST.concat(WORKFLOW_PROMPT_FIELD_LIST).concat(
        buildLocalTextWorkflowProviderFields(settingsDocs.value)
      )
    }

    function mergeLocalFields(apiFields) {
      let apiFieldList = []
      if (Array.isArray(apiFields)) {
        apiFieldList = apiFields
      }

      const localFieldList = getLocalFieldList()

      const apiFieldNames = new Set(apiFieldList.map(field => field.name))
      const insertedFieldNames = new Set()
      const mergedFields = []

      apiFieldList.forEach(field => {
        mergedFields.push(buildDisplayField(field))
        localFieldList.forEach(localField => {
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

      localFieldList.forEach(localField => {
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
      settingsDocs.value = data.docs || {}
      fieldList.value = mergeLocalFields(data.fields)
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
      fieldList,
      getAiSettings,
      getColumnSpan,
      getFieldListByGroup,
      getNumberPrecision,
      getNumberStep,
      isSelectField,
      languageOptions,
      loading,
      sectionList,
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

.ai-settings-section {
  margin-bottom: 18px;
}

.ai-section-description {
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.ai-settings-group {
  margin-bottom: 18px;
}

.ai-settings-group:last-child {
  margin-bottom: 0;
}

.ai-settings-group-title {
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
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
  overflow-wrap: anywhere;
  word-break: break-all;
}

.ai-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
}

:deep(.ai-radio-group .el-radio) {
  margin-right: 0;
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
