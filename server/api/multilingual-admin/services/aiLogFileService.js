const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')

const AI_LOG_ROOT_DIR = path.resolve(__dirname, '..', '..', '..', 'ailog')
const SERVER_RELATIVE_ROOT = 'server/ailog'
const TRANSLATION_JOB_LOG_SCHEMA = 'wikimoe.ai.log.translation-job'
const AI_USAGE_RAW_RESPONSE_SCHEMA = 'wikimoe.ai.log.ai-usage.raw-response'
const CHUNK_CACHE_SCHEMA = 'wikimoe.ai.log.translation-job.chunk-cache'
const FILE_REF_SCHEMA = 'wikimoe.ai.log.file-ref'
const FILE_REF_VERSION = 1

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function getSafePathPart(value, fallback = 'unknown') {
  const text = normalizeText(value)
  if (!text) {
    return fallback
  }
  return text.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function toPosixPath(value) {
  return normalizeText(value).replace(/\\/g, '/')
}

function resolveInsideRoot(relativePath) {
  const normalizedRelativePath = toPosixPath(relativePath)
  const absolutePath = path.resolve(AI_LOG_ROOT_DIR, normalizedRelativePath)
  const relativeToRoot = path.relative(AI_LOG_ROOT_DIR, absolutePath)
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('AI日志文件路径越界')
  }
  return absolutePath
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeJsonFile(relativePath, value) {
  const absolutePath = resolveInsideRoot(relativePath)
  await ensureDirectory(path.dirname(absolutePath))
  const tempPath = `${absolutePath}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(value), 'utf8')
  await fs.rename(tempPath, absolutePath)
  const stat = await fs.stat(absolutePath)
  return {
    relativePath: toPosixPath(relativePath),
    sizeBytes: stat.size
  }
}

async function readJsonFile(relativePath) {
  const absolutePath = resolveInsideRoot(relativePath)
  const content = await fs.readFile(absolutePath, 'utf8')
  return JSON.parse(content)
}

function buildFileRef({ type, relativePath, sizeBytes, count, meta }) {
  return {
    schema: FILE_REF_SCHEMA,
    version: FILE_REF_VERSION,
    storage: 'file',
    type,
    root: SERVER_RELATIVE_ROOT,
    relativePath: toPosixPath(relativePath),
    sizeBytes: Number(sizeBytes || 0),
    count: Number(count || 0),
    meta: meta || {},
    updatedAt: new Date()
  }
}

function getTranslationJobBaseDir(jobId) {
  return ['translation-jobs', getSafePathPart(jobId, 'unknown-job')].join('/')
}

async function writeTranslationJobAiJsonLogs({ jobId, logs }) {
  const logList = Array.isArray(logs) ? logs : []
  const relativePath = `${getTranslationJobBaseDir(jobId)}/ai-json-logs.json`
  const now = new Date()
  const fileResult = await writeJsonFile(relativePath, {
    schema: TRANSLATION_JOB_LOG_SCHEMA,
    version: 1,
    jobId: normalizeText(jobId),
    logCount: logList.length,
    logs: logList,
    createdAt: now,
    updatedAt: now
  })
  return buildFileRef({
    type: 'translation-job-ai-json-logs',
    relativePath: fileResult.relativePath,
    sizeBytes: fileResult.sizeBytes,
    count: logList.length,
    meta: {
      jobId: normalizeText(jobId)
    }
  })
}

async function readTranslationJobAiJsonLogs(storageRef) {
  if (!storageRef || storageRef.storage !== 'file') {
    return []
  }
  if (!storageRef.relativePath) {
    return []
  }
  const fileData = await readJsonFile(storageRef.relativePath)
  if (!Array.isArray(fileData.logs)) {
    throw new Error('AI任务日志文件结构错误')
  }
  return fileData.logs
}

function getChunkCacheFileName(cacheOptions) {
  const hash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        scopeKey: cacheOptions.scopeKey,
        chunkIndex: cacheOptions.chunkIndex,
        chunkInputHash: cacheOptions.chunkInputHash
      })
    )
    .digest('hex')
  return `${String(cacheOptions.chunkIndex).padStart(4, '0')}-${hash.slice(
    0,
    24
  )}.json`
}

async function writeTranslationJobAiChunkCacheRecord({
  jobId,
  cacheOptions,
  cacheRecord,
  schema,
  version
}) {
  const relativePath = [
    getTranslationJobBaseDir(jobId),
    'chunk-cache',
    getChunkCacheFileName(cacheOptions)
  ].join('/')
  const now = new Date()
  const fileResult = await writeJsonFile(relativePath, {
    schema: CHUNK_CACHE_SCHEMA,
    version: 1,
    jobId: normalizeText(jobId),
    cache: {
      schema,
      version,
      cacheKey: cacheOptions.cacheKey,
      scopeKey: cacheOptions.scopeKey,
      chunkIndex: cacheOptions.chunkIndex,
      chunkInputHash: cacheOptions.chunkInputHash
    },
    record: cacheRecord,
    createdAt: now,
    updatedAt: now
  })
  return {
    schema,
    version,
    storage: 'file',
    cacheKey: cacheOptions.cacheKey,
    scopeKey: cacheOptions.scopeKey,
    chunkIndex: cacheOptions.chunkIndex,
    chunkInputHash: cacheOptions.chunkInputHash,
    createdAt: now,
    relativePath: fileResult.relativePath,
    sizeBytes: fileResult.sizeBytes
  }
}

async function readTranslationJobAiChunkCacheRecord(record) {
  if (!record || record.storage !== 'file') {
    return record
  }
  if (!record.relativePath) {
    return null
  }
  const fileData = await readJsonFile(record.relativePath)
  if (!fileData || typeof fileData !== 'object') {
    throw new Error('AI分片缓存文件结构错误')
  }
  if (!fileData.record || typeof fileData.record !== 'object') {
    throw new Error('AI分片缓存文件缺少记录内容')
  }
  return fileData.record
}

async function readTranslationJobAiChunkCacheRecordByOptions({
  jobId,
  cacheOptions
}) {
  const relativePath = [
    getTranslationJobBaseDir(jobId),
    'chunk-cache',
    getChunkCacheFileName(cacheOptions)
  ].join('/')
  try {
    return await readTranslationJobAiChunkCacheRecord({
      storage: 'file',
      relativePath
    })
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function getDatePathParts(date) {
  const value = date instanceof Date ? date : new Date()
  const year = String(value.getFullYear())
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return { year, month, day }
}

function getTranslationJobIdFromMeta(meta) {
  const candidateList = [
    meta?.translationJobId,
    meta?.jobId,
    meta?.context?.translationJobId,
    meta?.context?.jobId
  ]
  for (const candidate of candidateList) {
    const text = normalizeText(candidate)
    if (text) {
      return text
    }
  }
  return ''
}

async function writeAiUsageRawResponse({
  id,
  provider,
  operation,
  model,
  requestId,
  rawResponse,
  meta,
  date
}) {
  const usageId = getSafePathPart(id, crypto.randomUUID())
  const translationJobId = getTranslationJobIdFromMeta(meta || {})
  let relativePath = ''
  if (translationJobId) {
    relativePath = [
      getTranslationJobBaseDir(translationJobId),
      'ai-usage',
      `${usageId}.json`
    ].join('/')
  } else {
    const dateParts = getDatePathParts(date)
    relativePath = [
      'ai-usage',
      dateParts.year,
      dateParts.month,
      dateParts.day,
      `${usageId}.json`
    ].join('/')
  }

  const now = new Date()
  const fileResult = await writeJsonFile(relativePath, {
    schema: AI_USAGE_RAW_RESPONSE_SCHEMA,
    version: 1,
    id: normalizeText(id),
    provider: normalizeText(provider),
    operation: normalizeText(operation),
    model: normalizeText(model),
    requestId: normalizeText(requestId),
    translationJobId,
    rawResponse,
    createdAt: now,
    updatedAt: now
  })
  return buildFileRef({
    type: 'ai-usage-raw-response',
    relativePath: fileResult.relativePath,
    sizeBytes: fileResult.sizeBytes,
    count: 1,
    meta: {
      id: normalizeText(id),
      provider: normalizeText(provider),
      operation: normalizeText(operation),
      requestId: normalizeText(requestId),
      translationJobId
    }
  })
}

async function removeDirectory(relativePath) {
  const absolutePath = resolveInsideRoot(relativePath)
  await fs.rm(absolutePath, { recursive: true, force: true })
}

async function deleteTranslationJobAiChunkCache(jobId) {
  const relativePath = `${getTranslationJobBaseDir(jobId)}/chunk-cache`
  await removeDirectory(relativePath)
  return {
    deleted: true,
    relativePath
  }
}

async function deleteTranslationJobAiLogDirectory(jobId) {
  const relativePath = getTranslationJobBaseDir(jobId)
  await removeDirectory(relativePath)
  return {
    deleted: true,
    relativePath
  }
}

async function collectDirectoryStats(absolutePath) {
  let totalSizeBytes = 0
  let fileCount = 0
  let directoryCount = 0
  let exists = true

  async function visit(currentPath) {
    let entries = []
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        exists = false
        return
      }
      throw error
    }

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        directoryCount += 1
        await visit(entryPath)
        continue
      }
      if (entry.isFile()) {
        const stat = await fs.stat(entryPath)
        totalSizeBytes += stat.size
        fileCount += 1
      }
    }
  }

  await visit(absolutePath)
  return {
    exists,
    totalSizeBytes,
    fileCount,
    directoryCount
  }
}

async function getAiLogStorageSummary() {
  const stats = await collectDirectoryStats(AI_LOG_ROOT_DIR)
  return {
    key: 'aiLogs',
    label: 'AI 全量日志',
    root: SERVER_RELATIVE_ROOT,
    exists: stats.exists,
    fileCount: stats.fileCount,
    directoryCount: stats.directoryCount,
    totalSizeBytes: stats.totalSizeBytes
  }
}

module.exports = {
  deleteTranslationJobAiChunkCache,
  deleteTranslationJobAiLogDirectory,
  getAiLogStorageSummary,
  readTranslationJobAiChunkCacheRecord,
  readTranslationJobAiChunkCacheRecordByOptions,
  readTranslationJobAiJsonLogs,
  writeAiUsageRawResponse,
  writeTranslationJobAiChunkCacheRecord,
  writeTranslationJobAiJsonLogs
}
