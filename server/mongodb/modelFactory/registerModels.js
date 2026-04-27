const fs = require('fs')
const path = require('path')

const modelsDir = path.resolve(__dirname, '..', 'models')

function getModelFiles() {
  return fs
    .readdirSync(modelsDir)
    .filter(fileName => fileName.endsWith('.js'))
    .sort()
}

function registerModel(connection, model) {
  const modelName = model.modelName
  const schema = model.schema
  const collectionName = model.collection && model.collection.name

  if (!modelName || !schema) {
    throw new Error(
      '模型文件必须导出包含 modelName 和 schema 的 Mongoose Model'
    )
  }

  if (connection.models[modelName]) {
    return connection.models[modelName]
  }

  return connection.model(modelName, schema, collectionName)
}

module.exports = function registerModels(connection) {
  if (!connection || typeof connection.model !== 'function') {
    throw new Error('registerModels 需要传入 Mongoose connection')
  }

  const models = {}
  const modelFiles = getModelFiles()
  for (const fileName of modelFiles) {
    const model = require(path.join(modelsDir, fileName))
    const registeredModel = registerModel(connection, model)
    models[registeredModel.modelName] = registeredModel
  }

  return models
}
