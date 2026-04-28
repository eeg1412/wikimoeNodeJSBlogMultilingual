const { DEFAULT_LANGUAGE_CODE } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const OPTION_SCOPE = 'multilingualMedia'

const MEDIA_SETTING_FIELDS = [
  {
    name: 'imgSettingEnableImgCompress',
    label: '开启图片压缩',
    type: 'boolean',
    defaultValue: false
  },
  {
    name: 'imgSettingEnableImgCompressWebp',
    label: '压缩为 webp 格式',
    type: 'boolean',
    defaultValue: false
  },
  {
    name: 'imgSettingCompressQuality',
    label: '图片压缩质量',
    type: 'number',
    defaultValue: 80,
    min: 1,
    max: 100
  },
  {
    name: 'imgSettingCompressMaxSize',
    label: '图片压缩最长边',
    type: 'number',
    defaultValue: 1920,
    min: 1
  },
  {
    name: 'imgSettingEnableImgThumbnail',
    label: '开启图片缩略图',
    type: 'boolean',
    defaultValue: false
  },
  {
    name: 'imgSettingThumbnailQuality',
    label: '图片缩略图质量',
    type: 'number',
    defaultValue: 40,
    min: 1,
    max: 100
  },
  {
    name: 'imgSettingThumbnailMaxSize',
    label: '图片缩略图最长边',
    type: 'number',
    defaultValue: 680,
    min: 1
  },
  {
    name: 'videoSettingCompressMaxSize',
    label: '视频最长边',
    type: 'number',
    defaultValue: 480,
    min: 1
  },
  {
    name: 'videoSettingCompressBitrate',
    label: '视频压缩码率',
    type: 'number',
    defaultValue: 500,
    min: 1
  },
  {
    name: 'videoSettingCompressFps',
    label: '视频压缩帧率',
    type: 'number',
    defaultValue: 30,
    min: 1
  }
]

const MEDIA_SETTING_FIELD_MAP = MEDIA_SETTING_FIELDS.reduce((map, item) => {
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

function normalizeNumberValue(field, value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return field.defaultValue
  }

  let normalizedValue = Math.round(numberValue)
  if (field.min && normalizedValue < field.min) {
    normalizedValue = field.min
  }
  if (field.max && normalizedValue > field.max) {
    normalizedValue = field.max
  }

  return normalizedValue
}

function normalizeValue(field, value) {
  if (field.type === 'boolean') {
    return normalizeBooleanValue(value)
  }
  if (field.type === 'number') {
    return normalizeNumberValue(field, value)
  }
  return String(value || '')
}

function serializeValue(field, value) {
  return String(normalizeValue(field, value))
}

function buildDefaultValues() {
  const values = {}
  for (const field of MEDIA_SETTING_FIELDS) {
    values[field.name] = field.defaultValue
  }
  return values
}

async function getMediaSettings() {
  const OptionModel = getOptionModel()
  const nameList = MEDIA_SETTING_FIELDS.map(item => item.name)
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
    const field = MEDIA_SETTING_FIELD_MAP[item.name]
    if (!field) {
      continue
    }
    values[item.name] = normalizeValue(field, item.value)
    configuredNames.push(item.name)
  }

  return {
    fields: MEDIA_SETTING_FIELDS,
    values,
    configuredNames
  }
}

async function updateMediaSettings(values = {}) {
  const OptionModel = getOptionModel()
  const savedValues = {}

  for (const field of MEDIA_SETTING_FIELDS) {
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

  const currentSettings = await getMediaSettings()
  currentSettings.values = {
    ...currentSettings.values,
    ...savedValues
  }
  return currentSettings
}

async function getMediaSettingValues() {
  const settings = await getMediaSettings()
  return settings.values
}

module.exports = {
  MEDIA_SETTING_FIELDS,
  getMediaSettings,
  getMediaSettingValues,
  updateMediaSettings
}
