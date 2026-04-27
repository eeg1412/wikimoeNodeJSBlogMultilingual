const fs = require('fs')
const path = require('path')

const utilsDir = path.resolve(__dirname, '..', 'utils')

function getUtilsMap() {
  const utilsMap = {}
  const files = fs
    .readdirSync(utilsDir)
    .filter(fileName => fileName.endsWith('.js'))
    .sort()

  for (const fileName of files) {
    const modelName = path.basename(fileName, '.js')
    utilsMap[modelName] = require(path.join(utilsDir, fileName))
  }

  return utilsMap
}

module.exports = function buildMultilingualRepositories(models) {
  const repositories = {}
  const utilsMap = getUtilsMap()

  for (const modelName of Object.keys(models)) {
    repositories[modelName] = {
      model: models[modelName],
      utils: utilsMap[modelName]
    }
  }

  return repositories
}
