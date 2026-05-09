const crypto = require('crypto')
const os = require('os')
const translationJobService = require('./translationJobService')
const translationExecutionService = require('./translationExecutionService')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const DEFAULT_CONCURRENCY = 1
const DEFAULT_POLL_INTERVAL_MS = 5000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15000
const DEFAULT_LEASE_MS = 60000
const DEFAULT_RECOVER_INTERVAL_MS = 45000
const DEFAULT_MAX_ATTEMPTS = 3

let workerState = null

function toPositiveInteger(value, defaultValue) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return defaultValue
  }

  return numberValue
}

function createWorkerId() {
  return [
    os.hostname(),
    process.pid,
    Date.now(),
    crypto.randomBytes(4).toString('hex')
  ].join(':')
}

function getWorkerConfig(options = {}) {
  return {
    concurrency: toPositiveInteger(
      options.concurrency || process.env.TRANSLATION_JOB_WORKER_CONCURRENCY,
      DEFAULT_CONCURRENCY
    ),
    pollIntervalMs: toPositiveInteger(
      options.pollIntervalMs || process.env.TRANSLATION_JOB_WORKER_POLL_MS,
      DEFAULT_POLL_INTERVAL_MS
    ),
    heartbeatIntervalMs: toPositiveInteger(
      options.heartbeatIntervalMs ||
        process.env.TRANSLATION_JOB_WORKER_HEARTBEAT_MS,
      DEFAULT_HEARTBEAT_INTERVAL_MS
    ),
    leaseMs: toPositiveInteger(
      options.leaseMs || process.env.TRANSLATION_JOB_WORKER_LEASE_MS,
      DEFAULT_LEASE_MS
    ),
    recoverIntervalMs: toPositiveInteger(
      options.recoverIntervalMs ||
        process.env.TRANSLATION_JOB_WORKER_RECOVER_MS,
      DEFAULT_RECOVER_INTERVAL_MS
    ),
    maxAttempts: toPositiveInteger(
      options.maxAttempts || process.env.TRANSLATION_JOB_WORKER_MAX_ATTEMPTS,
      DEFAULT_MAX_ATTEMPTS
    )
  }
}

function createCancellationContext() {
  let cancelled = false
  let reason = ''
  let retryable = true
  const listeners = new Set()

  return {
    get isCancelled() {
      return cancelled
    },
    get reason() {
      return reason
    },
    get retryable() {
      return retryable
    },
    cancel(nextReason, options = {}) {
      if (cancelled) {
        return
      }
      cancelled = true
      reason = String(nextReason || '').trim() || '后台任务已停止'
      if (typeof options.retryable === 'boolean') {
        retryable = options.retryable
      }
      listeners.forEach(listener => listener(reason))
      listeners.clear()
    },
    onCancel(listener) {
      if (typeof listener !== 'function') {
        return () => {}
      }
      if (cancelled) {
        listener(reason)
        return () => {}
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

function getAttemptNo(job) {
  if (!job || !job.runtime) {
    return 0
  }

  return Number(job.runtime.attempts || 0)
}

async function renewLease(job, state, cancellation) {
  const renewed = await translationJobService.renewTranslationJobLease({
    id: job._id,
    workerId: state.workerId,
    attemptNo: getAttemptNo(job),
    leaseMs: state.config.leaseMs
  })

  if (!renewed) {
    cancellation.cancel('任务租约续期失败，worker 停止当前执行')
  }
}

function startHeartbeat(job, state, cancellation) {
  return setInterval(() => {
    renewLease(job, state, cancellation).catch(error => {
      const message = error && error.message ? error.message : String(error)
      cancellation.cancel(`任务租约续期异常：${message}`)
    })
  }, state.config.heartbeatIntervalMs)
}

function createCancelledError(cancellation) {
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    cancellation.reason,
    'translationJob',
    499,
    { retryable: cancellation.retryable !== false }
  )
}

function getActiveJobCancellation(jobId) {
  if (!workerState || !workerState.activeJobs) {
    return null
  }
  return workerState.activeJobs.get(String(jobId)) || null
}

function hasActiveTranslationJob(jobId) {
  return Boolean(getActiveJobCancellation(jobId))
}

function cancelRunningTranslationJob(jobId, reason) {
  const cancellation = getActiveJobCancellation(jobId)
  if (!cancellation) {
    return false
  }
  cancellation.cancel(reason || '用户停止了 AI 翻译任务', {
    retryable: false
  })
  return true
}

function createExecutionContext(job, state, cancellation) {
  const attemptNo = getAttemptNo(job)
  return {
    workerId: state.workerId,
    attemptNo,
    cancellation,
    async updateProgress(progress) {
      if (cancellation.isCancelled) {
        throw createCancelledError(cancellation)
      }
      await translationJobService.updateRunningTranslationJobProgress({
        id: job._id,
        workerId: state.workerId,
        attemptNo,
        progress
      })
    },
    async saveCheckpoint(checkpoint) {
      if (cancellation.isCancelled) {
        throw createCancelledError(cancellation)
      }
      await translationJobService.saveRunningTranslationJobCheckpoint({
        id: job._id,
        workerId: state.workerId,
        attemptNo,
        checkpoint
      })
    }
  }
}

async function executeClaimedJob(job, state) {
  const jobId = String(job._id)
  const cancellation = createCancellationContext()
  state.activeJobs.set(jobId, cancellation)
  const heartbeatTimer = startHeartbeat(job, state, cancellation)

  try {
    await renewLease(job, state, cancellation)
    const context = createExecutionContext(job, state, cancellation)
    const result = await translationExecutionService.executeTranslationJob(
      job,
      context
    )
    if (cancellation.isCancelled) {
      throw createCancelledError(cancellation)
    }
    await translationJobService.completeRunningTranslationJobForReview({
      id: job._id,
      workerId: state.workerId,
      attemptNo: getAttemptNo(job),
      result
    })
  } catch (error) {
    await translationJobService.failRunningTranslationJob({
      id: job._id,
      workerId: state.workerId,
      attemptNo: getAttemptNo(job),
      error,
      maxAttempts: state.config.maxAttempts
    })
  } finally {
    clearInterval(heartbeatTimer)
    state.activeJobs.delete(jobId)
  }
}

async function recoverExpiredJobsIfNeeded(state) {
  const now = Date.now()
  if (now - state.lastRecoverAt < state.config.recoverIntervalMs) {
    return
  }

  state.lastRecoverAt = now
  await translationJobService.markExpiredRunningTranslationJobsRecovering({
    maxAttempts: state.config.maxAttempts
  })
}

async function runWorkerTick(state) {
  if (state.ticking || !global.$isReady) {
    return
  }

  state.ticking = true
  try {
    await recoverExpiredJobsIfNeeded(state)
    while (state.activeJobs.size < state.config.concurrency) {
      const job = await translationJobService.claimNextRunnableTranslationJob({
        workerId: state.workerId,
        leaseMs: state.config.leaseMs,
        maxAttempts: state.config.maxAttempts
      })

      if (!job) {
        break
      }

      executeClaimedJob(job, state).catch(error => {
        console.error(
          '后台翻译任务执行异常：',
          error && error.stack ? error.stack : error
        )
      })
    }
  } catch (error) {
    console.error(
      '后台翻译 worker 调度异常：',
      error && error.stack ? error.stack : error
    )
  } finally {
    state.ticking = false
  }
}

function startTranslationJobWorker(options = {}) {
  if (workerState && workerState.started) {
    return workerState
  }

  const config = getWorkerConfig(options)
  workerState = {
    started: true,
    workerId: createWorkerId(),
    config,
    activeJobs: new Map(),
    ticking: false,
    lastRecoverAt: 0,
    timer: null
  }

  workerState.timer = setInterval(() => {
    runWorkerTick(workerState)
  }, config.pollIntervalMs)
  runWorkerTick(workerState)
  console.info(`后台翻译 worker 已启动：${workerState.workerId}`)
  return workerState
}

function stopTranslationJobWorker(reason = 'worker stopped') {
  if (!workerState) {
    return
  }

  if (workerState.timer) {
    clearInterval(workerState.timer)
  }
  workerState.activeJobs.forEach(cancellation => {
    cancellation.cancel(reason)
  })
  workerState.started = false
  workerState = null
}

module.exports = {
  startTranslationJobWorker,
  stopTranslationJobWorker,
  hasActiveTranslationJob,
  cancelRunningTranslationJob
}
