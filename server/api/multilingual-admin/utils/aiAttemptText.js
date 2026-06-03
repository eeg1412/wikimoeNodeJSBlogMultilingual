function normalizeAttemptNumber(value) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return null
  }
  return numberValue
}

function formatAiAttemptText(attemptNo, maxAttempts) {
  const normalizedAttemptNo = normalizeAttemptNumber(attemptNo)
  const normalizedMaxAttempts = normalizeAttemptNumber(maxAttempts)

  if (normalizedAttemptNo && normalizedMaxAttempts) {
    return `第 ${normalizedAttemptNo} 次尝试，最多尝试 ${normalizedMaxAttempts} 次`
  }

  if (normalizedAttemptNo) {
    return `第 ${normalizedAttemptNo} 次尝试`
  }

  if (normalizedMaxAttempts) {
    return `最多尝试 ${normalizedMaxAttempts} 次`
  }

  return ''
}

function formatAiAttemptNoValue(attemptNo) {
  const normalizedAttemptNo = normalizeAttemptNumber(attemptNo)
  if (!normalizedAttemptNo) {
    return ''
  }
  return `第 ${normalizedAttemptNo} 次`
}

function formatAiMaxAttemptsValue(maxAttempts) {
  const normalizedMaxAttempts = normalizeAttemptNumber(maxAttempts)
  if (!normalizedMaxAttempts) {
    return ''
  }
  return `最多 ${normalizedMaxAttempts} 次`
}

module.exports = {
  formatAiAttemptNoValue,
  formatAiAttemptText,
  formatAiMaxAttemptsValue
}
