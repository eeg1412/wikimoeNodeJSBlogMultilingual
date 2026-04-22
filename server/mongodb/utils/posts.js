const model = require('../models/posts')
const createCrudUtils = require('./createCrudUtils')

async function findBySourceIdAndLanguage(
  sourceId,
  languageCode,
  projection,
  options
) {
  return model.findOne({ sourceId, languageCode }, projection, options)
}

async function findStubBySourceIdAndLanguage(sourceId, languageCode) {
  return model.findOne({
    sourceId,
    languageCode,
    translationStatus: 'stub'
  })
}

module.exports = {
  ...createCrudUtils(model),
  findBySourceIdAndLanguage,
  findStubBySourceIdAndLanguage
}
