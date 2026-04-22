const mongoose = require('mongoose')

const createLocalizedBaseFields = require('./localizedBaseFields')

function createSharedEntityModel(modelName, fields, options) {
  const finalOptions = options || {}
  const schema = new mongoose.Schema(
    {
      ...createLocalizedBaseFields(mongoose.Schema, finalOptions.baseOptions),
      ...fields
    },
    { timestamps: true }
  )

  schema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

  if (Array.isArray(finalOptions.extraIndexes)) {
    for (const indexDefinition of finalOptions.extraIndexes) {
      schema.index(indexDefinition.fields, indexDefinition.options)
    }
  }

  return mongoose.model(modelName, schema)
}

module.exports = createSharedEntityModel
