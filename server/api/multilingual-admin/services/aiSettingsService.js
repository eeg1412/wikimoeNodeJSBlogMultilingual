const {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const OPTION_SCOPE = 'multilingualAi'

const AI_PROVIDER_OPTIONS = [{ label: 'DeepSeek', value: 'deepseek' }]

const IMAGE_GENERATION_PROVIDER_OPTIONS = [{ label: 'Gemini', value: 'gemini' }]

const IMAGE_RECOGNITION_PROVIDER_OPTIONS = [
  { label: 'Gemini', value: 'gemini' }
]

const INTERNET_SEARCH_PROVIDER_OPTIONS = [{ label: 'Gemini', value: 'gemini' }]

const DEEPSEEK_MODEL_OPTIONS = [
  {
    label: 'DeepSeek V4 Flash',
    value: 'deepseek-v4-flash',
    supportsJsonOutput: true,
    supportsThinking: true
  },
  {
    label: 'DeepSeek V4 Pro',
    value: 'deepseek-v4-pro',
    supportsJsonOutput: true,
    supportsThinking: true
  },
  {
    label: 'DeepSeek Chat（兼容名，2026-07-24 后弃用）',
    value: 'deepseek-chat',
    supportsJsonOutput: true,
    supportsThinking: false,
    deprecatedAt: '2026-07-24'
  },
  {
    label: 'DeepSeek Reasoner（兼容名，2026-07-24 后弃用）',
    value: 'deepseek-reasoner',
    supportsJsonOutput: true,
    supportsThinking: true,
    deprecatedAt: '2026-07-24'
  }
]

const GEMINI_IMAGE_GENERATION_MODEL_OPTIONS = [
  {
    label: 'Gemini 3.1 Flash Image Preview（最新）',
    value: 'gemini-3.1-flash-image-preview',
    tag: 'preview'
  },
  {
    label: 'Gemini 3 Pro Image Preview',
    value: 'gemini-3-pro-image-preview',
    tag: 'preview'
  },
  {
    label: 'Gemini 2.5 Flash Image',
    value: 'gemini-2.5-flash-image'
  }
]

const GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS = [
  {
    label: 'Gemini 3.1 Pro Preview（高精度）',
    value: 'gemini-3.1-pro-preview',
    tag: 'preview'
  },
  {
    label: 'Gemini 3 Flash Preview',
    value: 'gemini-3-flash-preview'
  },
  {
    label: 'Gemini 2.5 Pro',
    value: 'gemini-2.5-pro'
  },
  {
    label: 'Gemini 2.5 Flash',
    value: 'gemini-2.5-flash'
  }
]

const GEMINI_INTERNET_SEARCH_MODEL_OPTIONS = [
  {
    label: 'Gemini 3 Flash Preview（Google Search 示例模型）',
    value: 'gemini-3-flash-preview',
    tag: 'preview'
  },
  {
    label: 'Gemini 3.1 Flash-Lite（稳定）',
    value: 'gemini-3.1-flash-lite'
  },
  {
    label: 'Gemini 2.5 Flash',
    value: 'gemini-2.5-flash'
  },
  {
    label: 'Gemini 2.5 Pro',
    value: 'gemini-2.5-pro'
  },
  {
    label: 'Gemini 2.5 Flash-Lite',
    value: 'gemini-2.5-flash-lite'
  }
]

const GEMINI_IMAGE_ASPECT_RATIO_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '21:9', value: '21:9' }
]

const GEMINI_IMAGE_SIZE_OPTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' }
]

const GEMINI_MEDIA_RESOLUTION_OPTIONS = [
  { label: 'High（推荐）', value: 'MEDIA_RESOLUTION_HIGH' },
  { label: 'Medium', value: 'MEDIA_RESOLUTION_MEDIUM' },
  { label: 'Low', value: 'MEDIA_RESOLUTION_LOW' },
  { label: 'Unspecified', value: 'MEDIA_RESOLUTION_UNSPECIFIED' }
]

const GEMINI_THINKING_LEVEL_DEFAULT = 'default'

const GEMINI_THINKING_LEVEL_OPTIONS = [
  { label: '默认（模型默认）', value: GEMINI_THINKING_LEVEL_DEFAULT },
  { label: 'Minimal（最低延迟）', value: 'minimal' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High（最高推理）', value: 'high' }
]

const GEMINI_THINKING_LEVEL_VALUES = new Set(
  GEMINI_THINKING_LEVEL_OPTIONS.map(option => option.value)
)

const DEFAULT_IMAGE_RECOGNITION_PROMPT = [
  '你是图像识别助手。',
  '根据服务端提供的具体任务要求识别图片内容。',
  '只描述图片中可以直接观察到的信息，不猜测不可见内容。',
  '如果任务要求结构化输出，必须严格遵守任务附加的 JSON schema。',
  '当证据不足时明确标记不确定，不要用兜底结论替代判断。'
].join('\n')

const LEGACY_AI_SETTING_MIGRATIONS = {
  nanoBananaApiKey: 'geminiImageApiKey',
  nanoBananaBaseUrl: 'geminiImageBaseUrl',
  nanoBananaModel: 'geminiImageModel',
  nanoBananaAspectRatio: 'geminiImageAspectRatio',
  nanoBananaImageSize: 'geminiImageSize'
}

function buildGeminiThinkingLevelField(name, group) {
  return {
    name,
    label: 'Gemini 思考深度',
    type: 'radio',
    group,
    defaultValue: GEMINI_THINKING_LEVEL_DEFAULT,
    options: GEMINI_THINKING_LEVEL_OPTIONS,
    helpText:
      'Gemini 3 系列会发送 thinkingConfig.thinkingLevel；Gemini 3 Pro 不支持 Minimal，Gemini 2.5 系列不支持 thinkingLevel，请保持默认。'
  }
}

const AI_SETTING_FIELDS = [
  {
    name: 'aiProvider',
    label: 'AI 服务商',
    type: 'select',
    group: 'provider',
    defaultValue: 'deepseek',
    options: AI_PROVIDER_OPTIONS
  },
  {
    name: 'deepSeekEnabled',
    label: '启用 DeepSeek',
    type: 'boolean',
    group: 'deepseek',
    defaultValue: false
  },
  {
    name: 'deepSeekApiKey',
    label: 'API Key / Token',
    type: 'password',
    group: 'deepseek',
    defaultValue: '',
    helpText:
      '直连模型服务时填写服务商 API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  {
    name: 'deepSeekUseCloudflareAiGateway',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'deepseek',
    defaultValue: false,
    helpText: '开启后，通过 Cloudflare AI Gateway 转发文本翻译请求。'
  },
  {
    name: 'deepSeekBaseUrl',
    label: 'Base URL',
    type: 'string',
    group: 'deepseek',
    defaultValue: 'https://api.deepseek.com',
    helpText:
      '直连时填写模型服务地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat。'
  },
  {
    name: 'deepSeekModel',
    label: '模型',
    type: 'modelSelect',
    group: 'model',
    defaultValue: 'deepseek-v4-flash',
    allowCreate: true,
    options: DEEPSEEK_MODEL_OPTIONS
  },
  {
    name: 'deepSeekThinkingType',
    label: '思考模式',
    type: 'radio',
    group: 'model',
    defaultValue: 'disabled',
    options: [
      { label: '关闭', value: 'disabled' },
      { label: '开启', value: 'enabled' }
    ]
  },
  {
    name: 'deepSeekReasoningEffort',
    label: '思考强度',
    type: 'radio',
    group: 'model',
    defaultValue: 'high',
    options: [
      { label: 'High', value: 'high' },
      { label: 'Max', value: 'max' }
    ]
  },
  {
    name: 'deepSeekTemperature',
    label: 'Temperature',
    type: 'float',
    group: 'model',
    defaultValue: 0.2,
    min: 0,
    max: 2,
    step: 0.1,
    precision: 2
  },
  {
    name: 'deepSeekMaxTokens',
    label: '最大输出 Token',
    type: 'number',
    group: 'model',
    defaultValue: 8192,
    min: 256,
    max: 384000
  },
  {
    name: 'deepSeekTimeoutSeconds',
    label: '请求超时',
    type: 'number',
    group: 'request',
    defaultValue: 300,
    min: 10,
    max: 600
  },
  {
    name: 'deepSeekDefaultPrompt',
    label: '默认翻译提示词',
    type: 'textarea',
    group: 'prompt',
    defaultValue:
      '请保持原文语气与专有名词一致，翻译成目标语言。不要增删事实，不要解释，不要改写 HTML 结构字段。'
  },
  {
    name: 'deepSeekLanguagePrompts',
    label: '按目标语言默认提示词',
    type: 'languagePromptMap',
    group: 'prompt',
    defaultValue: buildDefaultLanguagePromptMap()
  },
  {
    name: 'imageGenerationEnabled',
    label: '启用图像生成',
    type: 'boolean',
    group: 'imageProvider',
    defaultValue: false,
    helpText:
      '启用后，后续图像生成能力会读取本模块的 provider、模型和请求参数。'
  },
  {
    name: 'imageGenerationProvider',
    label: '图像生成服务商',
    type: 'select',
    group: 'imageProvider',
    defaultValue: 'gemini',
    options: IMAGE_GENERATION_PROVIDER_OPTIONS
  },
  {
    name: 'imageGenerationTimeoutSeconds',
    label: '图像生成超时秒数',
    type: 'number',
    group: 'imageRequest',
    defaultValue: 180,
    min: 30,
    max: 600,
    helpText: '复杂图像生成可能接近 2 分钟，生产环境建议保留足够超时时间。'
  },
  {
    name: 'imageGenerationPromptPrefix',
    label: '图像生成默认提示词',
    type: 'textarea',
    group: 'imagePrompt',
    defaultValue: '',
    helpText:
      '会作为业务提示词前置补充，适合配置站点统一风格、版权边界和输出规范。'
  },
  {
    name: 'geminiImageApiKey',
    label: 'API Key / Token',
    type: 'password',
    group: 'geminiImage',
    defaultValue: '',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  {
    name: 'geminiImageCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'imageProvider',
    defaultValue: false,
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像生成请求。'
  },
  {
    name: 'geminiImageBaseUrl',
    label: 'Gemini Base URL',
    type: 'string',
    group: 'geminiImage',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
  },
  {
    name: 'geminiImageModel',
    label: 'Gemini 图像模型',
    type: 'modelSelect',
    group: 'geminiImage',
    defaultValue: 'gemini-3.1-flash-image-preview',
    allowCreate: true,
    options: GEMINI_IMAGE_GENERATION_MODEL_OPTIONS,
    helpText:
      'Gemini 图像生成统一走原生 generateContent；默认使用 gemini-3.1-flash-image-preview。'
  },
  buildGeminiThinkingLevelField('geminiImageThinkingLevel', 'geminiImage'),
  {
    name: 'geminiImageAspectRatio',
    label: 'Gemini 画幅比例',
    type: 'select',
    group: 'geminiImage',
    defaultValue: 'auto',
    options: GEMINI_IMAGE_ASPECT_RATIO_OPTIONS,
    hiddenInSettings: true
  },
  {
    name: 'geminiImageSize',
    label: 'Gemini 输出规格',
    type: 'select',
    group: 'geminiImage',
    defaultValue: '1K',
    options: GEMINI_IMAGE_SIZE_OPTIONS,
    helpText:
      'Gemini 3.1 Flash Image Preview 和 Gemini 3 Pro Image Preview 支持 1K、2K、4K；系统会按原图比例选择最接近的画幅。'
  },
  {
    name: 'imageRecognitionEnabled',
    label: '启用图像识别',
    type: 'boolean',
    group: 'imageRecognitionProvider',
    defaultValue: false,
    helpText:
      '启用后，AI 翻译任务可以用图像识别判断封面图是否包含需要翻译的标题文字。'
  },
  {
    name: 'imageRecognitionProvider',
    label: '图像识别服务商',
    type: 'select',
    group: 'imageRecognitionProvider',
    defaultValue: 'gemini',
    options: IMAGE_RECOGNITION_PROVIDER_OPTIONS
  },
  {
    name: 'imageRecognitionTimeoutSeconds',
    label: '图像识别超时秒数',
    type: 'number',
    group: 'imageRecognitionRequest',
    defaultValue: 120,
    min: 10,
    max: 300,
    helpText:
      '封面图识别主要用于判断是否需要生成翻译图，超时会记录任务警告，不应静默改用其他 provider。'
  },
  {
    name: 'imageRecognitionConfidenceThreshold',
    label: '标题识别置信度阈值',
    type: 'float',
    group: 'imageRecognitionRequest',
    defaultValue: 0.75,
    min: 0.5,
    max: 0.95,
    step: 0.01,
    precision: 2,
    helpText: '识别结果低于该阈值时，不自动判定封面图需要翻译。'
  },
  {
    name: 'imageRecognitionPrompt',
    label: '图像识别基础提示词',
    type: 'textarea',
    group: 'imageRecognitionPrompt',
    defaultValue: DEFAULT_IMAGE_RECOGNITION_PROMPT,
    helpText:
      '只用于约束图像识别通用行为；具体业务场景、输出 schema 和字段要求由服务端任务提示词动态追加。'
  },
  {
    name: 'geminiImageRecognitionApiKey',
    label: 'API Key / Token',
    type: 'password',
    group: 'geminiImageRecognition',
    defaultValue: '',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  {
    name: 'geminiImageRecognitionCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'imageRecognitionProvider',
    defaultValue: false,
    helpText: '开启后，通过 Cloudflare AI Gateway 转发图像识别请求。'
  },
  {
    name: 'geminiImageRecognitionBaseUrl',
    label: 'Gemini Base URL',
    type: 'string',
    group: 'geminiImageRecognition',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
  },
  {
    name: 'geminiImageRecognitionModel',
    label: 'Gemini 图像识别模型',
    type: 'modelSelect',
    group: 'geminiImageRecognition',
    defaultValue: 'gemini-3.1-pro-preview',
    allowCreate: true,
    options: GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS,
    helpText:
      'Gemini 3.1 Pro Preview 支持图像输入；需要更低延迟时可选择 Gemini 3 Flash Preview。'
  },
  buildGeminiThinkingLevelField(
    'geminiImageRecognitionThinkingLevel',
    'geminiImageRecognition'
  ),
  {
    name: 'geminiImageRecognitionMediaResolution',
    label: 'Gemini 媒体解析度',
    type: 'select',
    group: 'geminiImageRecognition',
    defaultValue: 'MEDIA_RESOLUTION_HIGH',
    options: GEMINI_MEDIA_RESOLUTION_OPTIONS,
    helpText:
      'Google 文档建议图像分析使用 MEDIA_RESOLUTION_HIGH，以提升读取细小文字的准确率。'
  },
  {
    name: 'internetSearchEnabled',
    label: '启用互联网搜索',
    type: 'boolean',
    group: 'internetSearchProvider',
    defaultValue: false,
    helpText:
      '启用后，AI 翻译可在翻译前检索专有名词、作品名等官方译名，并写入专有名词翻译库。'
  },
  {
    name: 'internetSearchProvider',
    label: '互联网搜索服务商',
    type: 'select',
    group: 'internetSearchProvider',
    defaultValue: 'gemini',
    options: INTERNET_SEARCH_PROVIDER_OPTIONS,
    helpText: '当前仅开放 Gemini，后续可在服务层扩展其他支持联网搜索的 AI。'
  },
  {
    name: 'internetSearchTimeoutSeconds',
    label: '互联网搜索超时秒数',
    type: 'number',
    group: 'internetSearchRequest',
    defaultValue: 180,
    min: 30,
    max: 600,
    helpText:
      'Gemini 使用 google_search 工具时可能执行多次搜索，请为批量名词检索保留足够时间。'
  },
  {
    name: 'geminiInternetSearchApiKey',
    label: 'API Key / Token',
    type: 'password',
    group: 'geminiInternetSearch',
    defaultValue: '',
    helpText:
      '直连 Gemini 时填写 Gemini API Key；使用 AI Gateway 时填写 Cloudflare Token。'
  },
  {
    name: 'geminiInternetSearchCloudflareAiGatewayEnabled',
    label: '使用 AI Gateway',
    type: 'boolean',
    group: 'internetSearchProvider',
    defaultValue: false,
    helpText: '开启后，通过 Cloudflare AI Gateway 转发互联网搜索请求。'
  },
  {
    name: 'geminiInternetSearchBaseUrl',
    label: 'Gemini Base URL',
    type: 'string',
    group: 'geminiInternetSearch',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
    helpText:
      '直连时填写 Gemini API 地址；使用 AI Gateway 时填写 https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio。'
  },
  {
    name: 'geminiInternetSearchModel',
    label: 'Gemini 搜索模型',
    type: 'modelSelect',
    group: 'geminiInternetSearch',
    defaultValue: 'gemini-3-flash-preview',
    allowCreate: true,
    options: GEMINI_INTERNET_SEARCH_MODEL_OPTIONS,
    helpText:
      'Google Search grounding 当前模型使用 tools: [{ google_search: {} }]；默认采用文档示例的 gemini-3-flash-preview。'
  },
  buildGeminiThinkingLevelField(
    'geminiInternetSearchThinkingLevel',
    'geminiInternetSearch'
  )
]

const AI_SETTING_FIELD_MAP = AI_SETTING_FIELDS.reduce((map, item) => {
  map[item.name] = item
  return map
}, {})

function applyLegacyAiSettingValues(
  values,
  configuredNames,
  legacyValues = {}
) {
  Object.entries(LEGACY_AI_SETTING_MIGRATIONS).forEach(
    ([legacyName, targetName]) => {
      if (configuredNames.includes(targetName)) {
        return
      }
      if (!Object.prototype.hasOwnProperty.call(legacyValues, legacyName)) {
        return
      }
      const targetField = AI_SETTING_FIELD_MAP[targetName]
      if (!targetField) {
        return
      }
      values[targetName] = normalizeValue(targetField, legacyValues[legacyName])
      configuredNames.push(targetName)
    }
  )
}

function getOptionModel() {
  const repository = global.$mongodDB.multilingual.repositories.options
  if (!repository || !repository.model) {
    throw new Error('multilingual options repository not found')
  }

  return repository.model
}

function normalizeBooleanValue(value) {
  return value === true || value === 'true' || value === '1'
}

function clampNumber(field, numberValue) {
  let normalizedValue = numberValue
  if (field.min !== undefined && normalizedValue < field.min) {
    normalizedValue = field.min
  }
  if (field.max !== undefined && normalizedValue > field.max) {
    normalizedValue = field.max
  }
  return normalizedValue
}

function normalizeNumberValue(field, value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return field.defaultValue
  }

  return Math.round(clampNumber(field, numberValue))
}

function normalizeFloatValue(field, value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return field.defaultValue
  }

  const normalizedValue = clampNumber(field, numberValue)
  const precision = Number.isInteger(field.precision) ? field.precision : 2
  const multiple = Math.pow(10, precision)
  return Math.round(normalizedValue * multiple) / multiple
}

function normalizeSelectValue(field, value) {
  const text = String(value || '').trim()
  if (!text) {
    return field.defaultValue
  }

  if (field.allowCreate) {
    return text
  }

  const matched = (field.options || []).some(option => option.value === text)
  if (!matched) {
    return field.defaultValue
  }

  return text
}

function buildDefaultLanguagePromptMap() {
  return SUPPORTED_LANGUAGE_CODES.reduce((map, languageCode) => {
    map[languageCode] = ''
    return map
  }, {})
}

function normalizeLanguagePromptMap(value) {
  let inputValue = value
  if (typeof inputValue === 'string') {
    try {
      inputValue = inputValue.trim() ? JSON.parse(inputValue) : {}
    } catch (error) {
      inputValue = {}
    }
  }

  if (
    !inputValue ||
    typeof inputValue !== 'object' ||
    Array.isArray(inputValue)
  ) {
    inputValue = {}
  }

  const promptMap = buildDefaultLanguagePromptMap()
  Object.keys(inputValue).forEach(key => {
    const languageCode = normalizeLanguageCode(key)
    if (!languageCode) {
      return
    }
    promptMap[languageCode] = String(inputValue[key] || '')
      .trim()
      .slice(0, 6000)
  })
  return promptMap
}

function normalizeTrimmedString(value, maxLength = 12000) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim().slice(0, maxLength)
}

function isGemini25Model(model) {
  return /^gemini-2\.5([.-]|$)/i.test(normalizeTrimmedString(model, 120))
}

function isGemini3Model(model) {
  return /^gemini-3([.-]|$)/i.test(normalizeTrimmedString(model, 120))
}

function isGemini3ProModel(model) {
  return /^gemini-3(\.\d+)?-pro([.-]|$)/i.test(
    normalizeTrimmedString(model, 120)
  )
}

function buildGeminiThinkingConfig(model, thinkingLevel, fieldName) {
  const normalizedThinkingLevel = normalizeTrimmedString(thinkingLevel, 40)
  if (
    !normalizedThinkingLevel ||
    normalizedThinkingLevel === GEMINI_THINKING_LEVEL_DEFAULT
  ) {
    return null
  }

  if (!GEMINI_THINKING_LEVEL_VALUES.has(normalizedThinkingLevel)) {
    throw new ApiError(
      ERROR_CODES.AI_SETTINGS_INVALID,
      'Gemini 思考深度配置无效',
      fieldName,
      400
    )
  }

  if (isGemini25Model(model)) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'Gemini 2.5 系列不支持 thinkingLevel 思考深度；请保持默认，或改用支持 thinkingLevel 的 Gemini 3 系列模型。',
      fieldName,
      400
    )
  }

  if (!isGemini3Model(model)) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '当前 Gemini 模型不支持 thinkingLevel 思考深度；请保持默认，或改用 Gemini 3 系列模型。',
      fieldName,
      400
    )
  }

  if (
    normalizedThinkingLevel === 'minimal' &&
    isGemini3ProModel(model)
  ) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'Gemini 3 Pro 不支持 Minimal 思考深度；请选择 Low、Medium、High 或默认。',
      fieldName,
      400
    )
  }

  return {
    thinkingLevel: normalizedThinkingLevel
  }
}

function normalizeValue(field, value) {
  if (field.type === 'languagePromptMap') {
    return normalizeLanguagePromptMap(value)
  }
  if (field.type === 'boolean') {
    return normalizeBooleanValue(value)
  }
  if (field.type === 'number') {
    return normalizeNumberValue(field, value)
  }
  if (field.type === 'float') {
    return normalizeFloatValue(field, value)
  }
  if (
    field.type === 'select' ||
    field.type === 'modelSelect' ||
    field.type === 'radio'
  ) {
    return normalizeSelectValue(field, value)
  }
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return normalizeTrimmedString(value)
}

function serializeValue(field, value) {
  if (field.type === 'languagePromptMap') {
    return JSON.stringify(normalizeValue(field, value))
  }
  return String(normalizeValue(field, value))
}

function buildDefaultValues() {
  const values = {}
  for (const field of AI_SETTING_FIELDS) {
    if (
      field.defaultValue &&
      typeof field.defaultValue === 'object' &&
      !Array.isArray(field.defaultValue)
    ) {
      values[field.name] = { ...field.defaultValue }
      continue
    }
    values[field.name] = field.defaultValue
  }
  return values
}

async function getAiSettings() {
  const OptionModel = getOptionModel()
  const nameList = AI_SETTING_FIELDS.map(item => item.name).concat(
    Object.keys(LEGACY_AI_SETTING_MIGRATIONS)
  )
  const optionList = await OptionModel.find({
    scope: OPTION_SCOPE,
    languageCode: DEFAULT_LANGUAGE_CODE,
    name: { $in: nameList }
  })
    .select('name value scope languageCode')
    .lean()

  const values = buildDefaultValues()
  const configuredNames = []
  const legacyValues = {}
  for (const item of optionList) {
    const field = AI_SETTING_FIELD_MAP[item.name]
    if (!field) {
      if (
        Object.prototype.hasOwnProperty.call(
          LEGACY_AI_SETTING_MIGRATIONS,
          item.name
        )
      ) {
        legacyValues[item.name] = item.value
      }
      continue
    }
    values[item.name] = normalizeValue(field, item.value)
    configuredNames.push(item.name)
  }
  applyLegacyAiSettingValues(values, configuredNames, legacyValues)

  return {
    fields: AI_SETTING_FIELDS,
    values,
    configuredNames,
    docs: {
      deepSeekBaseUrl: 'https://api.deepseek.com',
      jsonOutputResponseFormat: { type: 'json_object' },
      modelOptions: DEEPSEEK_MODEL_OPTIONS,
      imageGeneration: {
        geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiDefaultModel: 'gemini-3.1-flash-image-preview',
        geminiModelOptions: GEMINI_IMAGE_GENERATION_MODEL_OPTIONS,
        geminiThinkingLevelOptions: GEMINI_THINKING_LEVEL_OPTIONS
      },
      imageRecognition: {
        geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiDefaultModel: 'gemini-3.1-pro-preview',
        geminiModelOptions: GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS,
        geminiThinkingLevelOptions: GEMINI_THINKING_LEVEL_OPTIONS,
        defaultConfidenceThreshold: 0.75,
        maxInputImageDimension: 1280
      },
      internetSearch: {
        geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiDefaultModel: 'gemini-3-flash-preview',
        geminiModelOptions: GEMINI_INTERNET_SEARCH_MODEL_OPTIONS,
        geminiThinkingLevelOptions: GEMINI_THINKING_LEVEL_OPTIONS,
        googleSearchTool: { google_search: {} }
      }
    }
  }
}

async function updateAiSettings(values = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new ApiError(
      ERROR_CODES.SETTINGS_VALUES_INVALID,
      undefined,
      'values',
      400
    )
  }

  const OptionModel = getOptionModel()
  const savedValues = {}

  for (const field of AI_SETTING_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, field.name)) {
      continue
    }

    const normalizedValue = normalizeValue(field, values[field.name])
    await OptionModel.findOneAndUpdate(
      {
        scope: OPTION_SCOPE,
        languageCode: DEFAULT_LANGUAGE_CODE,
        name: field.name
      },
      {
        $set: {
          scope: OPTION_SCOPE,
          languageCode: DEFAULT_LANGUAGE_CODE,
          name: field.name,
          value: serializeValue(field, normalizedValue)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    savedValues[field.name] = normalizedValue
  }

  if (Object.keys(savedValues).length === 0) {
    throw new ApiError(
      ERROR_CODES.SETTINGS_VALUES_INVALID,
      undefined,
      'values',
      400
    )
  }

  await OptionModel.deleteMany({
    scope: OPTION_SCOPE,
    languageCode: DEFAULT_LANGUAGE_CODE,
    name: { $in: Object.keys(LEGACY_AI_SETTING_MIGRATIONS) }
  })

  const currentSettings = await getAiSettings()
  currentSettings.values = {
    ...currentSettings.values,
    ...savedValues
  }
  return currentSettings
}

async function getDeepSeekRuntimeSettings() {
  const settings = await getAiSettings()
  const values = settings.values
  if (values.aiProvider !== 'deepseek' || values.deepSeekEnabled !== true) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先在 AI 设置中启用 DeepSeek',
      'deepSeekEnabled',
      400
    )
  }
  if (!String(values.deepSeekApiKey || '').trim()) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先配置 DeepSeek API Key',
      'deepSeekApiKey',
      400
    )
  }

  return values
}

function buildGeminiImageRuntimeSettings(values) {
  if (!normalizeTrimmedString(values.geminiImageApiKey)) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先配置 Gemini API Key',
      'geminiImageApiKey',
      400
    )
  }

  return {
    provider: 'gemini',
    apiKey: normalizeTrimmedString(values.geminiImageApiKey),
    baseUrl: normalizeTrimmedString(values.geminiImageBaseUrl),
    useCloudflareAiGateway:
      values.geminiImageCloudflareAiGatewayEnabled === true,
    model: normalizeTrimmedString(values.geminiImageModel),
    timeoutSeconds: values.imageGenerationTimeoutSeconds,
    promptPrefix: normalizeTrimmedString(values.imageGenerationPromptPrefix),
    requestOptions: {
      aspectRatio: values.geminiImageAspectRatio,
      imageSize: values.geminiImageSize,
      thinkingConfig: buildGeminiThinkingConfig(
        values.geminiImageModel,
        values.geminiImageThinkingLevel,
        'geminiImageThinkingLevel'
      )
    }
  }
}

async function getImageGenerationRuntimeSettings() {
  const settings = await getAiSettings()
  const values = settings.values
  if (values.imageGenerationEnabled !== true) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先在 AI 设置中启用图像生成',
      'imageGenerationEnabled',
      400
    )
  }

  if (values.imageGenerationProvider === 'gemini') {
    return buildGeminiImageRuntimeSettings(values)
  }

  throw new ApiError(
    ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
    '图像生成服务商配置无效',
    'imageGenerationProvider',
    400
  )
}

function buildGeminiImageRecognitionRuntimeSettings(values) {
  if (!normalizeTrimmedString(values.geminiImageRecognitionApiKey)) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先配置 Gemini Vision API Key',
      'geminiImageRecognitionApiKey',
      400
    )
  }

  return {
    provider: 'gemini',
    apiKey: normalizeTrimmedString(values.geminiImageRecognitionApiKey),
    baseUrl: normalizeTrimmedString(values.geminiImageRecognitionBaseUrl),
    useCloudflareAiGateway:
      values.geminiImageRecognitionCloudflareAiGatewayEnabled === true,
    model: normalizeTrimmedString(values.geminiImageRecognitionModel),
    timeoutSeconds: values.imageRecognitionTimeoutSeconds,
    confidenceThreshold: values.imageRecognitionConfidenceThreshold,
    prompt: normalizeTrimmedString(values.imageRecognitionPrompt),
    requestOptions: {
      mediaResolution: values.geminiImageRecognitionMediaResolution,
      thinkingConfig: buildGeminiThinkingConfig(
        values.geminiImageRecognitionModel,
        values.geminiImageRecognitionThinkingLevel,
        'geminiImageRecognitionThinkingLevel'
      )
    }
  }
}

async function getImageRecognitionRuntimeSettings() {
  const settings = await getAiSettings()
  const values = settings.values
  if (values.imageRecognitionEnabled !== true) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先在 AI 设置中启用图像识别',
      'imageRecognitionEnabled',
      400
    )
  }

  if (values.imageRecognitionProvider === 'gemini') {
    return buildGeminiImageRecognitionRuntimeSettings(values)
  }

  throw new ApiError(
    ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
    '图像识别服务商配置无效',
    'imageRecognitionProvider',
    400
  )
}

function buildGeminiInternetSearchRuntimeSettings(values) {
  if (!normalizeTrimmedString(values.geminiInternetSearchApiKey)) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先配置 Gemini Internet Search API Key',
      'geminiInternetSearchApiKey',
      400
    )
  }

  return {
    provider: 'gemini',
    apiKey: normalizeTrimmedString(values.geminiInternetSearchApiKey),
    baseUrl: normalizeTrimmedString(values.geminiInternetSearchBaseUrl),
    useCloudflareAiGateway:
      values.geminiInternetSearchCloudflareAiGatewayEnabled === true,
    model: normalizeTrimmedString(values.geminiInternetSearchModel),
    timeoutSeconds: values.internetSearchTimeoutSeconds,
    requestOptions: {
      tool: 'google_search',
      thinkingConfig: buildGeminiThinkingConfig(
        values.geminiInternetSearchModel,
        values.geminiInternetSearchThinkingLevel,
        'geminiInternetSearchThinkingLevel'
      )
    }
  }
}

async function getInternetSearchRuntimeSettings() {
  const settings = await getAiSettings()
  const values = settings.values
  if (values.internetSearchEnabled !== true) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      '请先在 AI 设置中启用互联网搜索',
      'internetSearchEnabled',
      400
    )
  }

  if (values.internetSearchProvider === 'gemini') {
    return buildGeminiInternetSearchRuntimeSettings(values)
  }

  throw new ApiError(
    ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
    '互联网搜索服务商配置无效',
    'internetSearchProvider',
    400
  )
}

module.exports = {
  AI_SETTING_FIELDS,
  IMAGE_GENERATION_PROVIDER_OPTIONS,
  IMAGE_RECOGNITION_PROVIDER_OPTIONS,
  INTERNET_SEARCH_PROVIDER_OPTIONS,
  GEMINI_IMAGE_GENERATION_MODEL_OPTIONS,
  GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS,
  GEMINI_INTERNET_SEARCH_MODEL_OPTIONS,
  DEEPSEEK_MODEL_OPTIONS,
  getAiSettings,
  getDeepSeekRuntimeSettings,
  getImageGenerationRuntimeSettings,
  getImageRecognitionRuntimeSettings,
  getInternetSearchRuntimeSettings,
  updateAiSettings
}
