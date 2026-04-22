function applyQueryOptions(query, options) {
  const finalOptions = options || {}

  if (finalOptions.sort) {
    query.sort(finalOptions.sort)
  }

  if (finalOptions.populate) {
    if (Array.isArray(finalOptions.populate)) {
      for (const populateEntry of finalOptions.populate) {
        query.populate(populateEntry)
      }
    } else {
      query.populate(finalOptions.populate)
    }
  }

  if (finalOptions.lean) {
    query.lean()
  }

  return query
}

function normalizePage(page) {
  let safePage = Number(page)

  if (!Number.isInteger(safePage) || safePage < 1) {
    safePage = 1
  }

  return safePage
}

function normalizeLimit(limit) {
  let safeLimit = Number(limit)

  if (!Number.isInteger(safeLimit) || safeLimit < 1) {
    safeLimit = 20
  }

  return safeLimit
}

function createCrudUtils(model) {
  return {
    save: async function (params) {
      const document = new model(params)
      return document.save()
    },
    findOne: async function (filters, projection, options) {
      const query = model.findOne(filters, projection)
      return applyQueryOptions(query, options)
    },
    find: async function (filters, projection, options) {
      const query = model.find(filters, projection)
      return applyQueryOptions(query, options)
    },
    findPage: async function (filters, projection, page, limit, options) {
      const safePage = normalizePage(page)
      const safeLimit = normalizeLimit(limit)
      const query = model
        .find(filters, projection)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)

      applyQueryOptions(query, options)

      const list = await query
      const total = await model.countDocuments(filters)

      return {
        list,
        total,
        page: safePage,
        limit: safeLimit
      }
    },
    updateOne: async function (filters, params, options) {
      return model.updateOne(filters, params, options)
    },
    findOneAndUpdate: async function (filters, params, options) {
      return model.findOneAndUpdate(filters, params, options)
    },
    deleteOne: async function (filters) {
      return model.deleteOne(filters)
    },
    deleteMany: async function (filters) {
      return model.deleteMany(filters)
    },
    countDocuments: async function (filters) {
      return model.countDocuments(filters)
    }
  }
}

module.exports = createCrudUtils
