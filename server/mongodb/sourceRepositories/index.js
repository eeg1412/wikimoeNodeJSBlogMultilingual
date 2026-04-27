function applyQueryOptions(query, options = {}) {
  if (options.sort) {
    query.sort(options.sort)
  }

  if (options.populate) {
    query.populate(options.populate)
  }

  if (options.lean) {
    query.lean()
  }

  return query
}

function makeRepository(model) {
  return {
    find(params, projection, options = {}) {
      const query = model.find(params, projection)
      return applyQueryOptions(query, options)
    },
    findOne(params, projection, options = {}) {
      const query = model.findOne(params, projection)
      return applyQueryOptions(query, options)
    },
    countDocuments(params) {
      return model.countDocuments(params)
    },
    aggregate(pipeline) {
      return model.aggregate(pipeline)
    },
    findCursor(params, projection, options = {}) {
      const query = model.find(params, projection)
      return applyQueryOptions(query, options).cursor()
    }
  }
}

module.exports = function buildSourceRepositories(models) {
  const repositories = {}
  for (const modelName of Object.keys(models)) {
    repositories[modelName] = makeRepository(models[modelName])
  }

  return repositories
}
