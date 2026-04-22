const http = require('http')

const { loadBootstrapEnv } = require('./config/bootstrapEnv')
const { runBootstrap } = require('./init/bootstrap')
const { connectMongo } = require('./mongodb')
const { ensureAdminJwtSecret } = require('./security/adminJwtSecret')

function resolvePort() {
  return 3000
}

async function startServer() {
  const bootstrapEnv = loadBootstrapEnv()
  const adminJwtSecret = ensureAdminJwtSecret()
  await connectMongo()
  await runBootstrap()
  const createApp = require('./app')
  const app = createApp({ bootstrapEnv: bootstrapEnv.values })
  const port = resolvePort()

  app.locals.bootstrapEnv = bootstrapEnv.values
  app.locals.adminJwtSecretLoaded = Boolean(adminJwtSecret)

  const server = http.createServer(app)
  await new Promise(function (resolve, reject) {
    server.once('error', reject)
    server.listen(port, function () {
      console.info(`Multilingual server listening on port ${port}`)
      resolve()
    })
  })

  return server
}

if (require.main === module) {
  startServer().catch(function (error) {
    console.error(error && error.stack ? error.stack : error)
    process.exit(1)
  })
}

module.exports = {
  startServer
}
