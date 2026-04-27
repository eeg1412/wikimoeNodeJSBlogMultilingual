const { connection } = require('../multilingualConnection')

module.exports = function getDefaultModel(modelName, schema, collectionName) {
  if (connection.models[modelName]) {
    return connection.models[modelName]
  }

  return connection.model(modelName, schema, collectionName)
}
