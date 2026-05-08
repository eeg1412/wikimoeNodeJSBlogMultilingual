const {
  COVER_IMAGE_ENTRY_TYPE
} = require('../utils/coverImageTranslationUtils')

function normalizeArtifactId(value) {
  return String(value || '').trim()
}

function clearRecognitionInputTempFields(recognitionInput) {
  if (!recognitionInput || typeof recognitionInput !== 'object') {
    return recognitionInput || null
  }
  return {
    ...recognitionInput,
    inputFilePath: '',
    previewUrl: ''
  }
}

function clearGeneratedImageTempFields(generatedImage) {
  if (!generatedImage || typeof generatedImage !== 'object') {
    return generatedImage || null
  }
  return {
    ...generatedImage,
    tempFilePath: '',
    previewUrl: ''
  }
}

function buildCoverImageCleanupUpdate(
  result = {},
  cleanupResult = {},
  options = {}
) {
  const now = options.now instanceof Date ? options.now : new Date()
  const cleanedArtifactIds = Array.isArray(cleanupResult.cleanedArtifactIds)
    ? cleanupResult.cleanedArtifactIds
    : []
  const cleanedArtifactIdSet = new Set(
    cleanedArtifactIds.map(normalizeArtifactId).filter(Boolean)
  )
  const artifactList = Array.isArray(result.coverImageArtifacts)
    ? result.coverImageArtifacts
    : []
  const previewEntryList = Array.isArray(result.previewEntries)
    ? result.previewEntries
    : []

  return {
    coverImageArtifacts: artifactList.map(artifact => {
      const artifactId = normalizeArtifactId(artifact?.artifactId)
      if (!cleanedArtifactIdSet.has(artifactId)) {
        return artifact
      }
      return {
        ...artifact,
        status: artifact.adopted === true ? artifact.status : 'cleaned',
        recognitionInput: clearRecognitionInputTempFields(
          artifact?.recognitionInput
        ),
        generatedImage: clearGeneratedImageTempFields(artifact?.generatedImage),
        cleanedAt: now,
        updatedAt: now
      }
    }),
    previewEntries: previewEntryList.map(entry => {
      if (entry?.entryType !== COVER_IMAGE_ENTRY_TYPE) {
        return entry
      }
      const artifactId = normalizeArtifactId(entry?.artifactId)
      if (!cleanedArtifactIdSet.has(artifactId)) {
        return entry
      }
      return {
        ...entry,
        status: entry.adopted === true ? entry.status : 'cleaned',
        generatedCoverUrl: '',
        cleanedAt: now
      }
    })
  }
}

module.exports = {
  buildCoverImageCleanupUpdate
}
