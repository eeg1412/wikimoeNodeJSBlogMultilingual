const {
  adminLoginLogListSchema
} = require('../../common/validation/adminLoginLog')
const adminLoginLogsUtils = require('../mongodb/utils/adminLoginLogs')

function buildFilters(query) {
  const filters = {}

  if (query.username) {
    filters.username = new RegExp(
      query.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    )
  }

  if (typeof query.success === 'boolean') {
    filters.success = query.success
  }

  return filters
}

function mapLoginLogItem(item) {
  return {
    _id: String(item._id),
    username: item.username,
    adminId: item.adminId ? String(item.adminId) : null,
    IP: item.IP,
    ipInfo: item.ipInfo || null,
    deviceInfo: item.deviceInfo || null,
    success: item.success === true,
    reason: item.reason || '',
    createdAt: item.createdAt
  }
}

async function listAdminLoginLogs(query) {
  const validatedQuery = await adminLoginLogListSchema.validateAsync(
    query || {},
    {
      abortEarly: false,
      stripUnknown: true
    }
  )
  const result = await adminLoginLogsUtils.findPage(
    buildFilters(validatedQuery),
    null,
    validatedQuery.page,
    validatedQuery.size,
    {
      sort: {
        createdAt: -1,
        _id: -1
      },
      lean: true
    }
  )

  return {
    list: result.list.map(mapLoginLogItem),
    total: result.total,
    page: result.page,
    size: result.limit
  }
}

module.exports = {
  listAdminLoginLogs
}
