const mongoose = require('mongoose')

const DEFAULT_PERIOD_DAYS = 30
const MAX_PERIOD_DAYS = 366

function getAiUsageLogModel() {
  const repository = global.$mongodDB.multilingual.repositories.aiUsageLogs
  if (!repository || !repository.model) {
    throw new Error('multilingual aiUsageLogs repository not found')
  }

  return repository.model
}

function cloneSerializableValue(value) {
  if (value === null || typeof value === 'undefined') {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

function getObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null
  }

  return new mongoose.Types.ObjectId(String(value))
}

function flattenNumericUsage(value, prefix = '', result = []) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (prefix) {
      result.push({ name: prefix, value })
    }
    return result
  }

  if (!value || typeof value !== 'object') {
    return result
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index)
      flattenNumericUsage(item, nextPrefix, result)
    })
    return result
  }

  Object.entries(value).forEach(([key, childValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    flattenNumericUsage(childValue, nextPrefix, result)
  })

  return result
}

async function recordAiUsageLog(data = {}) {
  const AiUsageLogModel = getAiUsageLogModel()
  const usage = cloneSerializableValue(data.usage || {}) || {}
  const rawResponse = cloneSerializableValue(data.rawResponse || {}) || {}
  const meta = cloneSerializableValue(data.meta || {}) || {}
  const record = await new AiUsageLogModel({
    provider: data.provider || 'unknown',
    model: data.model || '',
    operation: data.operation || '',
    status: data.status || 'success',
    requestId: data.requestId || '',
    postId: getObjectId(data.postId),
    translationGroupId: getObjectId(data.translationGroupId),
    sourceSnapshotId: getObjectId(data.sourceSnapshotId),
    sourceLanguageCode: data.sourceLanguageCode || '',
    targetLanguageCode: data.targetLanguageCode || '',
    usage,
    tokenUsage: flattenNumericUsage(usage),
    rawResponse,
    meta,
    date: data.date || new Date()
  }).save()

  return record
}

function parseDate(value, endOfDay = false) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999)
    } else {
      date.setHours(0, 0, 0, 0)
    }
  }

  return date
}

function getDefaultStartAt() {
  const startAt = new Date()
  startAt.setDate(startAt.getDate() - DEFAULT_PERIOD_DAYS + 1)
  startAt.setHours(0, 0, 0, 0)
  return startAt
}

function getDefaultEndAt() {
  const endAt = new Date()
  endAt.setHours(23, 59, 59, 999)
  return endAt
}

function normalizeDateRange(query = {}) {
  let startAt = parseDate(query.startAt) || getDefaultStartAt()
  let endAt = parseDate(query.endAt, true) || getDefaultEndAt()
  if (startAt > endAt) {
    const tmp = startAt
    startAt = endAt
    endAt = tmp
  }

  const maxRangeMs = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000
  if (endAt.getTime() - startAt.getTime() > maxRangeMs) {
    startAt = new Date(endAt.getTime() - maxRangeMs)
  }

  return { startAt, endAt }
}

function buildMatchParams(query = {}) {
  const dateRange = normalizeDateRange(query)
  const match = {
    date: {
      $gte: dateRange.startAt,
      $lte: dateRange.endAt
    }
  }

  if (query.provider) {
    match.provider = String(query.provider).trim()
  }
  if (query.model) {
    match.model = String(query.model).trim()
  }
  if (query.operation) {
    match.operation = String(query.operation).trim()
  }

  return {
    match,
    startAt: dateRange.startAt,
    endAt: dateRange.endAt
  }
}

async function getAiUsageSummary(query = {}) {
  const AiUsageLogModel = getAiUsageLogModel()
  const { match, startAt, endAt } = buildMatchParams(query)

  const rawTokenRows = await AiUsageLogModel.aggregate([
    { $match: match },
    { $unwind: '$tokenUsage' },
    {
      $group: {
        _id: {
          provider: '$provider',
          model: '$model',
          tokenType: '$tokenUsage.name'
        },
        total: { $sum: '$tokenUsage.value' },
        requestIds: { $addToSet: '$_id' },
        latestAt: { $max: '$date' }
      }
    },
    {
      $project: {
        _id: 0,
        provider: '$_id.provider',
        model: '$_id.model',
        tokenType: '$_id.tokenType',
        total: 1,
        requestCount: { $size: '$requestIds' },
        latestAt: 1
      }
    },
    { $sort: { provider: 1, model: 1, tokenType: 1 } }
  ])
  const billingTokenRows = buildBillingTokenRows(rawTokenRows)

  const callRows = await AiUsageLogModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          provider: '$provider',
          model: '$model',
          operation: '$operation',
          status: '$status'
        },
        total: { $sum: 1 },
        latestAt: { $max: '$date' }
      }
    },
    {
      $project: {
        _id: 0,
        provider: '$_id.provider',
        model: '$_id.model',
        operation: '$_id.operation',
        status: '$_id.status',
        total: 1,
        latestAt: 1
      }
    },
    { $sort: { provider: 1, model: 1, operation: 1, status: 1 } }
  ])

  return {
    startAt,
    endAt,
    tokenRows: billingTokenRows,
    billingTokenRows,
    rawTokenRows,
    callRows
  }
}

function getBillingTokenType(tokenType, groupHasCacheInputTokens) {
  if (tokenType === 'completion_tokens') {
    return 'output_tokens'
  }
  if (tokenType === 'prompt_cache_hit_tokens') {
    return 'input_cache_hit_tokens'
  }
  if (tokenType === 'prompt_cache_miss_tokens') {
    return 'input_cache_miss_tokens'
  }
  if (tokenType === 'prompt_tokens' && !groupHasCacheInputTokens) {
    return 'input_tokens'
  }
  return ''
}

function buildBillingTokenRows(rawTokenRows) {
  const cacheGroupSet = new Set()
  rawTokenRows.forEach(row => {
    if (
      row.tokenType === 'prompt_cache_hit_tokens' ||
      row.tokenType === 'prompt_cache_miss_tokens'
    ) {
      cacheGroupSet.add(`${row.provider}:${row.model}`)
    }
  })

  const billingMap = new Map()
  rawTokenRows.forEach(row => {
    const groupKey = `${row.provider}:${row.model}`
    const tokenType = getBillingTokenType(
      row.tokenType,
      cacheGroupSet.has(groupKey)
    )
    if (!tokenType) {
      return
    }

    const key = `${groupKey}:${tokenType}`
    if (!billingMap.has(key)) {
      billingMap.set(key, {
        provider: row.provider,
        model: row.model,
        tokenType,
        total: 0,
        requestCount: 0,
        latestAt: row.latestAt
      })
    }

    const item = billingMap.get(key)
    item.total += row.total || 0
    item.requestCount = Math.max(item.requestCount, row.requestCount || 0)
    if (!item.latestAt || row.latestAt > item.latestAt) {
      item.latestAt = row.latestAt
    }
  })

  return Array.from(billingMap.values()).sort((a, b) => {
    const left = `${a.provider}:${a.model}:${a.tokenType}`
    const right = `${b.provider}:${b.model}:${b.tokenType}`
    return left.localeCompare(right)
  })
}

module.exports = {
  flattenNumericUsage,
  getAiUsageSummary,
  recordAiUsageLog
}
