const mongoose = require('mongoose')
const bson = mongoose.mongo.BSON
const archiver = require('archiver')
const fs = require('fs')
const fsEX = require('fs-extra')
const path = require('path')
const { once } = require('events')
const { promisify } = require('util')
const pipeline = promisify(require('stream').pipeline)
const yauzl = require('yauzl')
const multilingualConnectionInfo = require('../mongodb/multilingualConnection')

const MULTILINGUAL_BACKUP_SCOPE = 'wikimoeNodeJSBlogMultilingual'
const BACKUP_INFO_FILE = 'backupInfo.bson'
const MONGODB_ARCHIVE_DIR = 'mongodb'
const BSON_BATCH_SIZE = 100

const noDropCollections = ['backups']
const excludedCollections = ['readerlogs']
const ignoredCollections = new Set([
  ...noDropCollections,
  ...excludedCollections
])

const RESOURCE_DIRECTORIES = [
  {
    name: 'serverPublic',
    sourcePath: './public',
    targetPath: './public',
    archivePath: 'public'
  },
  {
    name: 'blogPublic',
    sourcePath: '../blog/public',
    targetPath: '../blog/public',
    archivePath: 'blog-public'
  },
  {
    name: 'blogPublicRoot',
    sourcePath: '../blog/public-root',
    targetPath: '../blog/public-root',
    archivePath: 'blog-public-root'
  }
]

function normalizeMongoUri(uri) {
  if (!uri) {
    return ''
  }

  return uri.trim().replace(/\/$/, '')
}

function getMongoDatabaseName(uri) {
  if (!uri) {
    return ''
  }

  try {
    const parsedUrl = new URL(uri)
    const pathname = parsedUrl.pathname.replace(/^\//, '')
    if (!pathname) {
      return ''
    }

    return decodeURIComponent(pathname.split('/')[0])
  } catch (error) {
    return ''
  }
}

function assertMultilingualDbConnection() {
  const multilingualUri = normalizeMongoUri(process.env.DB_HOST_MULTILINGUAL)
  if (!multilingualUri) {
    throw new Error('缺少多语言数据库地址 DB_HOST_MULTILINGUAL')
  }

  const sourceUri = normalizeMongoUri(process.env.DB_HOST)
  if (sourceUri && sourceUri === multilingualUri) {
    throw new Error('DB_HOST 与 DB_HOST_MULTILINGUAL 不能指向同一个数据库地址')
  }

  const connection = multilingualConnectionInfo.connection
  if (!connection || !connection.db) {
    throw new Error('多语言数据库连接尚未就绪')
  }

  const expectedDatabaseName = getMongoDatabaseName(multilingualUri)
  const sourceDatabaseName = getMongoDatabaseName(sourceUri)
  const actualDatabaseName = connection.db.databaseName
  if (expectedDatabaseName && actualDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `多语言数据库连接错误，当前连接到 ${actualDatabaseName}，期望 ${expectedDatabaseName}`
    )
  }

  if (sourceDatabaseName && actualDatabaseName === sourceDatabaseName) {
    throw new Error(
      `多语言备份禁止连接源站数据库 ${sourceDatabaseName}，请检查 DB_HOST_MULTILINGUAL`
    )
  }

  return connection.db
}

function getBackupCacheDir(pathname) {
  return path.join('./cache', pathname)
}

function getBackupMongoDir(pathname) {
  return path.join(getBackupCacheDir(pathname), MONGODB_ARCHIVE_DIR)
}

function getRestoreCacheDir(fullPath) {
  return path.join('./cache', path.basename(fullPath, '.zip'))
}

function shouldIgnoreCollection(collectionName) {
  return ignoredCollections.has(collectionName)
}

function getResourceManifest() {
  return RESOURCE_DIRECTORIES.map(resourceDirectory => ({
    name: resourceDirectory.name,
    archivePath: resourceDirectory.archivePath
  }))
}

function ensureResourceDirectoriesExist() {
  for (const resourceDirectory of RESOURCE_DIRECTORIES) {
    if (!fs.existsSync(resourceDirectory.sourcePath)) {
      throw new Error(`多语言资源目录不存在: ${resourceDirectory.sourcePath}`)
    }
  }
}

async function writeBsonDocument(writeStream, doc) {
  const bsonData = bson.serialize(doc)
  if (!writeStream.write(bsonData)) {
    await once(writeStream, 'drain')
  }
}

async function closeWriteStream(writeStream) {
  const finishPromise = once(writeStream, 'finish')
  writeStream.end()
  await finishPromise
}

function readBackupInfoFromCacheDir(cacheDir) {
  const backupInfoPath = path.join(cacheDir, BACKUP_INFO_FILE)
  if (!fs.existsSync(backupInfoPath)) {
    throw new Error('备份文件缺少多语言备份信息')
  }

  return bson.deserialize(fs.readFileSync(backupInfoPath))
}

function assertBackupInfo(backupInfo) {
  if (!backupInfo || backupInfo.scope !== MULTILINGUAL_BACKUP_SCOPE) {
    throw new Error('备份文件不是多语言站备份，已拒绝还原')
  }

  if (!Array.isArray(backupInfo.collections)) {
    throw new Error('备份文件缺少集合清单，已拒绝还原')
  }

  for (const collectionName of backupInfo.collections) {
    if (shouldIgnoreCollection(collectionName)) {
      throw new Error(`备份集合清单包含禁止还原集合: ${collectionName}`)
    }
  }
}

function assertBackupResourceDirectories(fullPath, backupInfo) {
  if (!Array.isArray(backupInfo.resourceDirectories)) {
    throw new Error('备份文件缺少资源目录清单，已拒绝还原')
  }

  const archivePathSet = new Set(
    backupInfo.resourceDirectories.map(resourceDirectory => {
      return resourceDirectory.archivePath
    })
  )

  for (const resourceDirectory of RESOURCE_DIRECTORIES) {
    if (!archivePathSet.has(resourceDirectory.archivePath)) {
      throw new Error(
        `备份文件缺少资源目录记录: ${resourceDirectory.archivePath}`
      )
    }

    const sourceDir = path.join(
      getRestoreCacheDir(fullPath),
      resourceDirectory.archivePath
    )
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`备份文件缺少资源目录: ${resourceDirectory.archivePath}`)
    }
  }
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath)
  if (!relativePath) {
    return true
  }

  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

async function insertDocumentBatch(collection, documentBatch) {
  if (documentBatch.length === 0) {
    return
  }

  await collection.insertMany(documentBatch, { ordered: true })
  documentBatch.length = 0
}

async function restoreCollectionDocuments(nativeDb, collectionName, filePath) {
  const collection = nativeDb.collection(collectionName)
  const readStream = fs.createReadStream(filePath)
  let buffer = Buffer.alloc(0)
  const documentBatch = []

  for await (const chunk of readStream) {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length > 4) {
      const size = buffer.readInt32LE(0)
      if (size > buffer.length) {
        break
      }

      const doc = bson.deserialize(buffer.subarray(0, size))
      documentBatch.push(doc)
      buffer = buffer.subarray(size)

      if (documentBatch.length >= BSON_BATCH_SIZE) {
        console.log(
          `Collection ${collectionName} restored ${BSON_BATCH_SIZE} documents try to save`
        )
        await insertDocumentBatch(collection, documentBatch)
        console.log(
          `Collection ${collectionName} restored ${BSON_BATCH_SIZE} documents saved`
        )
      }
    }
  }

  if (buffer.length > 0) {
    throw new Error(`Collection ${collectionName} BSON 数据不完整`)
  }

  if (documentBatch.length > 0) {
    console.log(
      `Collection ${collectionName} restored ${documentBatch.length} documents try to save`
    )
    await insertDocumentBatch(collection, documentBatch)
    console.log(
      `Collection ${collectionName} restored ${documentBatch.length} documents saved`
    )
  }
}

function validateRestoreCollectionFiles(backupInfo, files) {
  const expectedCollections = new Set(backupInfo.collections)
  const actualCollections = new Set(
    files.map(file => file.replace('.bson', ''))
  )

  for (const collectionName of expectedCollections) {
    if (!actualCollections.has(collectionName)) {
      throw new Error(`备份文件缺少集合数据: ${collectionName}`)
    }
  }

  for (const collectionName of actualCollections) {
    if (!expectedCollections.has(collectionName)) {
      throw new Error(`备份文件包含未登记集合数据: ${collectionName}`)
    }
  }
}

async function removeDirectoryContents(dir) {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
    return
  }

  const files = await fs.promises.readdir(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    await fsEX.remove(fullPath)
  }
}

exports.dumpCollections = async (pathname, id) => {
  const nativeDb = assertMultilingualDbConnection()
  const dir = getBackupMongoDir(pathname)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const collections = await nativeDb.listCollections().toArray()
  const dumpedCollections = []

  for (const collection of collections) {
    if (shouldIgnoreCollection(collection.name)) {
      continue
    }

    const cursor = nativeDb.collection(collection.name).find()
    const writeStream = fs.createWriteStream(
      path.join(dir, `${collection.name}.bson`)
    )

    for await (const doc of cursor) {
      await writeBsonDocument(writeStream, doc)
    }

    await closeWriteStream(writeStream)
    dumpedCollections.push(collection.name)
    console.log(`Collection ${collection.name} dumped successfully`)
  }

  const backupInfo = {
    _id: id,
    scope: MULTILINGUAL_BACKUP_SCOPE,
    version: 2,
    databaseName: nativeDb.databaseName,
    collections: dumpedCollections,
    resourceDirectories: getResourceManifest(),
    createdAt: new Date()
  }
  const backupInfoBSONData = bson.serialize(backupInfo)
  fs.writeFileSync(
    path.join(getBackupCacheDir(pathname), BACKUP_INFO_FILE),
    backupInfoBSONData
  )
  console.log(`backup info ${JSON.stringify(backupInfo)} dumped successfully`)
}

exports.backupToZip = async pathname => {
  const dir = getBackupCacheDir(pathname)
  ensureResourceDirectoriesExist()

  if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups', { recursive: true })
  }

  const output = fs.createWriteStream(`./backups/${pathname}.zip`)
  const archive = archiver('zip', {
    zlib: { level: 2 }
  })

  console.log('backup to zip start')
  const archivePromise = pipeline(archive, output)
  archive.directory(dir, false)
  for (const resourceDirectory of RESOURCE_DIRECTORIES) {
    archive.directory(
      resourceDirectory.sourcePath,
      resourceDirectory.archivePath
    )
  }

  archive.finalize()
  await archivePromise

  console.log('backup to zip end')
}

exports.getBackupFileSize = pathname => {
  const fullPath = `./backups/${pathname}.zip`
  if (!fs.existsSync(fullPath)) {
    throw new Error('backup file not exists')
  }
  const stats = fs.statSync(fullPath)
  return stats.size
}

exports.clearBackupCache = async pathname => {
  const dir = getBackupCacheDir(pathname)
  if (!fs.existsSync(dir)) {
    throw new Error('backup cache not exists')
  }
  await fsEX.remove(dir)
  console.log('clear backup cache success')
}

exports.unzipBackup = fullPath => {
  console.log('unzip backup start')
  return new Promise((resolve, reject) => {
    const dir = path.resolve(getRestoreCacheDir(fullPath))
    const writePromises = []

    yauzl.open(fullPath, { lazyEntries: true }, function (err, zipfile) {
      if (err) {
        reject(err)
        return
      }

      zipfile.readEntry()
      zipfile.on('entry', function (entry) {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry()
          return
        }

        const filePath = path.resolve(dir, entry.fileName)
        if (!isPathInside(dir, filePath)) {
          reject(new Error(`备份文件包含非法路径: ${entry.fileName}`))
          zipfile.close()
          return
        }

        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        zipfile.openReadStream(entry, function (streamErr, readStream) {
          if (streamErr) {
            reject(streamErr)
            return
          }

          const writeStream = fs.createWriteStream(filePath)
          const writePromise = new Promise((resolveWrite, rejectWrite) => {
            readStream.on('error', rejectWrite)
            writeStream.on('error', rejectWrite)
            writeStream.on('finish', resolveWrite)
          })
          writePromises.push(writePromise)
          readStream.on('end', function () {
            zipfile.readEntry()
          })
          readStream.pipe(writeStream)
        })
      })
      zipfile.once('end', async () => {
        try {
          await Promise.all(writePromises)
          zipfile.close()
          console.log('unzip backup success')
          resolve()
        } catch (writeError) {
          reject(writeError)
        }
      })
      zipfile.once('error', reject)
    })
  })
}

exports.validateBackupInfo = async fullPath => {
  const nativeDb = assertMultilingualDbConnection()
  const backupInfo = readBackupInfoFromCacheDir(getRestoreCacheDir(fullPath))
  assertBackupInfo(backupInfo)

  if (
    backupInfo.databaseName &&
    backupInfo.databaseName !== nativeDb.databaseName
  ) {
    throw new Error(
      `备份数据库为 ${backupInfo.databaseName}，当前多语言数据库为 ${nativeDb.databaseName}，已拒绝还原`
    )
  }

  assertBackupResourceDirectories(fullPath, backupInfo)

  return backupInfo
}

exports.clearCollections = async () => {
  const nativeDb = assertMultilingualDbConnection()
  const collections = await nativeDb.listCollections().toArray()

  for (const collection of collections) {
    if (shouldIgnoreCollection(collection.name)) {
      continue
    }

    console.log(`Clearing collection ${collection.name}`)
    await nativeDb.collection(collection.name).deleteMany({})
    console.log(`Collection ${collection.name} cleared successfully`)
  }
}

exports.restoreCollections = async fullPath => {
  const nativeDb = assertMultilingualDbConnection()
  const backupInfo = readBackupInfoFromCacheDir(getRestoreCacheDir(fullPath))
  assertBackupInfo(backupInfo)

  const dir = path.join(getRestoreCacheDir(fullPath), MONGODB_ARCHIVE_DIR)
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.bson'))
  validateRestoreCollectionFiles(backupInfo, files)

  for (const collectionName of backupInfo.collections) {
    console.log(`Restoring collection ${collectionName}`)
    await restoreCollectionDocuments(
      nativeDb,
      collectionName,
      path.join(dir, `${collectionName}.bson`)
    )
    console.log(`Collection ${collectionName} restored successfully`)
  }
}

exports.removeResourceContents = async () => {
  for (const resourceDirectory of RESOURCE_DIRECTORIES) {
    await removeDirectoryContents(resourceDirectory.targetPath)
    console.log(`clear ${resourceDirectory.name} contents success`)
  }
}

exports.restoreResources = async fullPath => {
  const sourceRoot = getRestoreCacheDir(fullPath)

  for (const resourceDirectory of RESOURCE_DIRECTORIES) {
    const sourceDir = path.join(sourceRoot, resourceDirectory.archivePath)
    const targetDir = resourceDirectory.targetPath

    if (!fs.existsSync(sourceDir)) {
      throw new Error(`备份文件缺少资源目录: ${resourceDirectory.archivePath}`)
    }

    await fsEX.copy(sourceDir, targetDir)
    console.log(`restore ${resourceDirectory.name} success`)
  }
}

exports.clearRestoreCache = async fullPath => {
  const dir = getRestoreCacheDir(fullPath)
  if (!fs.existsSync(dir)) {
    throw new Error('restore cache not exists')
  }
  await fsEX.remove(dir)
  console.log('clear restore cache success')
}
