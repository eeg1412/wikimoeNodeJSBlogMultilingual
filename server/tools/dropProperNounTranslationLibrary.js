require('dotenv').config()

const multilingualConnectionInfo = require('../mongodb/multilingualConnection')
const registerModels = require('../mongodb/modelFactory/registerModels')

const models = registerModels(multilingualConnectionInfo.connection)
const EXPECTED_COLLECTION_NAMES = {
  properNounTerms: 'propernounterms',
  properNounTranslations: 'propernountranslations'
}

function getExpectedCollectionName(modelName, label) {
  const collectionName = models[modelName].collection.name
  const expectedCollectionName = EXPECTED_COLLECTION_NAMES[modelName]
  if (collectionName !== expectedCollectionName) {
    throw new Error(
      `${label}集合名异常：${collectionName}，预期：${expectedCollectionName}`
    )
  }
  return collectionName
}

async function collectionExists(collectionName) {
  const collectionList = await multilingualConnectionInfo.connection.db
    .listCollections({ name: collectionName }, { nameOnly: true })
    .toArray()
  return collectionList.length > 0
}

async function dropCollection(collectionName, label) {
  const exists = await collectionExists(collectionName)
  if (!exists) {
    console.log(`${label}集合不存在，已跳过：${collectionName}`)
    return
  }

  await multilingualConnectionInfo.connection.db.dropCollection(collectionName)
  console.log(`${label}集合已删除：${collectionName}`)
}

async function init() {
  await multilingualConnectionInfo.waitReady()

  const translationCollectionName = getExpectedCollectionName(
    'properNounTranslations',
    '专有名词译名'
  )
  const termCollectionName = getExpectedCollectionName(
    'properNounTerms',
    '专有名词'
  )

  await dropCollection(translationCollectionName, '专有名词译名')
  await dropCollection(termCollectionName, '专有名词')

  console.log('专有名词翻译库已从头清空')
}

init()
  .catch(error => {
    console.error('删除专有名词翻译库失败：', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await multilingualConnectionInfo.connection.close()
  })
