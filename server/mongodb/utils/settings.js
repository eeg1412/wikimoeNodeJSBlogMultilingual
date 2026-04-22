const settingsModel = require('../models/settings')
const createCrudUtils = require('./createCrudUtils')

const crudUtils = createCrudUtils(settingsModel)

async function findByFullKey(fullKey, projection, options) {
  return settingsModel.findOne({ fullKey }, projection, options)
}

module.exports = {
  ...crudUtils,
  findByFullKey
}
