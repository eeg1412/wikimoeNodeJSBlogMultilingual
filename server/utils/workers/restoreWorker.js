const { parentPort } = require('worker_threads')
const backupTools = require('../backup')
const multilingualConnectionInfo = require('../../mongodb/multilingualConnection')

const dbPromise = multilingualConnectionInfo.waitReady()

parentPort.on('message', async fullPath => {
  dbPromise
    .then(async () => {
      console.log('worker start')
      await backupTools.unzipBackup(fullPath)
      await backupTools.validateBackupInfo(fullPath)
      await backupTools.clearCollections()
      await backupTools.restoreCollections(fullPath)
      await backupTools.removeResourceContents()
      await backupTools.restoreResources(fullPath)
      await backupTools.clearRestoreCache(fullPath)
      parentPort.postMessage({ status: 'success' })
      parentPort.close()
    })
    .catch(err => {
      console.error('Failed to connect to database', err)
      parentPort.postMessage({ status: 'error', error: err })
      parentPort.close()
    })
})
