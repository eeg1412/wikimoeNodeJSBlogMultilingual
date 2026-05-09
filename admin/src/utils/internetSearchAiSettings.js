export function isInternetSearchAiConfigured(settingsData = {}) {
  const values = settingsData.values || {}
  return values.internetSearchEnabled === true
}

export async function getOfficialTermSearchDefaultValue(multilingualApi) {
  const response = await multilingualApi.getAiSettings({}, true)
  return isInternetSearchAiConfigured(response.data.data || {})
}
