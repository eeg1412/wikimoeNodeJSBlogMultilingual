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
  }
]

const AI_SETTING_FIELD_MAP = AI_SETTING_FIELDS.reduce((map, item) => {
  map[item.name] = item
  return map
}, {})

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

  if (!inputValue || typeof inputValue !== 'object' || Array.isArray(inputValue)) {
    inputValue = {}
  }

  const promptMap = buildDefaultLanguagePromptMap()
  Object.keys(inputValue).forEach(key => {
    const languageCode = normalizeLanguageCode(key)
    if (!languageCode) {
      return
    }
    promptMap[languageCode] = String(inputValue[key] || '').trim().slice(0, 6000)
  })
  return promptMap
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
  return String(value)
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
  const nameList = AI_SETTING_FIELDS.map(item => item.name)
  const optionList = await OptionModel.find({
    scope: OPTION_SCOPE,
    languageCode: DEFAULT_LANGUAGE_CODE,
    name: { $in: nameList }
  })
    .select('name value scope languageCode')
    .lean()

  const values = buildDefaultValues()
  const configuredNames = []
  for (const item of optionList) {
    const field = AI_SETTING_FIELD_MAP[item.name]
    if (!field) {
      continue
    }
    values[item.name] = normalizeValue(field, item.value)
    configuredNames.push(item.name)
  }

  return {
    fields: AI_SETTING_FIELDS,
    values,
    configuredNames,
    docs: {
      deepSeekBaseUrl: 'https://api.deepseek.com',
      jsonOutputResponseFormat: { type: 'json_object' },
      modelOptions: DEEPSEEK_MODEL_OPTIONS
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

module.exports = {
  AI_SETTING_FIELDS,
  DEEPSEEK_MODEL_OPTIONS,
  getAiSettings,
  getDeepSeekRuntimeSettings,
  updateAiSettings
}
