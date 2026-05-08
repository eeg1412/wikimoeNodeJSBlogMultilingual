const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const crypto = require('crypto')
const mongoose = require('mongoose')
const {
  logDiagnostic,
  summarizeError
} = require('./coverImageAiDiagnosticService')
const mediaService = require('./mediaService')
const aiSettingsService = require('./aiSettingsService')
const coverImagePromptService = require('./coverImagePromptService')
const coverImageRecognitionInputService = require('./coverImageRecognitionInputService')
const coverImagePostprocessService = require('./coverImagePostprocessService')
const coverImageTempFileService = require('./coverImageTempFileService')
const geminiImageRecognitionService = require('./geminiImageRecognitionService')
const geminiImageGenerationService = require('./geminiImageGenerationService')
const {
  COVER_IMAGE_ARTIFACT_TYPE,
  COVER_IMAGE_ENTRY_TYPE,
  buildBufferHash,
  buildCoverGenerationKey,
  buildCoverRecognitionKey,
  buildStableHash,
  buildTargetTitleHash,
  getAttachmentId,
  getAttachmentPreviewUrl,
  getPreferredSourceImageDimensions,
  isCoverSupportedPostType,
  normalizeIdValue,
  resolveFirstCoverImage,
  selectNearestImageRatio
} = require('../utils/coverImageTranslationUtils')

const SOURCE_ASSET_FETCH_TIMEOUT_MS = 30000
const SOURCE_ASSET_FETCH_REDIRECT_LIMIT = 5

function getRepositoryModel(collectionName) {
  const repository =
    global.$mongodDB?.multilingual?.repositories?.[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }
  return repository.model
}

function createCoverImageRegistry() {
  return {
    recognitionMap: new Map(),
    generationMap: new Map(),
    artifacts: new Map()
  }
}

function createWarning(code, message, context = {}) {
  return {
    code,
    message,
    scope: 'cover-image-translation',
    ...context
  }
}

function createArtifactId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return new mongoose.Types.ObjectId().toString()
}

function getJobId(job) {
  return String(job?._id || job?.id || 'browser-request')
}

function buildCoverStageDiagnostics(options = {}) {
  return {
    layer: 'cover-image-translation-service',
    context: {
      phase: options.phase || '',
      jobId: getJobId(options.job),
      sourcePostId: normalizeIdValue(
        options.sourcePost?._id || options.sourcePost?.sourceId
      ),
      targetPostId: normalizeIdValue(options.targetPost?._id),
      sourceLanguageCode: options.sourceLanguageCode || '',
      targetLanguageCode: options.targetLanguageCode || '',
      recognitionKey: options.recognitionKey || '',
      generationKey: options.generationKey || ''
    },
    error: options.error ? summarizeError(options.error) : null
  }
}

function isObjectIdValue(value) {
  const text = normalizeIdValue(value)
  return Boolean(text && mongoose.Types.ObjectId.isValid(text))
}

async function findAttachmentById(attachmentId) {
  if (!isObjectIdValue(attachmentId)) {
    return null
  }
  const AttachmentModel = getRepositoryModel('attachments')
  return await AttachmentModel.findOne({
    _id: new mongoose.Types.ObjectId(normalizeIdValue(attachmentId))
  }).lean()
}

async function normalizeCoverAttachment(attachment) {
  if (!attachment) {
    return null
  }
  if (attachment.filepath || attachment.localFilepath || attachment.thumfor) {
    return attachment
  }
  return await findAttachmentById(getAttachmentId(attachment))
}

function resolveSourceCoverLocalPath(attachment) {
  const candidateList = [
    attachment?.localFilepath,
    attachment?.filepath,
    attachment?.localThumbnailPath,
    attachment?.thumfor
  ]
  for (const candidate of candidateList) {
    if (!candidate) {
      continue
    }
    const filePath = mediaService.normalizeStoredContentPath(candidate)
    if (filePath) {
      return filePath
    }
  }
  return ''
}

function getSourceAssetDomainConfig() {
  const rawValue = String(process.env.SOURCE_ASSET_DOMAIN || '').trim()
  if (!rawValue) {
    return {
      enabled: false,
      value: ''
    }
  }

  const normalizedValue = rawValue.replace(/\/+$/, '')
  let parsedUrl = null
  try {
    parsedUrl = new URL(normalizedValue)
  } catch (error) {
    throw new Error('SOURCE_ASSET_DOMAIN 配置不合法')
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('SOURCE_ASSET_DOMAIN 必须是 http 或 https 地址')
  }

  return {
    enabled: true,
    value: normalizedValue
  }
}

function getSourceCoverDownloadPath(attachment) {
  const candidateList = [
    attachment?.filepath,
    attachment?.thumfor,
    attachment?.remoteFilepath
  ]
  for (const candidateValue of candidateList) {
    const candidate = String(candidateValue || '')
      .trim()
      .replace(/\\/g, '/')
    if (!candidate) {
      continue
    }
    if (candidate.startsWith('data:') || candidate.startsWith('blob:')) {
      continue
    }
    if (/^[a-zA-Z]:\//.test(candidate)) {
      continue
    }
    return candidate
  }
  return ''
}

function getSourceCoverPreviewPath(attachment) {
  const candidateList = [
    attachment?.thumfor,
    attachment?.filepath,
    attachment?.remoteFilepath
  ]
  for (const candidateValue of candidateList) {
    const candidate = String(candidateValue || '')
      .trim()
      .replace(/\\/g, '/')
    if (!candidate) {
      continue
    }
    if (candidate.startsWith('data:') || candidate.startsWith('blob:')) {
      continue
    }
    if (/^[a-zA-Z]:\//.test(candidate)) {
      continue
    }
    return candidate
  }
  return ''
}

function buildAbsoluteSourceAssetUrl(assetPath, sourceAssetDomain) {
  const normalizedAssetPath = String(assetPath || '')
    .trim()
    .replace(/\\/g, '/')
  if (!normalizedAssetPath) {
    return ''
  }
  if (/^https?:\/\//i.test(normalizedAssetPath)) {
    return normalizedAssetPath
  }
  if (normalizedAssetPath.startsWith('//')) {
    return `${new URL(sourceAssetDomain).protocol}${normalizedAssetPath}`
  }
  if (/^[a-zA-Z]:\//.test(normalizedAssetPath)) {
    return ''
  }

  const baseUrl = sourceAssetDomain.endsWith('/')
    ? sourceAssetDomain
    : `${sourceAssetDomain}/`
  const relativePath = normalizedAssetPath.startsWith('/')
    ? normalizedAssetPath
    : normalizedAssetPath.replace(/^\.?\//, '')
  return new URL(relativePath, baseUrl).toString()
}

function buildSourceCoverPreviewUrl(attachment, sourceAssetDomainConfig) {
  const assetPath = getSourceCoverPreviewPath(attachment)
  if (!assetPath) {
    return ''
  }
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath
  }
  if (!sourceAssetDomainConfig.enabled) {
    return assetPath
  }
  return buildAbsoluteSourceAssetUrl(assetPath, sourceAssetDomainConfig.value)
}

function normalizeSourceMimeType(mimeType, fallbackMimeType = '') {
  const normalizedMimeType = String(mimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (/^image\//.test(normalizedMimeType)) {
    return normalizedMimeType
  }

  const normalizedFallbackMimeType = String(fallbackMimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (/^image\//.test(normalizedFallbackMimeType)) {
    return normalizedFallbackMimeType
  }

  return 'image/png'
}

function resolveSourceAssetFileExtension(sourceUrl, mimeType) {
  const normalizedMimeType = normalizeSourceMimeType(mimeType)
  const mimeExtensionMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff'
  }
  if (mimeExtensionMap[normalizedMimeType]) {
    return mimeExtensionMap[normalizedMimeType]
  }

  try {
    const extname = path
      .extname(new URL(sourceUrl).pathname || '')
      .toLowerCase()
    if (/^\.[a-z0-9]+$/.test(extname)) {
      return extname
    }
  } catch (error) {
    return '.png'
  }

  return '.png'
}

async function downloadSourceAssetBuffer(sourceUrl, redirectCount = 0) {
  if (redirectCount > SOURCE_ASSET_FETCH_REDIRECT_LIMIT) {
    throw new Error('封面图远程地址重定向次数过多')
  }

  const parsedUrl = new URL(sourceUrl)
  const transport = parsedUrl.protocol === 'https:' ? https : http
  return await new Promise((resolve, reject) => {
    const request = transport.get(
      parsedUrl,
      {
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'wikimoe-cover-image-fetch/1.0'
        },
        timeout: SOURCE_ASSET_FETCH_TIMEOUT_MS
      },
      response => {
        const statusCode = Number(response.statusCode || 0)
        const location = String(response.headers.location || '').trim()

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume()
          let redirectUrl = ''
          try {
            redirectUrl = new URL(location, parsedUrl).toString()
          } catch (error) {
            reject(new Error('封面图远程地址重定向目标不合法'))
            return
          }
          downloadSourceAssetBuffer(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume()
          reject(new Error(`HTTP ${statusCode}`))
          return
        }

        const chunkList = []
        response.on('data', chunk => {
          chunkList.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          const buffer = Buffer.concat(chunkList)
          if (!buffer.length) {
            reject(new Error('封面图远程响应为空'))
            return
          }
          resolve({
            buffer,
            finalUrl: parsedUrl.toString(),
            mimeType: String(response.headers['content-type'] || '')
              .split(';')[0]
              .trim()
          })
        })
        response.on('error', reject)
      }
    )
    request.on('timeout', () => {
      request.destroy(new Error('封面图远程请求超时'))
    })
    request.on('error', reject)
  })
}

async function downloadSourceCoverToTempFile({ job, attachment, sourceUrl }) {
  const downloadResult = await downloadSourceAssetBuffer(sourceUrl)
  const sourceMimeType = normalizeSourceMimeType(
    downloadResult.mimeType,
    attachment?.mimetype || ''
  )
  const filename = `${buildStableHash([
    'cover-source-download-v1',
    getAttachmentId(attachment),
    downloadResult.finalUrl,
    attachment?.updatedAt || ''
  ])}-source${resolveSourceAssetFileExtension(
    downloadResult.finalUrl,
    sourceMimeType
  )}`
  const writeResult = await coverImageTempFileService.writeBufferFile({
    jobId: getJobId(job),
    filename,
    buffer: downloadResult.buffer
  })
  return {
    sourceFilePath: writeResult.filePath,
    sourceImageContentHash: buildBufferHash(downloadResult.buffer),
    sourceMimeType,
    sourcePreviewUrl: downloadResult.finalUrl
  }
}

async function resolveSourceCover(job, post) {
  const rawAttachment = resolveFirstCoverImage(post)
  const attachment = await normalizeCoverAttachment(rawAttachment)
  if (!attachment) {
    return {
      ok: false,
      status: 'recognition-skipped',
      message: '当前文章没有封面图'
    }
  }

  let sourceAssetDomainConfig = null
  try {
    sourceAssetDomainConfig = getSourceAssetDomainConfig()
  } catch (error) {
    return {
      ok: false,
      status: 'recognition-failed',
      message: error.message
    }
  }

  let sourceFilePath = ''
  let sourceImageContentHash = ''
  let sourceMimeType = normalizeSourceMimeType(attachment?.mimetype || '')
  let sourcePreviewUrl = buildSourceCoverPreviewUrl(
    attachment,
    sourceAssetDomainConfig
  )

  if (sourceAssetDomainConfig.enabled) {
    const remoteAssetPath = getSourceCoverDownloadPath(attachment)
    const remoteSourceUrl = buildAbsoluteSourceAssetUrl(
      remoteAssetPath,
      sourceAssetDomainConfig.value
    )
    if (!remoteSourceUrl) {
      return {
        ok: false,
        status: 'recognition-failed',
        message:
          '封面图缺少 filepath 或 thumfor，不能通过 SOURCE_ASSET_DOMAIN 获取源图'
      }
    }

    try {
      const remoteSource = await downloadSourceCoverToTempFile({
        job,
        attachment,
        sourceUrl: remoteSourceUrl
      })
      sourceFilePath = remoteSource.sourceFilePath
      sourceImageContentHash = remoteSource.sourceImageContentHash
      sourceMimeType = remoteSource.sourceMimeType
      sourcePreviewUrl = remoteSource.sourcePreviewUrl || sourcePreviewUrl
    } catch (error) {
      return {
        ok: false,
        status: 'recognition-failed',
        message: `封面图远程获取失败：${error.message}`
      }
    }
  } else {
    try {
      sourceFilePath = resolveSourceCoverLocalPath(attachment)
    } catch (error) {
      return { ok: false, status: 'recognition-failed', message: error.message }
    }
    if (!sourceFilePath) {
      return {
        ok: false,
        status: 'recognition-failed',
        message:
          '封面图无法解析为本地文件，请配置 SOURCE_ASSET_DOMAIN 后通过 HTTP 获取源图'
      }
    }
    try {
      await fs.promises.access(sourceFilePath, fs.constants.R_OK)
    } catch (error) {
      return {
        ok: false,
        status: 'recognition-failed',
        message:
          '封面图本地文件不存在或不可读，请配置 SOURCE_ASSET_DOMAIN 后通过 HTTP 获取源图'
      }
    }

    const sourceBuffer = await fs.promises.readFile(sourceFilePath)
    sourceImageContentHash = buildBufferHash(sourceBuffer)
  }

  const dimensions = getPreferredSourceImageDimensions(attachment)
  const sourceCoverKey = buildStableHash([
    'cover-source-v1',
    getAttachmentId(attachment),
    attachment.filepath || '',
    attachment.thumfor || '',
    attachment.updatedAt || '',
    sourceImageContentHash
  ])

  return {
    ok: true,
    attachment,
    sourceFilePath,
    sourceMimeType,
    sourcePreviewUrl,
    sourceImageContentHash,
    sourceCoverKey,
    dimensions
  }
}

function buildSourceImageInfo(coverInfo, dimensions) {
  const attachment = coverInfo.attachment
  return {
    filepath: coverInfo.sourcePreviewUrl || getAttachmentPreviewUrl(attachment),
    localPath: coverInfo.sourceFilePath,
    width: dimensions.width,
    height: dimensions.height,
    ratio: dimensions.ratio,
    contentHash: coverInfo.sourceImageContentHash
  }
}

function buildCoverImagePreviewEntry({
  artifact,
  sourcePost,
  targetPost,
  languageCode,
  warningMessage = ''
}) {
  return {
    entryType: COVER_IMAGE_ENTRY_TYPE,
    entryKey: [
      'cover-image',
      normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
      normalizeIdValue(targetPost?._id),
      languageCode || ''
    ].join(':'),
    scope: 'post-cover-image',
    sourcePostId: normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
    targetPostId: normalizeIdValue(targetPost?._id),
    languageCode: languageCode || '',
    artifactId: artifact.artifactId,
    generationKey: artifact.generationKey || '',
    recognitionKey: artifact.recognitionKey || '',
    sourceCoverUrl: artifact.sourceImage?.filepath || '',
    generatedCoverUrl: artifact.generatedImage?.previewUrl || '',
    sourceTitle: artifact.sourceTitle || '',
    targetTitle: artifact.targetTitle || '',
    recognition: artifact.recognition || {},
    status: artifact.status,
    reused: artifact.reused === true,
    reusedFromArtifactId: artifact.reusedFromArtifactId || '',
    adopted: artifact.adopted === true,
    adoptedAttachmentId: artifact.adoptedAttachmentId || null,
    warningMessage
  }
}

function buildBaseArtifact({
  job,
  coverInfo,
  dimensions,
  sourcePost,
  targetPost,
  sourceTitle,
  targetTitle,
  sourceLanguageCode,
  targetLanguageCode,
  recognitionKey,
  generationKey = '',
  status,
  provider = {},
  recognition = null,
  promptHash = ''
}) {
  const now = new Date()
  const artifact = {
    artifactId: createArtifactId(),
    artifactType: COVER_IMAGE_ARTIFACT_TYPE,
    jobId: getJobId(job),
    generationKey,
    recognitionKey,
    sourceCoverKey: coverInfo.sourceCoverKey,
    sourceCoverAttachmentId: getAttachmentId(coverInfo.attachment),
    sourcePostId: normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
    sourcePostType: Number(sourcePost?.type || 0),
    targetPostId: normalizeIdValue(targetPost?._id),
    sourceTitle,
    targetTitle,
    targetTitleHash: buildTargetTitleHash(targetTitle),
    languageCodes: targetLanguageCode ? [targetLanguageCode] : [],
    relatedPostSourceIds: [],
    sourceImage: buildSourceImageInfo(coverInfo, dimensions),
    recognition: recognition || null,
    recognitionInput: null,
    generatedImage: null,
    error: null,
    provider,
    promptHash,
    status,
    reused: false,
    reusedFromArtifactId: '',
    adopted: false,
    adoptedAt: null,
    adoptedAttachmentId: null,
    cleanedAt: null,
    createdAt: now,
    updatedAt: now
  }
  return artifact
}

function addLanguageCodeToArtifact(artifact, languageCode) {
  if (!languageCode) {
    return
  }
  if (!Array.isArray(artifact.languageCodes)) {
    artifact.languageCodes = []
  }
  if (!artifact.languageCodes.includes(languageCode)) {
    artifact.languageCodes.push(languageCode)
  }
}

function createSkippedResult({
  job,
  sourcePost,
  targetPost,
  languageCode,
  status,
  message
}) {
  const artifact = {
    artifactId: createArtifactId(),
    artifactType: COVER_IMAGE_ARTIFACT_TYPE,
    jobId: getJobId(job),
    generationKey: '',
    recognitionKey: '',
    sourceCoverKey: '',
    sourceCoverAttachmentId: '',
    sourcePostId: normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
    sourcePostType: Number(sourcePost?.type || 0),
    targetPostId: normalizeIdValue(targetPost?._id),
    sourceTitle: sourcePost?.title || '',
    targetTitle: '',
    targetTitleHash: '',
    languageCodes: languageCode ? [languageCode] : [],
    relatedPostSourceIds: [],
    sourceImage: null,
    recognition: null,
    recognitionInput: null,
    generatedImage: null,
    provider: {},
    promptHash: '',
    status,
    reused: false,
    reusedFromArtifactId: '',
    adopted: false,
    adoptedAt: null,
    adoptedAttachmentId: null,
    cleanedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  return {
    artifact,
    previewEntry: buildCoverImagePreviewEntry({
      artifact,
      sourcePost,
      targetPost,
      languageCode,
      warningMessage: message
    }),
    warnings: [
      createWarning(status, message, {
        sourcePostId: artifact.sourcePostId,
        languageCode
      })
    ]
  }
}

async function runRecognition({
  job,
  registry,
  coverInfo,
  sourcePost,
  targetTitle,
  sourceLanguageCode,
  targetLanguageCode,
  recognitionKey,
  recognitionSettings
}) {
  if (registry.recognitionMap.has(recognitionKey)) {
    const cached = registry.recognitionMap.get(recognitionKey)
    if (cached.promise) {
      return await cached.promise
    }
    return cached
  }

  let currentRecognitionInput = null
  const promise = (async () => {
    currentRecognitionInput =
      await coverImageRecognitionInputService.createRecognitionInputImage({
        jobId: getJobId(job),
        recognitionKey,
        sourceFilePath: coverInfo.sourceFilePath
      })
    const prompt = coverImagePromptService.buildCoverRecognitionPrompt({
      basePrompt: recognitionSettings.prompt,
      sourceTitle: sourcePost.title || '',
      sourceLanguageCode,
      targetLanguageCode,
      targetTitle,
      confidenceThreshold: recognitionSettings.confidenceThreshold
    })
    const response = await geminiImageRecognitionService.recognizeCoverTitle({
      runtimeSettings: recognitionSettings,
      prompt,
      imageDataUrl: currentRecognitionInput.dataUrl,
      confidenceThreshold: recognitionSettings.confidenceThreshold,
      diagnosticContext: {
        phase: 'recognition',
        jobId: getJobId(job),
        recognitionKey,
        sourcePostId: normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
        sourceLanguageCode,
        targetLanguageCode
      }
    })
    if (!response.ok) {
      return {
        status: 'failed',
        recognitionInput: currentRecognitionInput,
        error: response
      }
    }
    return {
      status: 'success',
      recognitionInput: currentRecognitionInput,
      result: response.result,
      provider: {
        recognitionProvider: response.provider,
        recognitionModel: response.model
      }
    }
  })()

  registry.recognitionMap.set(recognitionKey, {
    status: 'running',
    promise
  })
  try {
    const result = await promise
    registry.recognitionMap.set(recognitionKey, result)
    return result
  } catch (error) {
    const diagnostics =
      error?.diagnostics ||
      buildCoverStageDiagnostics({
        phase: 'run-recognition',
        job,
        sourcePost,
        sourceLanguageCode,
        targetLanguageCode,
        recognitionKey,
        error
      })
    logDiagnostic('error', 'cover.translation.recognition_failed', diagnostics)
    const failedResult = {
      status: 'failed',
      recognitionInput: currentRecognitionInput,
      error: {
        message: error?.message || '封面图识别失败',
        diagnostics
      }
    }
    registry.recognitionMap.set(recognitionKey, failedResult)
    return failedResult
  }
}

async function runGeneration({
  job,
  registry,
  coverInfo,
  dimensions,
  sourcePost,
  targetPost,
  targetTitle,
  sourceLanguageCode,
  targetLanguageCode,
  recognitionKey,
  recognition,
  recognitionInput,
  generationKey,
  generationSettings,
  recognitionProvider
}) {
  if (registry.generationMap.has(generationKey)) {
    const cached = registry.generationMap.get(generationKey)
    if (cached.promise) {
      return await cached.promise
    }
    addLanguageCodeToArtifact(cached.artifact, targetLanguageCode)
    return {
      ...cached,
      reused: true,
      reusedFromArtifactId: cached.artifact?.artifactId || ''
    }
  }

  const promise = (async () => {
    const selectedRatio = selectNearestImageRatio(
      generationSettings.provider,
      dimensions.ratio
    )
    const generationPrompt = coverImagePromptService.buildCoverGenerationPrompt(
      {
        basePrompt: generationSettings.promptPrefix,
        provider: generationSettings.provider,
        sourceTitle: sourcePost.title || '',
        recognizedTitleText: recognition.recognizedTitleText || '',
        sourceLanguageCode,
        targetTitle,
        targetLanguageCode,
        targetWidth: dimensions.width,
        targetHeight: dimensions.height,
        selectedGenerationRatio: selectedRatio?.value || '',
        titleRegion: recognition.titleRegion
      }
    )
    const sourceBuffer = await fs.promises.readFile(coverInfo.sourceFilePath)
    const sourceMimeType = coverInfo.sourceMimeType || 'image/png'
    const sourceImageDataUrl = `data:${sourceMimeType};base64,${sourceBuffer.toString('base64')}`
    const generated = await geminiImageGenerationService.generateCoverImage({
      settings: generationSettings,
      prompt: generationPrompt.prompt,
      sourceFilePath: coverInfo.sourceFilePath,
      sourceImageDataUrl,
      selectedRatio,
      diagnosticContext: {
        phase: 'generation',
        jobId: getJobId(job),
        recognitionKey,
        generationKey,
        sourcePostId: normalizeIdValue(sourcePost?._id || sourcePost?.sourceId),
        targetPostId: normalizeIdValue(targetPost?._id),
        sourceLanguageCode,
        targetLanguageCode
      }
    })
    const generatedImage = await coverImagePostprocessService.resizeCoverExact({
      jobId: getJobId(job),
      generationKey,
      attemptNo: 1,
      inputBuffer: generated.buffer,
      targetWidth: dimensions.width,
      targetHeight: dimensions.height
    })
    const artifact = buildBaseArtifact({
      job,
      coverInfo,
      dimensions,
      sourcePost,
      targetPost,
      sourceTitle: sourcePost.title || '',
      targetTitle,
      sourceLanguageCode,
      targetLanguageCode,
      recognitionKey,
      generationKey,
      status: 'generated',
      provider: {
        ...recognitionProvider,
        generationProvider: generationSettings.provider,
        generationModel: generationSettings.model
      },
      recognition,
      promptHash: generationPrompt.promptHash
    })
    artifact.recognitionInput = recognitionInput
    artifact.generatedImage = generatedImage
    registry.artifacts.set(artifact.artifactId, artifact)
    return {
      status: 'generated',
      artifact
    }
  })()

  registry.generationMap.set(generationKey, {
    status: 'running',
    promise
  })
  try {
    const result = await promise
    registry.generationMap.set(generationKey, result)
    return result
  } catch (error) {
    const diagnostics =
      error?.diagnostics ||
      buildCoverStageDiagnostics({
        phase: 'run-generation',
        job,
        sourcePost,
        targetPost,
        sourceLanguageCode,
        targetLanguageCode,
        recognitionKey,
        generationKey,
        error
      })
    logDiagnostic('error', 'cover.translation.generation_failed', diagnostics)
    const failedResult = {
      status: 'failed',
      error: {
        message: error?.message || '图像生成失败',
        diagnostics
      }
    }
    registry.generationMap.set(generationKey, failedResult)
    return failedResult
  }
}

function normalizeTitleValue(value) {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function resolveTargetTitle(targetTitle, previewEntries, targetPost) {
  const titleEntry = (previewEntries || []).find(entry => {
    return entry && entry.scope === 'post' && entry.fieldName === 'title'
  })
  const previewTitle = [
    titleEntry?.nextPreviewRawValue,
    titleEntry?.nextPreviewText,
    titleEntry?.value,
    titleEntry?.previewRawValue,
    titleEntry?.previewText,
    titleEntry?.currentPreviewRawValue,
    titleEntry?.currentPreviewText
  ]
    .map(normalizeTitleValue)
    .find(Boolean)
  if (previewTitle) {
    return previewTitle
  }

  const normalizedTargetTitle = normalizeTitleValue(targetTitle)
  if (normalizedTargetTitle) {
    return normalizedTargetTitle
  }

  return normalizeTitleValue(targetPost?.title)
}

async function processCoverImageTranslation(options = {}) {
  const registry = options.registry || createCoverImageRegistry()
  const sourcePost = options.sourcePost || {}
  const targetPost = options.targetPost || {}
  const languageCode =
    options.targetLanguageCode || targetPost.languageCode || ''

  if (!isCoverSupportedPostType(sourcePost.type)) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: 'recognition-skipped',
      message: '当前文章类型不支持封面图翻译'
    })
  }

  const targetTitle = resolveTargetTitle(
    options.targetTitle,
    options.previewEntries,
    targetPost
  )
  if (!String(sourcePost.title || '').trim()) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: 'recognition-failed',
      message: '源文章标题为空，不能识别封面图标题'
    })
  }
  if (!targetTitle) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: 'recognition-failed',
      message: '目标标题为空，不能生成封面图翻译'
    })
  }

  const coverInfo = await resolveSourceCover(options.job, sourcePost)
  if (!coverInfo.ok) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: coverInfo.status,
      message: coverInfo.message
    })
  }
  let dimensions = coverInfo.dimensions
  if (!dimensions) {
    const sharp = require('sharp')
    const metadata = await sharp(coverInfo.sourceFilePath).metadata()
    if (metadata.width && metadata.height) {
      dimensions = {
        width: metadata.width,
        height: metadata.height,
        ratio: metadata.width / metadata.height
      }
    }
  }
  if (!dimensions) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: 'recognition-failed',
      message: '无法读取封面图尺寸，不能生成封面图翻译'
    })
  }

  let recognitionSettings = null
  let generationSettings = null
  try {
    recognitionSettings =
      await aiSettingsService.getImageRecognitionRuntimeSettings()
    generationSettings =
      await aiSettingsService.getImageGenerationRuntimeSettings()
  } catch (error) {
    return createSkippedResult({
      job: options.job,
      sourcePost,
      targetPost,
      languageCode,
      status: 'recognition-failed',
      message: error?.message || '图像识别或图像生成配置不可用'
    })
  }

  const recognitionKey = buildCoverRecognitionKey(
    coverInfo.sourceCoverKey,
    sourcePost.title || ''
  )
  const recognitionResult = await runRecognition({
    job: options.job,
    registry,
    coverInfo,
    sourcePost,
    targetTitle,
    sourceLanguageCode: options.sourceLanguageCode,
    targetLanguageCode: languageCode,
    recognitionKey,
    recognitionSettings
  })

  if (recognitionResult.status !== 'success') {
    const artifact = buildBaseArtifact({
      job: options.job,
      coverInfo,
      dimensions,
      sourcePost,
      targetPost,
      sourceTitle: sourcePost.title || '',
      targetTitle,
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCode: languageCode,
      recognitionKey,
      status: 'recognition-failed',
      provider: {
        recognitionProvider: recognitionSettings.provider,
        recognitionModel: recognitionSettings.model
      }
    })
    artifact.recognitionInput = recognitionResult.recognitionInput || null
    artifact.error = recognitionResult.error || null
    registry.artifacts.set(artifact.artifactId, artifact)
    const warningMessage =
      recognitionResult.error?.errorMessage || '封面图识别失败'
    return {
      artifact,
      previewEntry: buildCoverImagePreviewEntry({
        artifact,
        sourcePost,
        targetPost,
        languageCode,
        warningMessage
      }),
      warnings: [createWarning('recognition-failed', warningMessage)]
    }
  }

  if (recognitionResult.result.shouldTranslate !== true) {
    const artifact = buildBaseArtifact({
      job: options.job,
      coverInfo,
      dimensions,
      sourcePost,
      targetPost,
      sourceTitle: sourcePost.title || '',
      targetTitle,
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCode: languageCode,
      recognitionKey,
      status: 'not-required',
      provider: recognitionResult.provider,
      recognition: recognitionResult.result
    })
    artifact.recognitionInput = recognitionResult.recognitionInput
    registry.artifacts.set(artifact.artifactId, artifact)
    return {
      artifact,
      previewEntry: buildCoverImagePreviewEntry({
        artifact,
        sourcePost,
        targetPost,
        languageCode
      }),
      warnings: []
    }
  }

  const generationKey = buildCoverGenerationKey(
    coverInfo.sourceCoverKey,
    targetTitle
  )
  const generationResult = await runGeneration({
    job: options.job,
    registry,
    coverInfo,
    dimensions,
    sourcePost,
    targetPost,
    targetTitle,
    sourceLanguageCode: options.sourceLanguageCode,
    targetLanguageCode: languageCode,
    recognitionKey,
    recognition: recognitionResult.result,
    recognitionInput: recognitionResult.recognitionInput,
    generationKey,
    generationSettings,
    recognitionProvider: recognitionResult.provider
  })

  if (generationResult.status !== 'generated') {
    const artifact = buildBaseArtifact({
      job: options.job,
      coverInfo,
      dimensions,
      sourcePost,
      targetPost,
      sourceTitle: sourcePost.title || '',
      targetTitle,
      sourceLanguageCode: options.sourceLanguageCode,
      targetLanguageCode: languageCode,
      recognitionKey,
      generationKey,
      status: 'generation-failed',
      provider: {
        ...recognitionResult.provider,
        generationProvider: generationSettings.provider,
        generationModel: generationSettings.model
      },
      recognition: recognitionResult.result
    })
    artifact.recognitionInput = recognitionResult.recognitionInput
    artifact.error = generationResult.error || null
    registry.artifacts.set(artifact.artifactId, artifact)
    const warningMessage = generationResult.error?.message || '封面图生成失败'
    return {
      artifact,
      previewEntry: buildCoverImagePreviewEntry({
        artifact,
        sourcePost,
        targetPost,
        languageCode,
        warningMessage
      }),
      warnings: [createWarning('generation-failed', warningMessage)]
    }
  }

  const artifact = generationResult.artifact
  if (generationResult.reused) {
    const previewArtifact = {
      ...artifact,
      reused: true,
      reusedFromArtifactId: generationResult.reusedFromArtifactId
    }
    return {
      artifact: null,
      previewEntry: buildCoverImagePreviewEntry({
        artifact: previewArtifact,
        sourcePost,
        targetPost,
        languageCode
      }),
      warnings: []
    }
  }

  return {
    artifact,
    previewEntry: buildCoverImagePreviewEntry({
      artifact,
      sourcePost,
      targetPost,
      languageCode
    }),
    warnings: []
  }
}

function buildRegistrySnapshot(registry) {
  const coverImageGenerationMap = {}
  registry.generationMap.forEach((value, key) => {
    coverImageGenerationMap[key] = {
      status: value.status || '',
      artifactId: value.artifact?.artifactId || value.artifactId || '',
      error: value.error || null
    }
  })
  const coverImageRecognitionMap = {}
  registry.recognitionMap.forEach((value, key) => {
    coverImageRecognitionMap[key] = {
      status: value.status || '',
      result: value.result || null,
      error: value.error || null
    }
  })
  return {
    coverImageArtifacts: Array.from(registry.artifacts.values()),
    coverImageGenerationMap,
    coverImageRecognitionMap
  }
}

module.exports = {
  buildCoverImagePreviewEntry,
  buildRegistrySnapshot,
  createCoverImageRegistry,
  processCoverImageTranslation,
  resolveSourceCover,
  resolveTargetTitle
}
