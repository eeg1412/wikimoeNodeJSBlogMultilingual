const model = require('../models/mappoints')
const createCrudUtils = require('./createCrudUtils')

module.exports = {
  ...createCrudUtils(model)
}
