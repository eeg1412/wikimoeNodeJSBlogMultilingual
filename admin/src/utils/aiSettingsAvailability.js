export const AI_SETTINGS_UNAVAILABLE_REASONS = {
  internetSearch: 'AI 设置未启用互联网搜索，名词检索不可用。',
  imageRecognition:
    'AI 设置未启用图像识别，自动判断不可用，可选择“是”直接翻译封面图。',
  imageGeneration: 'AI 设置未启用图像生成，封面图翻译不可用。'
}

export function createAiSettingsAvailability() {
  return {
    loaded: false,
    loadErrorMessage: '',
    internetSearchEnabled: false,
    imageRecognitionEnabled: false,
    imageGenerationEnabled: false
  }
}

export function resolveAiSettingsAvailability(settingsData = {}) {
  const values = settingsData.values || {}
  return {
    loaded: true,
    loadErrorMessage: '',
    internetSearchEnabled: values.internetSearchEnabled === true,
    imageRecognitionEnabled: values.imageRecognitionEnabled === true,
    imageGenerationEnabled: values.imageGenerationEnabled === true
  }
}

export async function loadAiSettingsAvailability(multilingualApi) {
  const response = await multilingualApi.getAiSettings({}, true)
  return resolveAiSettingsAvailability(response.data.data || {})
}

function getLoadErrorReason(availability = {}) {
  if (!availability.loadErrorMessage) {
    return ''
  }
  return availability.loadErrorMessage
}

export function getInternetSearchUnavailableReason(availability = {}) {
  const loadErrorReason = getLoadErrorReason(availability)
  if (loadErrorReason) {
    return loadErrorReason
  }
  if (availability.loaded !== true) {
    return ''
  }
  if (availability.internetSearchEnabled === true) {
    return ''
  }
  return AI_SETTINGS_UNAVAILABLE_REASONS.internetSearch
}

export function getImageRecognitionUnavailableReason(availability = {}) {
  const loadErrorReason = getLoadErrorReason(availability)
  if (loadErrorReason) {
    return loadErrorReason
  }
  if (availability.loaded !== true) {
    return ''
  }
  if (availability.imageRecognitionEnabled === true) {
    return ''
  }
  return AI_SETTINGS_UNAVAILABLE_REASONS.imageRecognition
}

export function getImageGenerationUnavailableReason(availability = {}) {
  const loadErrorReason = getLoadErrorReason(availability)
  if (loadErrorReason) {
    return loadErrorReason
  }
  if (availability.loaded !== true) {
    return ''
  }
  if (availability.imageGenerationEnabled === true) {
    return ''
  }
  return AI_SETTINGS_UNAVAILABLE_REASONS.imageGeneration
}

export function createAiSettingsLoadErrorAvailability(error) {
  const availability = createAiSettingsAvailability()
  const message = error?.message || 'AI 设置读取失败，请稍后重试。'
  availability.loaded = true
  availability.loadErrorMessage = message
  return availability
}

export async function getOfficialTermSearchDefaultValue(multilingualApi) {
  const availability = await loadAiSettingsAvailability(multilingualApi)
  return availability.internetSearchEnabled === true
}
