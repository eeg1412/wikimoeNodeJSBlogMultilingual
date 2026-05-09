const fs = require('fs')
const path = require('path')
const { sanitizeSafePathPart } = require('../utils/coverImageTranslationUtils')

const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..')
const CONTENT_ROOT = path.join(SERVER_ROOT, 'public', 'content')
const COVER_TEMP_ROOT = path.join(CONTENT_ROOT, 'ai-cover-translations', 'tmp')
const COVER_TEMP_PUBLIC_PREFIX =
  '/multilingual-assets/content/ai-cover-translations/tmp'

function resolveCoverTempRoot() {
  return path.resolve(COVER_TEMP_ROOT)
}

function resolveJobTempDir(jobId) {
  const resolvedRoot = resolveCoverTempRoot()
  const resolvedJobDir = path.resolve(getCoverImageJobTempDir(jobId))
  const relativePath = path.relative(resolvedRoot, resolvedJobDir)
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('job temp dir is outside AI cover temp root')
  }
  return resolvedJobDir
}

function getCoverImageJobTempDir(jobId) {
  const safeJobId = sanitizeSafePathPart(jobId, 'jobId')
  return path.join(COVER_TEMP_ROOT, safeJobId)
}

function assertPathInsideCoverTempRoot(filePath) {
  const resolvedRoot = resolveCoverTempRoot()
  const resolvedPath = path.resolve(filePath)
  const relativePath = path.relative(resolvedRoot, resolvedPath)
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('file path is outside AI cover temp root')
  }
  return resolvedPath
}

function assertPathInsideJobTempDir(jobId, filePath) {
  const resolvedJobDir = resolveJobTempDir(jobId)
  const resolvedPath = path.resolve(filePath)
  const relativePath = path.relative(resolvedJobDir, resolvedPath)
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('file path is outside current job cover temp dir')
  }
  assertPathInsideCoverTempRoot(resolvedPath)
  return resolvedPath
}

async function ensureCoverImageJobTempDir(jobId) {
  const tempDir = getCoverImageJobTempDir(jobId)
  await fs.promises.mkdir(tempDir, { recursive: true })
  return tempDir
}

function buildTempPreviewUrl(jobId, filename) {
  const safeJobId = sanitizeSafePathPart(jobId, 'jobId')
  const safeFilename = String(filename || '').trim()
  if (!/^[a-zA-Z0-9_.-]+$/.test(safeFilename)) {
    throw new Error('filename contains unsafe characters')
  }
  return `${COVER_TEMP_PUBLIC_PREFIX}/${safeJobId}/${safeFilename}`
}

async function writeBufferFile({ jobId, filename, buffer }) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('buffer is required')
  }
  const tempDir = await ensureCoverImageJobTempDir(jobId)
  const filePath = assertPathInsideJobTempDir(
    jobId,
    path.join(tempDir, filename)
  )
  await fs.promises.writeFile(filePath, buffer)
  const stats = await fs.promises.stat(filePath)
  return {
    filePath,
    previewUrl: buildTempPreviewUrl(jobId, filename),
    fileSize: stats.size
  }
}

async function readGeneratedCoverFile(artifact, jobId = '') {
  const filePath = artifact?.generatedImage?.tempFilePath
  if (!filePath) {
    throw new Error('artifact generated image path is empty')
  }
  const resolvedPath = jobId
    ? assertPathInsideJobTempDir(jobId, filePath)
    : assertPathInsideCoverTempRoot(filePath)
  return await fs.promises.readFile(resolvedPath)
}

async function deleteFileIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath)
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function cleanupArtifactFiles(jobId, artifact) {
  const cleanedFiles = []
  const failedFiles = []
  const pathList = [
    artifact?.generatedImage?.tempFilePath,
    artifact?.recognitionInput?.inputFilePath
  ].filter(Boolean)

  for (const filePath of pathList) {
    try {
      const resolvedPath = assertPathInsideJobTempDir(jobId, filePath)
      const deleted = await deleteFileIfExists(resolvedPath)
      if (deleted) {
        cleanedFiles.push(resolvedPath)
      }
    } catch (error) {
      failedFiles.push({ filePath, message: error.message })
    }
  }
  return { cleanedFiles, failedFiles }
}

async function cleanupJobTempDir(jobId, options = {}) {
  const resolvedJobDir = resolveJobTempDir(jobId)
  try {
    await fs.promises.rm(resolvedJobDir, {
      recursive: true,
      force: options.ignoreMissing === true
    })
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function cleanupJobCoverImageTempFiles(job, options = {}) {
  const jobId = String(job?._id || options.jobId || '').trim()
  const ignoreMissing = options.ignoreMissing === true
  const artifactIds = Array.isArray(options.artifactIds)
    ? options.artifactIds.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const artifactIdSet = new Set(artifactIds)
  const artifacts = Array.isArray(job?.result?.coverImageArtifacts)
    ? job.result.coverImageArtifacts
    : []
  const targetArtifacts = artifactIds.length
    ? artifacts.filter(artifact =>
        artifactIdSet.has(String(artifact.artifactId))
      )
    : artifacts

  const cleanedArtifactIds = []
  const failedArtifactIds = []
  const failedItems = []
  for (const artifact of targetArtifacts) {
    const result = await cleanupArtifactFiles(jobId, artifact)
    if (result.failedFiles.length > 0) {
      failedArtifactIds.push(String(artifact.artifactId))
      failedItems.push(
        ...result.failedFiles.map(item => {
          return {
            type: 'artifact-file',
            artifactId: String(artifact.artifactId || '').trim(),
            ...item
          }
        })
      )
      continue
    }
    cleanedArtifactIds.push(String(artifact.artifactId))
  }

  let jobTempDirRemoved = false
  if (artifactIds.length === 0) {
    try {
      jobTempDirRemoved = await cleanupJobTempDir(jobId, {
        ignoreMissing
      })
    } catch (error) {
      failedItems.push({
        type: 'job-temp-dir',
        jobId,
        message: error.message
      })
    }
  }

  let cleanupStatus = 'cleaned'
  if (failedArtifactIds.length > 0 || failedItems.length > 0) {
    cleanupStatus =
      cleanedArtifactIds.length > 0 || jobTempDirRemoved === true
        ? 'partial-cleaned'
        : 'cleanup-failed'
  }

  return {
    cleanupStatus,
    cleanedArtifactIds,
    failedArtifactIds,
    failedItems,
    jobTempDirRemoved
  }
}

async function collectDirectoryStorageStats(directoryPath) {
  const result = {
    totalSizeBytes: 0,
    fileCount: 0,
    directoryCount: 0
  }
  let entries = []
  try {
    entries = await fs.promises.readdir(directoryPath, { withFileTypes: true })
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return result
    }
    throw error
  }

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    const resolvedPath = assertPathInsideCoverTempRoot(entryPath)
    if (entry.isDirectory()) {
      result.directoryCount += 1
      const childResult = await collectDirectoryStorageStats(resolvedPath)
      result.totalSizeBytes += childResult.totalSizeBytes
      result.fileCount += childResult.fileCount
      result.directoryCount += childResult.directoryCount
      continue
    }
    if (!entry.isFile()) {
      continue
    }
    const stats = await fs.promises.stat(resolvedPath)
    result.totalSizeBytes += stats.size
    result.fileCount += 1
  }

  return result
}

async function getCoverImageTempStorageSummary() {
  const rootPath = resolveCoverTempRoot()
  const stats = await collectDirectoryStorageStats(rootPath)
  return {
    key: 'coverImageTempFiles',
    label: 'AI 翻译封面图缓存',
    rootPath,
    totalSizeBytes: stats.totalSizeBytes,
    fileCount: stats.fileCount,
    directoryCount: stats.directoryCount
  }
}

module.exports = {
  COVER_TEMP_ROOT,
  assertPathInsideCoverTempRoot,
  assertPathInsideJobTempDir,
  buildTempPreviewUrl,
  cleanupJobCoverImageTempFiles,
  ensureCoverImageJobTempDir,
  getCoverImageTempStorageSummary,
  getCoverImageJobTempDir,
  readGeneratedCoverFile,
  writeBufferFile
}
