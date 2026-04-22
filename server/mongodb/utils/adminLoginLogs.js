const adminLoginLogsModel = require('../models/adminLoginLogs')
const createCrudUtils = require('./createCrudUtils')

const crudUtils = createCrudUtils(adminLoginLogsModel)

module.exports = {
  ...crudUtils
}
