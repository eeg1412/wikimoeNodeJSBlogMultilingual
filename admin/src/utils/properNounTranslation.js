function getTranslationList(translations) {
  if (Array.isArray(translations)) {
    return translations
  }
  return []
}

function getLanguageOptionList(languageOptions) {
  if (Array.isArray(languageOptions)) {
    return languageOptions
  }
  return []
}

function getLanguageCode(value) {
  return String(value || '').trim()
}

export function buildProperNounTranslationDisplayItems({
  translations = [],
  languageOptions = [],
  selectedLanguageCode = '',
  sourceLanguageCode = ''
} = {}) {
  const translationMap = new Map()
  getTranslationList(translations).forEach(translation => {
    const languageCode = getLanguageCode(translation?.languageCode)
    if (!languageCode || translationMap.has(languageCode)) {
      return
    }
    translationMap.set(languageCode, translation)
  })

  const normalizedSelectedLanguageCode = getLanguageCode(selectedLanguageCode)
  const normalizedSourceLanguageCode = getLanguageCode(sourceLanguageCode)
  const displayItems = []
  getLanguageOptionList(languageOptions).forEach(option => {
    const languageCode = getLanguageCode(option?.value)
    if (!languageCode) {
      return
    }
    if (
      normalizedSelectedLanguageCode &&
      normalizedSelectedLanguageCode !== languageCode
    ) {
      return
    }

    const languageLabel = option.label || languageCode
    const translation = translationMap.get(languageCode)
    if (translation) {
      displayItems.push({
        ...translation,
        displayKey: `translation-${translation._id || languageCode}`,
        isMissingTranslation: false,
        languageCode,
        languageLabel
      })
      return
    }
    if (
      normalizedSourceLanguageCode &&
      normalizedSourceLanguageCode === languageCode
    ) {
      return
    }

    displayItems.push({
      _id: `missing-${languageCode}`,
      displayKey: `missing-${languageCode}`,
      isMissingTranslation: true,
      languageCode,
      languageLabel,
      translatedText: '',
      translationSource: '',
      note: '',
      usedCount: 0,
      lastUsedAt: ''
    })
  })

  return displayItems
}
