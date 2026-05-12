const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const DEFAULT_AI_STEP_MAX_ATTEMPTS = 3
const DEFAULT_AI_STEP_RETRY_DELAY_MS = 800

function normalizePositiveInteger(value, defaultValue) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return defaultValue
  }
  return numberValue
}

function normalizeText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function getStepLabel(options = {}) {
  const label = normalizeText(options.stepLabel)
  if (label) {
    return label
  }
  return 'AI 步骤'
}

function getStepKey(options = {}) {
  const key = normalizeText(options.stepKey)
  if (key) {
    return key
  }
  return getStepLabel(options)
}

function getErrorMessage(error) {
  if (error && error.message) {
    return error.message
  }
  return String(error)
}

function createCancelledError(cancellation) {
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    normalizeText(cancellation?.reason) || 'AI 翻译已停止',
    'translation',
    499,
    { retryable: cancellation?.retryable !== false }
  )
}

function throwIfCancellationRequested(cancellation) {
  if (!cancellation || cancellation.isCancelled !== true) {
    return
  }
  throw createCancelledError(cancellation)
}

function isRetryableAiStepError(error) {
  if (error && error.code === ERROR_CODES.AI_TRANSLATION_CANCELLED) {
    return false
  }
  if (error && error.code === ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED) {
    return false
  }
  if (error && error.extra && error.extra.retryable === false) {
    return false
  }
  if (error && error.retryable === false) {
    return false
  }
  if (error && error.name === 'ApiError') {
    return error.code === ERROR_CODES.AI_TRANSLATION_FAILED
  }
  return false
}

function getErrorStatus(error) {
  const status = Number(error?.status)
  if (Number.isInteger(status) && status >= 400) {
    return status
  }
  return 502
}

function buildRetryExhaustedError(error, options, attempts, maxAttempts) {
  const stepLabel = getStepLabel(options)
  const extra = {}
  if (error && error.extra && typeof error.extra === 'object') {
    Object.assign(extra, error.extra)
  }
  extra.retryable = true
  extra.manualRetryRequired = true
  extra.aiStepRetryExhausted = true
  extra.aiStepKey = getStepKey(options)
  extra.aiStepLabel = stepLabel
  extra.aiStepAttempts = attempts
  extra.aiStepMaxAttempts = maxAttempts
  if (error && error.code) {
    extra.originalErrorCode = error.code
  }

  const code = error?.code || ERROR_CODES.AI_TRANSLATION_FAILED
  const field = error?.field || options.field || 'aiStep'
  return new ApiError(
    code,
    `${stepLabel}连续 ${maxAttempts} 次执行失败：${getErrorMessage(error)}`,
    field,
    getErrorStatus(error),
    extra
  )
}

function buildWorkflowStatus(options, payload = {}) {
  return {
    stepKey: normalizeText(payload.stepKey) || getStepKey(options),
    stepLabel: normalizeText(payload.stepLabel) || getStepLabel(options),
    status: normalizeText(payload.status),
    attemptNo: payload.attemptNo || null,
    nextAttemptNo: payload.nextAttemptNo || null,
    maxAttempts: payload.maxAttempts || null,
    errorCode: normalizeText(payload.errorCode),
    errorMessage: normalizeText(payload.errorMessage)
  }
}

function notifyStatus(options, message, payload = {}) {
  if (!options || typeof options.onStatus !== 'function') {
    return
  }
  options.onStatus({
    message,
    retry: payload,
    workflow: buildWorkflowStatus(options, payload)
  })
}

function getRetryDelayMs(attemptNo, options = {}) {
  const baseDelayMs = normalizePositiveInteger(
    options.retryDelayMs,
    DEFAULT_AI_STEP_RETRY_DELAY_MS
  )
  return baseDelayMs * attemptNo
}

function waitForRetryDelay(delayMs, cancellation) {
  if (!delayMs) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    let unbindCancellation = () => {}
    const timer = setTimeout(() => {
      unbindCancellation()
      resolve()
    }, delayMs)
    if (cancellation && typeof cancellation.onCancel === 'function') {
      unbindCancellation = cancellation.onCancel(() => {
        clearTimeout(timer)
        reject(createCancelledError(cancellation))
      })
    }
  })
}

async function runAiStepWithRetry(operation, options = {}) {
  if (typeof operation !== 'function') {
    throw new Error('AI step operation must be a function')
  }

  const maxAttempts = normalizePositiveInteger(
    options.maxAttempts,
    DEFAULT_AI_STEP_MAX_ATTEMPTS
  )
  const stepLabel = getStepLabel(options)
  let attemptNo = 1

  while (attemptNo <= maxAttempts) {
    throwIfCancellationRequested(options.cancellation)
    notifyStatus(
      options,
      `正在执行${stepLabel}（${attemptNo}/${maxAttempts}）`,
      {
        stepKey: getStepKey(options),
        stepLabel,
        status: 'running',
        attemptNo,
        maxAttempts
      }
    )
    if (attemptNo > 1) {
      notifyStatus(
        options,
        `正在重试${stepLabel}（${attemptNo}/${maxAttempts}）`,
        {
          stepKey: getStepKey(options),
          stepLabel,
          status: 'retrying',
          attemptNo,
          maxAttempts
        }
      )
    }

    try {
      const result = await operation({ attemptNo, maxAttempts })
      notifyStatus(options, `${stepLabel}已完成`, {
        stepKey: getStepKey(options),
        stepLabel,
        status: 'completed',
        attemptNo,
        maxAttempts
      })
      return result
    } catch (error) {
      if (!isRetryableAiStepError(error)) {
        notifyStatus(
          options,
          `${stepLabel}执行失败：${getErrorMessage(error)}`,
          {
            stepKey: getStepKey(options),
            stepLabel,
            status: 'failed',
            attemptNo,
            maxAttempts,
            errorCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
            errorMessage: getErrorMessage(error)
          }
        )
        throw error
      }
      if (attemptNo >= maxAttempts) {
        notifyStatus(
          options,
          `${stepLabel}连续 ${maxAttempts} 次执行失败：${getErrorMessage(error)}`,
          {
            stepKey: getStepKey(options),
            stepLabel,
            status: 'failed',
            attemptNo,
            maxAttempts,
            errorCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
            errorMessage: getErrorMessage(error)
          }
        )
        throw buildRetryExhaustedError(error, options, attemptNo, maxAttempts)
      }

      notifyStatus(
        options,
        `${stepLabel}执行失败，准备重试（${attemptNo + 1}/${maxAttempts}）：${getErrorMessage(error)}`,
        {
          stepKey: getStepKey(options),
          stepLabel,
          status: 'retrying',
          attemptNo,
          nextAttemptNo: attemptNo + 1,
          maxAttempts,
          errorCode: error?.code || ERROR_CODES.AI_TRANSLATION_FAILED,
          errorMessage: getErrorMessage(error)
        }
      )
      await waitForRetryDelay(
        getRetryDelayMs(attemptNo, options),
        options.cancellation
      )
      attemptNo += 1
    }
  }
}

module.exports = {
  isRetryableAiStepError,
  runAiStepWithRetry
}
