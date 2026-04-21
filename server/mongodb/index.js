const mongoose = require('mongoose')
const env = require('../config/env')
const models = require('./models')
const utils = require('./utils')

let connectPromise = null

async function connect() {
  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(env.DB_HOST)
  }

  await connectPromise
  return mongoose
}

module.exports = {
  connect,
  models,
  mongoose,
  utils
}