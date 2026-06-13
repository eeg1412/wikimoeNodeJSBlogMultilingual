require('dotenv').config()

const fs = require('fs/promises')
const path = require('path')
const readline = require('readline')
const chalk = require('chalk')

const multilingualConnectionInfo = require('../mongodb/multilingualConnection')
const registerModels = require('../mongodb/modelFactory/registerModels')
const {
  TRANSLATION_JOB_TASK_ROLES
} = require('../utils/translationJobConstants')

const models = registerModels(multilingualConnectionInfo.connection)

// 这些目录与运行时服务保持一致：
// - AI 日志：server/ailog/translation-jobs/{jobId}
// - 封面图缓存（临时图片）：server/public/content/ai-cover-translations/tmp/{jobId}
const AI_LOG_JOB_ROOT = path.resolve(
  __dirname,
  '..',
  'ailog',
  'translation-jobs'
)
const COVER_IMAGE_TEMP_ROOT = path.resolve(
  __dirname,
  '..',
  'public',
  'content',
  'ai-cover-translations',
  'tmp'
)

function getSafePathPart(value) {
  const text = String(value === null || value === undefined ? '' : value).trim()
  if (!text) {
    return 'unknown-job'
  }
  return text.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getJobAiLogDir(jobId) {
  return path.join(AI_LOG_JOB_ROOT, getSafePathPart(jobId))
}

function getJobCoverImageTempDir(jobId) {
  return path.join(COVER_IMAGE_TEMP_ROOT, getSafePathPart(jobId))
}

function normalizeId(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'object' && typeof value.toHexString === 'function') {
    return value.toHexString()
  }
  return String(value)
}

/**
 * 判断目录是否存在并统计其占用大小，用于在删除前给出提示。
 * 目录不存在不会报错，返回 exists=false。
 * @param {string} dirPath 目录绝对路径
 * @returns {Promise<{ exists: boolean, sizeBytes: number, fileCount: number }>}
 */
async function statDirectory(dirPath) {
  let exists = true
  let sizeBytes = 0
  let fileCount = 0

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
        await visit(entryPath)
        continue
      }
      if (entry.isFile()) {
        try {
          const stat = await fs.stat(entryPath)
          sizeBytes += stat.size
          fileCount += 1
        } catch (error) {
          if (!error || error.code !== 'ENOENT') {
            throw error
          }
        }
      }
    }
  }

  await visit(dirPath)
  return { exists, sizeBytes, fileCount }
}

/**
 * 删除目录（递归）。目录不存在不会报错。
 * @param {string} dirPath 目录绝对路径
 * @returns {Promise<{ existed: boolean, removed: boolean, error: string }>}
 */
async function removeDirectorySafely(dirPath) {
  let existed = false
  try {
    await fs.access(dirPath)
    existed = true
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      existed = false
    }
  }
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
    return { existed, removed: existed, error: '' }
  } catch (error) {
    return {
      existed,
      removed: false,
      error: (error && error.message) || '未知错误'
    }
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 计算孤儿任务：列表只展示顶层任务（standalone / root / 无角色），家族子节点（parent / child）
 * 只能经由存在的 root 顺着 rootId / parentId 向上到达。任何无法到达任何顶层任务的节点都是孤儿。
 * @param {Array<Object>} jobs 全部任务（lean）
 * @returns {Array<Object>} 孤儿任务列表
 */
function findOrphanJobs(jobs) {
  const jobById = new Map()
  jobs.forEach(job => {
    jobById.set(normalizeId(job._id), job)
  })

  function getRole(job) {
    const role = job.taskRelation && job.taskRelation.role
    return role || ''
  }

  function isTopLevel(job) {
    const role = getRole(job)
    if (!role) {
      return true
    }
    return (
      role === TRANSLATION_JOB_TASK_ROLES.STANDALONE ||
      role === TRANSLATION_JOB_TASK_ROLES.ROOT
    )
  }

  const reachable = new Set()
  jobs.forEach(job => {
    if (isTopLevel(job)) {
      reachable.add(normalizeId(job._id))
    }
  })

  // 迭代向下扩散可达性：只要某节点的 rootId 或 parentId 指向一个可达节点，它本身也可达。
  let changed = true
  while (changed) {
    changed = false
    jobs.forEach(job => {
      const id = normalizeId(job._id)
      if (reachable.has(id)) {
        return
      }
      const rootId = normalizeId(job.taskRelation && job.taskRelation.rootId)
      const parentId = normalizeId(
        job.taskRelation && job.taskRelation.parentId
      )
      if (
        (rootId && reachable.has(rootId)) ||
        (parentId && reachable.has(parentId))
      ) {
        reachable.add(id)
        changed = true
      }
    })
  }

  return jobs.filter(job => !reachable.has(normalizeId(job._id)))
}

function describeOrphanJob(job) {
  const id = normalizeId(job._id)
  const role = (job.taskRelation && job.taskRelation.role) || '(无角色)'
  const childKind = (job.taskRelation && job.taskRelation.childKind) || '-'
  const sourceTitle =
    (job.source && job.source.title) ||
    (job.target && job.target.title) ||
    '(无标题)'
  const targetLanguage =
    (job.target && job.target.languageCode) ||
    (job.taskRelation && job.taskRelation.childLanguageCode) ||
    '-'
  const rootId = normalizeId(job.taskRelation && job.taskRelation.rootId) || '-'
  const createdAt = job.createdAt
    ? new Date(job.createdAt).toLocaleString()
    : '-'
  return {
    id,
    jobType: job.jobType || '-',
    role,
    childKind,
    status: job.status || '-',
    sourceTitle,
    targetLanguage,
    rootId,
    createdAt
  }
}

function askConfirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(String(answer || '').trim())
    })
  })
}

async function init() {
  await multilingualConnectionInfo.waitReady()

  const JobModel = models.translationJobs
  if (!JobModel) {
    throw new Error('未找到 translationJobs 模型')
  }

  const jobs = await JobModel.find(
    {},
    {
      jobType: 1,
      status: 1,
      taskRelation: 1,
      'source.title': 1,
      'target.title': 1,
      'target.languageCode': 1,
      createdAt: 1
    }
  ).lean()

  console.log(chalk.cyan(`任务表内文档总数：${jobs.length}`))

  const orphanJobs = findOrphanJobs(jobs)
  if (orphanJobs.length === 0) {
    console.log(chalk.green('未发现孤儿任务数据，无需清理。'))
    return
  }

  console.log(
    chalk.yellow(`发现 ${orphanJobs.length} 条孤儿任务（无法从任务列表到达）：`)
  )
  console.log('')

  let totalLogBytes = 0
  let totalCoverBytes = 0
  const orphanDetails = []
  for (const job of orphanJobs) {
    const detail = describeOrphanJob(job)
    const logStat = await statDirectory(getJobAiLogDir(detail.id))
    const coverStat = await statDirectory(getJobCoverImageTempDir(detail.id))
    totalLogBytes += logStat.sizeBytes
    totalCoverBytes += coverStat.sizeBytes
    orphanDetails.push({ job, detail, logStat, coverStat })

    console.log(
      chalk.white(
        `- [${detail.jobType}] 角色=${detail.role} 子类型=${detail.childKind} 状态=${detail.status}`
      )
    )
    console.log(`  任务ID：${detail.id}`)
    console.log(`  标题：${detail.sourceTitle}`)
    console.log(
      `  目标语言：${detail.targetLanguage}  rootId：${detail.rootId}  创建时间：${detail.createdAt}`
    )
    console.log(
      `  AI日志：${
        logStat.exists
          ? `存在（${formatBytes(logStat.sizeBytes)}，${logStat.fileCount} 个文件）`
          : '不存在'
      }`
    )
    console.log(
      `  缓存图片：${
        coverStat.exists
          ? `存在（${formatBytes(coverStat.sizeBytes)}，${coverStat.fileCount} 个文件）`
          : '不存在'
      }`
    )
    console.log('')
  }

  console.log(
    chalk.cyan(
      `合计：孤儿任务 ${orphanJobs.length} 条，AI日志约 ${formatBytes(
        totalLogBytes
      )}，缓存图片约 ${formatBytes(totalCoverBytes)}。`
    )
  )
  console.log('')

  const answer = await askConfirm(
    chalk.red(
      '确认全部删除以上孤儿任务及其AI日志、缓存图片吗？输入 yes 删除，其它取消：'
    )
  )
  if (answer.toLowerCase() !== 'yes') {
    console.log(chalk.green('已取消，未删除任何数据。'))
    return
  }

  let deletedJobCount = 0
  let logRemovedCount = 0
  let logMissingCount = 0
  let coverRemovedCount = 0
  let coverMissingCount = 0
  const failures = []

  for (const item of orphanDetails) {
    const { job, detail } = item
    try {
      const deleteResult = await JobModel.deleteOne({ _id: job._id })
      if (deleteResult && deleteResult.deletedCount === 1) {
        deletedJobCount += 1
      } else {
        failures.push(`任务 ${detail.id} 删除失败：未匹配到文档`)
        continue
      }
    } catch (error) {
      failures.push(
        `任务 ${detail.id} 删除失败：${(error && error.message) || '未知错误'}`
      )
      continue
    }

    const logResult = await removeDirectorySafely(getJobAiLogDir(detail.id))
    if (logResult.error) {
      failures.push(`任务 ${detail.id} 的AI日志删除失败：${logResult.error}`)
    } else if (logResult.existed) {
      logRemovedCount += 1
    } else {
      logMissingCount += 1
    }

    const coverResult = await removeDirectorySafely(
      getJobCoverImageTempDir(detail.id)
    )
    if (coverResult.error) {
      failures.push(
        `任务 ${detail.id} 的缓存图片删除失败：${coverResult.error}`
      )
    } else if (coverResult.existed) {
      coverRemovedCount += 1
    } else {
      coverMissingCount += 1
    }
  }

  console.log('')
  console.log(chalk.green('========== 清理结算 =========='))
  console.log(chalk.green(`已删除孤儿任务：${deletedJobCount} 条`))
  console.log(
    `AI日志：已删除 ${logRemovedCount} 个目录，${logMissingCount} 个本就不存在（已跳过）`
  )
  console.log(
    `缓存图片：已删除 ${coverRemovedCount} 个目录，${coverMissingCount} 个本就不存在（已跳过）`
  )
  if (failures.length > 0) {
    console.log(chalk.yellow(`存在 ${failures.length} 项失败：`))
    failures.forEach(message => {
      console.log(chalk.yellow(`  - ${message}`))
    })
  } else {
    console.log(chalk.green('全部清理成功，无失败项。'))
  }
}

init()
  .catch(error => {
    console.error(chalk.red('清理孤儿翻译任务失败：'), error)
    process.exitCode = 1
  })
  .finally(async () => {
    await multilingualConnectionInfo.connection.close()
  })
