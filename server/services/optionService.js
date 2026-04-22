const {
  optionListSchema,
  optionUpdateSchema
} = require('../../common/validation/option')
const settingsUtils = require('../mongodb/utils/settings')

const SECRET_MASK = '********'

function maskSecretValue(record) {
  if (!record.isSecret) {
    return record.value
  }

  if (
    record.value === null ||
    typeof record.value === 'undefined' ||
    record.value === ''
  ) {
    return null
  }

  return SECRET_MASK
}

function toAdminOptionRecord(record) {
  return {
    _id: record._id,
    namespace: record.namespace,
    key: record.key,
    fullKey: record.fullKey,
    value: maskSecretValue(record),
    valueType: record.valueType,
    isSecret: record.isSecret,
    isPublic: record.isPublic,
    description: record.description,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt
  }
}

async function listOptions(query) {
  const validatedQuery = await optionListSchema.validateAsync(query || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  const filters = {}

  if (validatedQuery.namespace) {
    filters.namespace = validatedQuery.namespace
  }

  if (validatedQuery.keyword) {
    filters.$or = [
      {
        fullKey: new RegExp(validatedQuery.keyword, 'i')
      },
      {
        description: new RegExp(validatedQuery.keyword, 'i')
      }
    ]
  }

  const records = await settingsUtils.find(filters, null, {
    sort: {
      namespace: 1,
      fullKey: 1
    },
    lean: true
  })

  return records.map(toAdminOptionRecord)
}

async function updateOptions(payload) {
  const validatedPayload = await optionUpdateSchema.validateAsync(payload, {
    abortEarly: false,
    stripUnknown: true
  })
  const updatedRecords = []

  for (const item of validatedPayload.items) {
    const existingRecord = await settingsUtils.findByFullKey(item.fullKey)

    if (!existingRecord) {
      throw new Error(`配置不存在：${item.fullKey}`)
    }

    let nextValue = item.value

    if (existingRecord.isSecret && nextValue === SECRET_MASK) {
      nextValue = existingRecord.value
    }

    const updatedRecord = await settingsUtils.findOneAndUpdate(
      {
        fullKey: item.fullKey
      },
      {
        $set: {
          value: nextValue
        }
      },
      {
        new: true
      }
    )

    updatedRecords.push(toAdminOptionRecord(updatedRecord.toObject()))
  }

  return updatedRecords
}

module.exports = {
  SECRET_MASK,
  listOptions,
  updateOptions
}
