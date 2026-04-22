const adminUsersModel = require('../models/adminUsers')
const createCrudUtils = require('./createCrudUtils')

const crudUtils = createCrudUtils(adminUsersModel)

async function findByUsername(username, projection, options) {
  return adminUsersModel.findOne(
    { username: String(username).trim().toLowerCase() },
    projection,
    options
  )
}

module.exports = {
  ...crudUtils,
  findByUsername
}
