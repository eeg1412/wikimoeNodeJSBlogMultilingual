const model = require('../models/games')
const createCrudUtils = require('./createCrudUtils')

module.exports = {
  ...createCrudUtils(model)
}
