const model = require('../models/bangumis')
const createCrudUtils = require('./createCrudUtils')

module.exports = {
  ...createCrudUtils(model)
}
