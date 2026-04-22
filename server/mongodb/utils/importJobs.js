const model = require('../models/importJobs')
const createCrudUtils = require('./createCrudUtils')

module.exports = {
  ...createCrudUtils(model)
}
