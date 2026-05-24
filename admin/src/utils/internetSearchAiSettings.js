export {
  getOfficialTermSearchDefaultValue,
  getInternetSearchUnavailableReason,
  loadAiSettingsAvailability
} from './aiSettingsAvailability'

export function isInternetSearchAiConfigured(settingsData = {}) {
  const values = settingsData.values || {}
  return values.internetSearchEnabled === true
}
