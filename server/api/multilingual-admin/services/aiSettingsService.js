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
    label: 'DeepSeek API Key',
    type: 'password',
    group: 'deepseek',
    defaultValue: ''
  },
  {
    name: 'deepSeekBaseUrl',
    label: 'DeepSeek Base URL',
    type: 'string',
    group: 'deepseek',
    defaultValue: 'https://api.deepseek.com'
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
    label: 'Gemini API Key',
    type: 'password',
    group: 'geminiImage',
    defaultValue: ''
  },
  {
    name: 'geminiImageBaseUrl',
    label: 'Gemini Base URL',
    type: 'string',
    group: 'geminiImage',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
    helpText:
      '服务端直接调用 Gemini generateContent API；旧兼容层地址会自动归一化为原生路径。'
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
    label: 'Gemini API Key',
    type: 'password',
    group: 'geminiImageRecognition',
    defaultValue: ''
  },
  {
    name: 'geminiImageRecognitionBaseUrl',
    label: 'Gemini Base URL',
    type: 'string',
    group: 'geminiImageRecognition',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
    helpText: '服务端直接调用 Gemini generateContent 并使用原生结构化输出。'
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
  {
    name: 'geminiImageRecognitionMediaResolution',
    label: 'Gemini 媒体解析度',
    type: 'select',
    group: 'geminiImageRecognition',
    defaultValue: 'MEDIA_RESOLUTION_HIGH',
    options: GEMINI_MEDIA_RESOLUTION_OPTIONS,
    helpText:
      'Google 文档建议图像分析使用 MEDIA_RESOLUTION_HIGH，以提升读取细小文字的准确率。'
  }
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
        geminiModelOptions: GEMINI_IMAGE_GENERATION_MODEL_OPTIONS
      },
      imageRecognition: {
        geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        geminiDefaultModel: 'gemini-3.1-pro-preview',
        geminiModelOptions: GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS,
        defaultConfidenceThreshold: 0.75,
        maxInputImageDimension: 1280
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
    model: normalizeTrimmedString(values.geminiImageModel),
    timeoutSeconds: values.imageGenerationTimeoutSeconds,
    promptPrefix: normalizeTrimmedString(values.imageGenerationPromptPrefix),
    requestOptions: {
      aspectRatio: values.geminiImageAspectRatio,
      imageSize: values.geminiImageSize
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
    model: normalizeTrimmedString(values.geminiImageRecognitionModel),
    timeoutSeconds: values.imageRecognitionTimeoutSeconds,
    confidenceThreshold: values.imageRecognitionConfidenceThreshold,
    prompt: normalizeTrimmedString(values.imageRecognitionPrompt),
    requestOptions: {
      mediaResolution: values.geminiImageRecognitionMediaResolution
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

module.exports = {
  AI_SETTING_FIELDS,
  IMAGE_GENERATION_PROVIDER_OPTIONS,
  IMAGE_RECOGNITION_PROVIDER_OPTIONS,
  GEMINI_IMAGE_GENERATION_MODEL_OPTIONS,
  GEMINI_IMAGE_RECOGNITION_MODEL_OPTIONS,
  DEEPSEEK_MODEL_OPTIONS,
  getAiSettings,
  getDeepSeekRuntimeSettings,
  getImageGenerationRuntimeSettings,
  getImageRecognitionRuntimeSettings,
  updateAiSettings
}
