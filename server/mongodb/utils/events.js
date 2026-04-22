const model = require('../models/events')
const createCrudUtils = require('./createCrudUtils')

module.exports = {
  ...createCrudUtils(model)
}
