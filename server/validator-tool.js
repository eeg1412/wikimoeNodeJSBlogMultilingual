const fs = require('fs')
const path = require('path')
const {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODE_MAP,
  LANGUAGE_CONFIG_LIST: SERVER_LANGUAGE_CONFIG_LIST,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('./utils/language')

const rootDir = path.resolve(__dirname, '..')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertFileIncludes(filePath, values) {
  const content = fs.readFileSync(filePath, 'utf8')

  for (const value of values) {
    assert(content.includes(value), `${filePath} 缺少 ${value}`)
  }
}

function assertFileNotIncludes(filePath, values) {
  const content = fs.readFileSync(filePath, 'utf8')

  for (const value of values) {
    assert(!content.includes(value), `${filePath} 禁止包含 ${value}`)
  }
}

function stripJavaScriptComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

function getFilesRecursively(dirPath, extensions = ['.js']) {
  const files = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      continue
    }

    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath))
      continue
    }

    if (
      entry.isFile() &&
      extensions.some(extension => fullPath.endsWith(extension))
    ) {
      files.push(fullPath)
    }
  }

  return files
}

function loadExportedConstConfig(filePath, exportNames) {
  const content = fs.readFileSync(filePath, 'utf8')
  let executableContent = content

  for (const exportName of exportNames) {
    executableContent = executableContent.replace(
      new RegExp(`export\\s+const\\s+${exportName}\\s*=`, 'g'),
      `const ${exportName} =`
    )
  }

  assert(
    !/(^|\n)\s*import\s/.test(executableContent),
    `${filePath} 禁止包含 import`
  )
  assert(
    !/(^|\n)\s*export\s/.test(executableContent),
    `${filePath} 存在未支持的导出`
  )

  const returnStatement = `\nreturn { ${exportNames.join(', ')} }`
  return new Function(`${executableContent}${returnStatement}`)()
}

function loadDefaultObjectModule(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const executableContent = content.replace(/export\s+default\s+/, 'return ')

  assert(
    executableContent !== content,
    `${filePath} 必须使用 export default 导出语言包对象`
  )
  assert(
    !/(^|\n)\s*import\s/.test(executableContent),
    `${filePath} 禁止包含 import`
  )
  assert(
    !/(^|\n)\s*export\s/.test(executableContent),
    `${filePath} 存在未支持的导出`
  )

  return new Function(executableContent)()
}

function readObjectPath(source, pathText) {
  const pathList = pathText.split('.')
  let currentValue = source

  for (const pathItem of pathList) {
    if (!currentValue || typeof currentValue !== 'object') {
      return undefined
    }

    if (!Object.prototype.hasOwnProperty.call(currentValue, pathItem)) {
      return undefined
    }

    currentValue = currentValue[pathItem]
  }

  return currentValue
}

function collectObjectPathList(source, prefix = '') {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return [prefix]
  }

  const pathList = []
  for (const key of Object.keys(source)) {
    let nextPrefix = key
    if (prefix) {
      nextPrefix = `${prefix}.${key}`
    }

    pathList.push(...collectObjectPathList(source[key], nextPrefix))
  }

  return pathList
}

function assertLanguageConfigList(languageConfigList, sourceName) {
  assert(
    Array.isArray(languageConfigList) && languageConfigList.length > 0,
    `${sourceName} 语言配置必须是非空数组`
  )

  const languageCodeSet = new Set()
  let defaultLanguageConfig = null

  for (const languageConfig of languageConfigList) {
    assert(
      languageConfig && typeof languageConfig === 'object',
      `${sourceName} 语言配置项必须是对象`
    )
    assert(
      typeof languageConfig.code === 'string' && languageConfig.code.trim(),
      `${sourceName} 语言配置缺少 code`
    )
    assert(
      languageConfig.code === languageConfig.code.trim(),
      `${sourceName} 语言 code 存在多余空白: ${languageConfig.code}`
    )
    assert(
      !languageCodeSet.has(languageConfig.code),
      `${sourceName} 语言 code 重复: ${languageConfig.code}`
    )
    assert(
      typeof languageConfig.label === 'string' && languageConfig.label.trim(),
      `${sourceName} 语言配置缺少 label: ${languageConfig.code}`
    )

    languageCodeSet.add(languageConfig.code)

    if (languageConfig.isDefault) {
      assert(!defaultLanguageConfig, `${sourceName} 只能有一个默认语言`)
      defaultLanguageConfig = languageConfig
    }
  }

  assert(defaultLanguageConfig, `${sourceName} 必须声明默认语言`)
  return defaultLanguageConfig
}

function getLanguageConfigSummary(languageConfigList, sourceName) {
  const defaultLanguageConfig = assertLanguageConfigList(
    languageConfigList,
    sourceName
  )
  const languageCodes = []
  const languageLabelMap = {}

  for (const languageConfig of languageConfigList) {
    languageCodes.push(languageConfig.code)
    languageLabelMap[languageConfig.code] = languageConfig.label
  }

  return {
    sourceName,
    languageCodes,
    defaultLanguageCode: defaultLanguageConfig.code,
    languageLabelMap
  }
}

function assertLanguageConfigSummaryEqual(referenceSummary, currentSummary) {
  assert(
    currentSummary.languageCodes.length ===
      referenceSummary.languageCodes.length,
    `${currentSummary.sourceName} 语言数量与 ${referenceSummary.sourceName} 不一致`
  )
  assert(
    currentSummary.defaultLanguageCode === referenceSummary.defaultLanguageCode,
    `${currentSummary.sourceName} 默认语言与 ${referenceSummary.sourceName} 不一致`
  )

  for (const index of referenceSummary.languageCodes.keys()) {
    const languageCode = referenceSummary.languageCodes[index]
    assert(
      currentSummary.languageCodes[index] === languageCode,
      `${currentSummary.sourceName} 语言顺序与 ${referenceSummary.sourceName} 不一致`
    )
    assert(
      currentSummary.languageLabelMap[languageCode] ===
        referenceSummary.languageLabelMap[languageCode],
      `${currentSummary.sourceName} 语言显示名不一致: ${languageCode}`
    )
  }
}

function getUnsupportedLanguageCodeForValidation() {
  const candidateLanguageCodes = ['fr-FR', 'ko-KR', 'de-DE', 'es-ES']
  for (const languageCode of candidateLanguageCodes) {
    if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
      return languageCode
    }
  }

  throw new Error('缺少可用于校验的不支持语言 code')
}

function getAdminLanguageConfigData() {
  const adminConfigPath = path.join(
    rootDir,
    'admin',
    'src',
    'config',
    'languages.js'
  )

  assert(fs.existsSync(adminConfigPath), '缺少 admin/src/config/languages.js')
  return loadExportedConstConfig(adminConfigPath, [
    'LANGUAGE_CONFIG_LIST',
    'SIDEBAR_BUILTIN_TYPE_LIST'
  ])
}

function getBlogLanguageConfigData() {
  const blogConfigPath = path.join(rootDir, 'blog', 'shared', 'languages.js')

  assert(fs.existsSync(blogConfigPath), '缺少 blog/shared/languages.js')
  return loadExportedConstConfig(blogConfigPath, [
    'LANGUAGE_CONFIG_LIST',
    'REQUIRED_LANGUAGE_MODULE_NAMES'
  ])
}

function validateAdminSidebarBuiltinTitles(
  adminLanguageConfigList,
  sidebarBuiltinTypeList
) {
  assert(
    Array.isArray(sidebarBuiltinTypeList) && sidebarBuiltinTypeList.length > 0,
    'Admin 侧边栏内置类型配置必须是非空数组'
  )

  for (const sidebarType of sidebarBuiltinTypeList) {
    assert(
      Number.isInteger(sidebarType),
      `Admin 侧边栏内置类型必须是整数: ${sidebarType}`
    )
  }

  for (const languageConfig of adminLanguageConfigList) {
    assert(
      languageConfig.sidebarBuiltinTitles &&
        typeof languageConfig.sidebarBuiltinTitles === 'object',
      `Admin 缺少侧边栏内置标题配置: ${languageConfig.code}`
    )

    for (const sidebarType of sidebarBuiltinTypeList) {
      const title = languageConfig.sidebarBuiltinTitles[sidebarType]
      assert(
        typeof title === 'string' && title.trim(),
        `Admin 缺少侧边栏内置标题 ${sidebarType}: ${languageConfig.code}`
      )
    }
  }
}

function validateBlogLanguagePackKeys(referencePack, currentPack, filePath) {
  const referencePathList = collectObjectPathList(referencePack)

  for (const languageTextPath of referencePathList) {
    assert(
      readObjectPath(currentPack, languageTextPath) !== undefined,
      `${filePath} 缺少语言 key: ${languageTextPath}`
    )
  }
}

function validateBlogSidebarBuiltinTitles(
  blogLangDir,
  adminLanguageConfigList,
  sidebarBuiltinTypeList
) {
  for (const languageConfig of adminLanguageConfigList) {
    const commonPath = path.join(blogLangDir, languageConfig.code, 'common.js')
    const commonText = loadDefaultObjectModule(commonPath)

    for (const sidebarType of sidebarBuiltinTypeList) {
      const titlePath = `sidebarBuiltinTitles.${sidebarType}`
      assert(
        readObjectPath(commonText, titlePath) ===
          languageConfig.sidebarBuiltinTitles[sidebarType],
        `Blog 与 Admin 侧边栏内置标题不一致 ${sidebarType}: ${languageConfig.code}`
      )
    }
  }
}

function validateBlogLanguagePacks(blogConfigData, adminConfigData) {
  const blogLangDir = path.join(rootDir, 'blog', 'app', 'lang')
  const blogSummary = getLanguageConfigSummary(
    blogConfigData.LANGUAGE_CONFIG_LIST,
    'Blog'
  )
  const requiredModuleNames = blogConfigData.REQUIRED_LANGUAGE_MODULE_NAMES

  assert(fs.existsSync(blogLangDir), '缺少 blog/app/lang')
  assert(
    Array.isArray(requiredModuleNames) && requiredModuleNames.length > 0,
    'Blog REQUIRED_LANGUAGE_MODULE_NAMES 必须是非空数组'
  )

  const languageDirNames = fs
    .readdirSync(blogLangDir, { withFileTypes: true })
    .filter(entry => {
      return entry.isDirectory()
    })
    .map(entry => {
      return entry.name
    })

  for (const languageDirName of languageDirNames) {
    assert(
      blogSummary.languageCodes.includes(languageDirName),
      `Blog 存在未配置语言目录: ${languageDirName}`
    )
  }

  const referenceLanguagePackMap = {}
  for (const moduleName of requiredModuleNames) {
    const referencePath = path.join(
      blogLangDir,
      blogSummary.defaultLanguageCode,
      `${moduleName}.js`
    )
    assert(
      fs.existsSync(referencePath),
      `缺少默认语言包: blog/app/lang/${blogSummary.defaultLanguageCode}/${moduleName}.js`
    )
    referenceLanguagePackMap[moduleName] =
      loadDefaultObjectModule(referencePath)
  }

  for (const languageCode of blogSummary.languageCodes) {
    for (const moduleName of requiredModuleNames) {
      const modulePath = path.join(
        blogLangDir,
        languageCode,
        `${moduleName}.js`
      )
      assert(
        fs.existsSync(modulePath),
        `缺少语言包: blog/app/lang/${languageCode}/${moduleName}.js`
      )

      const currentPack = loadDefaultObjectModule(modulePath)
      validateBlogLanguagePackKeys(
        referenceLanguagePackMap[moduleName],
        currentPack,
        modulePath
      )
    }
  }

  validateBlogSidebarBuiltinTitles(
    blogLangDir,
    adminConfigData.LANGUAGE_CONFIG_LIST,
    adminConfigData.SIDEBAR_BUILTIN_TYPE_LIST
  )
}

function validateSourceReadOnlyFiles() {
  const serverDir = path.join(rootDir, 'server')
  const sourceRepositoryDir = path.join(
    serverDir,
    'mongodb',
    'sourceRepositories'
  )
  const writeCallPatterns = [
    { name: 'save', pattern: /\.save\s*\(/ },
    { name: 'create', pattern: /\.create\s*\(/ },
    { name: 'insertMany', pattern: /\.insertMany\s*\(/ },
    { name: 'updateOne', pattern: /\.updateOne\s*\(/ },
    { name: 'updateMany', pattern: /\.updateMany\s*\(/ },
    { name: 'findOneAndUpdate', pattern: /\.findOneAndUpdate\s*\(/ },
    { name: 'deleteOne', pattern: /\.deleteOne\s*\(/ },
    { name: 'deleteMany', pattern: /\.deleteMany\s*\(/ },
    { name: 'bulkWrite', pattern: /\.bulkWrite\s*\(/ },
    { name: 'dropCollection', pattern: /\.dropCollection\s*\(/ },
    { name: 'dropDatabase', pattern: /\.dropDatabase\s*\(/ },
    { name: 'createCollection', pattern: /\.createCollection\s*\(/ },
    { name: 'createIndex', pattern: /\.createIndex\s*\(/ },
    { name: 'syncIndexes', pattern: /\.syncIndexes\s*\(/ }
  ]
  const sourceFiles = getFilesRecursively(serverDir).filter(filePath => {
    const fileName = path.basename(filePath)
    return (
      fileName.startsWith('source') || filePath.startsWith(sourceRepositoryDir)
    )
  })

  for (const filePath of sourceFiles) {
    const content = stripJavaScriptComments(fs.readFileSync(filePath, 'utf8'))
    for (const item of writeCallPatterns) {
      assert(
        !item.pattern.test(content),
        `${filePath} 禁止在源站只读文件中调用 ${item.name}`
      )
    }
  }
}

function validateDualMongoFoundation() {
  const serverDir = path.join(rootDir, 'server')
  const mongodbDir = path.join(serverDir, 'mongodb')
  const sourceConnectionPath = path.join(mongodbDir, 'sourceConnection.js')
  const multilingualConnectionPath = path.join(
    mongodbDir,
    'multilingualConnection.js'
  )
  const registerModelsPath = path.join(
    mongodbDir,
    'modelFactory',
    'registerModels.js'
  )
  const sourceRepositoriesPath = path.join(
    mongodbDir,
    'sourceRepositories',
    'index.js'
  )
  const multilingualRepositoriesPath = path.join(
    mongodbDir,
    'multilingualRepositories',
    'index.js'
  )
  const indexPath = path.join(mongodbDir, 'index.js')
  const packagePath = path.join(serverDir, 'package.json')

  assert(
    fs.existsSync(sourceConnectionPath),
    '缺少 server/mongodb/sourceConnection.js'
  )
  assert(
    fs.existsSync(multilingualConnectionPath),
    '缺少 server/mongodb/multilingualConnection.js'
  )
  assert(
    fs.existsSync(registerModelsPath),
    '缺少 server/mongodb/modelFactory/registerModels.js'
  )
  assert(
    fs.existsSync(sourceRepositoriesPath),
    '缺少 server/mongodb/sourceRepositories/index.js'
  )
  assert(
    fs.existsSync(multilingualRepositoriesPath),
    '缺少 server/mongodb/multilingualRepositories/index.js'
  )
  assert(fs.existsSync(packagePath), '缺少 server/package.json')

  assertFileIncludes(sourceConnectionPath, [
    'mongoose.createConnection(process.env.DB_HOST, {',
    'autoCreate: false',
    'autoIndex: false',
    'waitReady'
  ])
  assertFileIncludes(multilingualConnectionPath, [
    'mongoose.createConnection(process.env.DB_HOST_MULTILINGUAL)',
    'waitReady'
  ])
  assertFileIncludes(registerModelsPath, ['connection.model', 'modelsDir'])
  assertFileIncludes(sourceRepositoriesPath, [
    'find(params, projection, options = {})',
    'findOne(params, projection, options = {})',
    'countDocuments(params)',
    'aggregate(pipeline)',
    'findCursor(params, projection, options = {})'
  ])
  assertFileIncludes(multilingualRepositoriesPath, [
    'model: models[modelName]',
    'utilsMap'
  ])
  assertFileIncludes(indexPath, [
    'source: {',
    'multilingual: {',
    'initializeMultilingualRuntime'
  ])
  assertFileNotIncludes(indexPath, ['mongoose.connect(process.env.DB_HOST)'])
  assertFileIncludes(packagePath, [
    '"validate:foundation": "node ./validator-tool.js foundation"'
  ])

  validateSourceReadOnlyFiles()
}

function validateMultilingualBackupScope() {
  const serverDir = path.join(rootDir, 'server')
  const backupPath = path.join(serverDir, 'utils', 'backup.js')
  const backupWorkerPath = path.join(
    serverDir,
    'utils',
    'workers',
    'backupWorker.js'
  )
  const restoreWorkerPath = path.join(
    serverDir,
    'utils',
    'workers',
    'restoreWorker.js'
  )
  const restoreBackupPath = path.join(
    serverDir,
    'api',
    'admin',
    'backup',
    'restoreBackup.js'
  )

  assert(fs.existsSync(backupPath), '缺少 server/utils/backup.js')
  assert(
    fs.existsSync(backupWorkerPath),
    '缺少 server/utils/workers/backupWorker.js'
  )
  assert(
    fs.existsSync(restoreWorkerPath),
    '缺少 server/utils/workers/restoreWorker.js'
  )

  assertFileIncludes(backupPath, [
    "require('../mongodb/multilingualConnection')",
    'MULTILINGUAL_BACKUP_SCOPE',
    'DB_HOST_MULTILINGUAL',
    'assertMultilingualDbConnection',
    "archivePath: 'public'",
    "archivePath: 'blog-public'",
    "archivePath: 'blog-public-root'",
    'validateBackupInfo',
    'insertMany(documentBatch'
  ])
  assertFileNotIncludes(backupPath, [
    'mongoose.connection.db',
    'modelUtilMap',
    "require('../mongodb/utils/aiUsageLogs')",
    "require('../mongodb/sourceConnection')"
  ])
  assertFileIncludes(backupWorkerPath, [
    "require('../../mongodb/multilingualConnection')",
    'multilingualConnectionInfo.waitReady()'
  ])
  assertFileNotIncludes(backupWorkerPath, ["require('../../tools/mongodb')"])
  assertFileIncludes(restoreWorkerPath, [
    "require('../../mongodb/multilingualConnection')",
    'multilingualConnectionInfo.waitReady()',
    'validateBackupInfo(fullPath)',
    'removeResourceContents()',
    'restoreResources(fullPath)'
  ])
  assertFileNotIncludes(restoreWorkerPath, ["require('../../tools/mongodb')"])
  assertFileIncludes(restoreBackupPath, ['refreshAllLanguageCache()'])
}

function validateLanguageCodeRules() {
  const adminConfigData = getAdminLanguageConfigData()
  const blogConfigData = getBlogLanguageConfigData()
  const serverSummary = getLanguageConfigSummary(
    SERVER_LANGUAGE_CONFIG_LIST,
    'Server'
  )
  const adminSummary = getLanguageConfigSummary(
    adminConfigData.LANGUAGE_CONFIG_LIST,
    'Admin'
  )
  const blogSummary = getLanguageConfigSummary(
    blogConfigData.LANGUAGE_CONFIG_LIST,
    'Blog'
  )

  assertLanguageConfigSummaryEqual(serverSummary, adminSummary)
  assertLanguageConfigSummaryEqual(serverSummary, blogSummary)
  validateAdminSidebarBuiltinTitles(
    adminConfigData.LANGUAGE_CONFIG_LIST,
    adminConfigData.SIDEBAR_BUILTIN_TYPE_LIST
  )

  assert(
    DEFAULT_LANGUAGE_CODE === serverSummary.defaultLanguageCode,
    '默认语言必须从 server/config/languages.js 派生'
  )
  assert(
    SUPPORTED_LANGUAGE_CODES.length === serverSummary.languageCodes.length,
    'Server 支持语言数量必须从配置派生'
  )

  for (const code of serverSummary.languageCodes) {
    assert(SUPPORTED_LANGUAGE_CODES.includes(code), `缺少语言 code: ${code}`)
    assert(
      LANGUAGE_CODE_MAP[code.toLowerCase()] === code,
      `语言映射错误: ${code}`
    )
    assert(
      normalizeLanguageCode(code.toUpperCase()) === code,
      `大小写归一化失败: ${code}`
    )
  }

  assert(normalizeLanguageCode('ZH-cn') === 'zh-CN', 'ZH-cn 必须归一化为 zh-CN')
  assert(
    normalizeLanguageCode(' ja-jp ') === 'ja-JP',
    'ja-jp 必须归一化为 ja-JP'
  )
  const unsupportedLanguageCode = getUnsupportedLanguageCodeForValidation()
  assert(
    normalizeLanguageCode(unsupportedLanguageCode) === null,
    '不支持语言必须返回 null'
  )
  assert(normalizeLanguageCode('') === null, '空字符串必须返回 null')
}

function validateBlogLanguageEntry() {
  const adminConfigData = getAdminLanguageConfigData()
  const blogConfigData = getBlogLanguageConfigData()
  const blogLangIndexPath = path.join(
    rootDir,
    'blog',
    'app',
    'lang',
    'index.js'
  )
  const useLangPath = path.join(
    rootDir,
    'blog',
    'app',
    'composables',
    'useLang.js'
  )
  const blogSharedLanguagePath = path.join(
    rootDir,
    'blog',
    'shared',
    'languages.js'
  )
  const useOptionsPath = path.join(
    rootDir,
    'blog',
    'app',
    'composables',
    'useOptions.js'
  )
  const languageActiveMiddlewarePath = path.join(
    rootDir,
    'blog',
    'app',
    'middleware',
    'language-active.global.js'
  )
  const routeCachePath = path.join(
    rootDir,
    'blog',
    'server',
    'plugins',
    'routecache.js'
  )
  const errorPagePath = path.join(rootDir, 'blog', 'app', 'error.vue')

  assert(fs.existsSync(blogLangIndexPath), '缺少 blog/app/lang/index.js')
  assert(fs.existsSync(useLangPath), '缺少 blog/app/composables/useLang.js')
  assert(fs.existsSync(blogSharedLanguagePath), '缺少 blog/shared/languages.js')
  assert(
    fs.existsSync(useOptionsPath),
    '缺少 blog/app/composables/useOptions.js'
  )
  assert(
    fs.existsSync(languageActiveMiddlewarePath),
    '缺少 blog/app/middleware/language-active.global.js'
  )
  assert(
    fs.existsSync(routeCachePath),
    '缺少 blog/server/plugins/routecache.js'
  )
  assert(fs.existsSync(errorPagePath), '缺少 blog/app/error.vue')
  assertFileIncludes(blogSharedLanguagePath, [
    'LANGUAGE_CONFIG_LIST',
    'REQUIRED_LANGUAGE_MODULE_NAMES'
  ])
  assertFileIncludes(blogLangIndexPath, [
    'LANGUAGE_CONFIG_LIST',
    'REQUIRED_LANGUAGE_MODULE_NAMES',
    'import.meta.glob',
    'SUPPORTED_LANGUAGE_CODES',
    'DEFAULT_LANGUAGE_CODE',
    'normalizeLanguageCode',
    'assertLanguageCode',
    'getLanguageText'
  ])
  assertFileIncludes(useLangPath, [
    'useLang',
    'assertLanguageCode',
    'getLanguageText'
  ])
  assertFileIncludes(useOptionsPath, [
    'blogLanguageEnabled',
    'BLOG_LANGUAGE_DISABLED_REASON',
    'optionsLanguageCode',
    'createLanguageNotFoundError'
  ])
  assertFileIncludes(languageActiveMiddlewarePath, [
    'defineNuxtRouteMiddleware',
    'getOptions({ languageCode, force: true })',
    'throw createLanguageNotFoundError()'
  ])
  assertFileIncludes(routeCachePath, [
    '#shared/languages',
    'isBlogLanguageEnabledForUrl',
    'blogLanguageEnabled',
    'SUPPORTED_LANGUAGE_CODES.flatMap'
  ])
  assertFileIncludes(errorPagePath, [
    'BLOG_LANGUAGE_DISABLED_REASON',
    'isBlogLanguageDisabledError',
    'DEFAULT_LANGUAGE_CODE',
    "return '/'"
  ])

  validateBlogLanguagePacks(blogConfigData, adminConfigData)
}

function validateModelSchemaFields() {
  const modelDir = path.join(rootDir, 'server', 'mongodb', 'models')
  const helperPath = path.join(
    rootDir,
    'server',
    'mongodb',
    'modelFactory',
    'multilingualSchema.js'
  )
  const fullIdentityModels = [
    'posts',
    'users',
    'sorts',
    'tags',
    'mappoints',
    'attachments',
    'albums',
    'bangumis',
    'movies',
    'games',
    'gamePlatforms',
    'books',
    'booktypes',
    'events',
    'eventtypes',
    'votes'
  ]
  const localLanguageModels = ['navis', 'banners', 'sidebars']

  assert(fs.existsSync(helperPath), '缺少 multilingualSchema helper')
  assertFileIncludes(helperPath, [
    'SUPPORTED_LANGUAGE_CODES',
    'SOURCE_COLLECTIONS',
    'languageCode',
    'sourceLanguageCode',
    'sourceId',
    'sourceCollection',
    'sourceSnapshotId',
    'translationGroupId',
    'recordKind',
    'snapshotVersion',
    'sourceSnapshotAt',
    'sourceUpdatedAt',
    'sourceHash',
    'sourceChanged',
    'pendingReview',
    'sourceChangedAt',
    'mediaMode',
    'remoteSnapshot',
    'localFilepath',
    'scope'
  ])
  assertFileIncludes(helperPath, [
    'addPostIndexes',
    'addRelationIdentityIndex',
    'addAttachmentIndexes',
    'addOptionsLanguageFields'
  ])

  for (const modelName of fullIdentityModels) {
    const modelPath = path.join(modelDir, `${modelName}.js`)
    assert(fs.existsSync(modelPath), `缺少模型文件: ${modelName}.js`)
    assertFileIncludes(modelPath, [
      'multilingualSchema',
      `addSourceIdentityFields(${modelName}, '${modelName}')`
    ])

    if (!['posts', 'attachments'].includes(modelName)) {
      assertFileIncludes(modelPath, [`addRelationIdentityIndex(${modelName})`])
    }
  }

  assertFileIncludes(path.join(modelDir, 'posts.js'), [
    'addPostReviewFields(posts)',
    'addPostIndexes(posts)'
  ])
  assertFileNotIncludes(path.join(modelDir, 'users.js'), ['unique: true'])
  assertFileIncludes(path.join(modelDir, 'attachments.js'), [
    'addAttachmentMediaFields(attachments)',
    'addAttachmentIndexes(attachments)'
  ])

  for (const modelName of localLanguageModels) {
    const modelPath = path.join(modelDir, `${modelName}.js`)
    assertFileIncludes(modelPath, [
      'multilingualSchema',
      `addLocalLanguageFields(${modelName})`
    ])
  }

  assertFileIncludes(path.join(modelDir, 'options.js'), [
    'addOptionsLanguageFields(options)'
  ])
  assertFileNotIncludes(path.join(modelDir, 'albums.js'), ['unique: true'])
}

function validateNoSchemaErrorsPath() {
  const modelDir = path.join(rootDir, 'server', 'mongodb', 'models')
  const modelFiles = getFilesRecursively(modelDir)

  for (const modelPath of modelFiles) {
    const content = fs.readFileSync(modelPath, 'utf8')
    assert(
      !/\berrors\s*:/.test(content),
      `${modelPath} 禁止新增 errors schema path`
    )
  }
}

function validateAdminPathMigration() {
  const serverDir = path.join(rootDir, 'server')
  const adminDir = path.join(rootDir, 'admin')
  const appPath = path.join(serverDir, 'app.js')
  const blogNuxtConfigPath = path.join(rootDir, 'blog', 'nuxt.config.js')
  const viteConfigPath = path.join(adminDir, 'vite.config.js')
  const routerPath = path.join(adminDir, 'src', 'router', 'index.js')
  const apiPath = path.join(adminDir, 'src', 'api', 'index.js')
  const attachmentsDialogPath = path.join(
    adminDir,
    'src',
    'components',
    'AttachmentsDialog.vue'
  )
  const backupListPath = path.join(
    adminDir,
    'src',
    'views',
    'index',
    'backup',
    'BackupList.vue'
  )
  const rssRoutePath = path.join(serverDir, 'routes', 'multilingualRss.js')
  const blogRoutePath = path.join(serverDir, 'routes', 'blog.js')
  const sitemapPath = path.join(serverDir, 'utils', 'sitemap.js')

  assert(fs.existsSync(rssRoutePath), '缺少 server/routes/multilingualRss.js')
  assert(fs.existsSync(blogRoutePath), '缺少 server/routes/blog.js')
  assertFileIncludes(appPath, [
    "app.use('/api/multilingual-admin', multilingualAdminRouter)",
    "app.use('/api/multilingual-blog', multilingualBlogRouter)",
    "app.use('/:code/rss', multilingualRssRouter)",
    "app.get('/:code/sitemap.xml'",
    "'/multilingual-assets/upload'",
    "'/multilingual-assets/content'",
    "'../blog/public'",
    "firstLevelPath !== 'multilingual-admin'",
    "index: '/multilingual-admin/index.html'",
    "'/multilingual-admin'",
    "'front/multilingual-admin'"
  ])
  assertFileNotIncludes(appPath, [
    "app.use('/api/admin'",
    "app.use('/api/blog'",
    "app.use('/rss'",
    "app.use('/sitemap.xml'",
    "app.use('/admin'",
    "index: '/admin/index.html'",
    "'front/admin'"
  ])
  assertFileIncludes(rssRoutePath, [
    'normalizeLanguageCode',
    'application/rss+xml; charset=utf-8',
    'seo',
    'rss',
    'languageCode'
  ])
  assertFileIncludes(blogRoutePath, [
    'checkBlogLanguageEnabled',
    'isBlogLanguageEnabled',
    'getRequestLanguageCode',
    'res.status(404)'
  ])
  assertFileIncludes(sitemapPath, [
    'getLanguageSitemap',
    'normalizeLanguageCode',
    'application/xml; charset=utf-8',
    '/multilingual-assets/sitemap.xsl'
  ])
  assertFileIncludes(viteConfigPath, [
    "base: isProduction ? '/multilingual-admin/' : '/'",
    "outDir: '../server/front/multilingual-admin/'",
    "'/multilingual-assets'"
  ])
  assertFileNotIncludes(viteConfigPath, [
    "'/api/admin'",
    "'/upload'",
    "'/content/uploadfile'"
  ])
  assertFileIncludes(blogNuxtConfigPath, [
    "buildAssetsDir: '/_multilingual_nuxt/'",
    "localApiEndpoint: '/api/multilingual-icon'",
    'baseURL: MULTILINGUAL_PUBLIC_ASSET_BASE',
    "public: 'public-root'"
  ])
  assertFileIncludes(routerPath, ["createWebHistory('/multilingual-admin')"])
  assertFileIncludes(apiPath, [
    "baseURL: '/api/multilingual-admin'",
    'error?.response?.data?.errorList'
  ])
  assertFileIncludes(attachmentsDialogPath, [
    '/api/multilingual-admin/attachment/upload'
  ])
  assertFileIncludes(backupListPath, [
    '/api/multilingual-admin/backup/download'
  ])
  assertFileNotIncludes(attachmentsDialogPath, ['/api/admin'])
  assertFileNotIncludes(backupListPath, ['/api/admin'])
}

function validateMultilingualAdminConsoleSlice() {
  const adminDir = path.join(rootDir, 'admin')
  const indexPath = path.join(adminDir, 'src', 'views', 'index', 'Index.vue')
  const routerPath = path.join(adminDir, 'src', 'router', 'index.js')
  const apiIndexPath = path.join(adminDir, 'src', 'api', 'index.js')
  const apiModulePath = path.join(
    adminDir,
    'src',
    'api',
    'module',
    'multilingual.js'
  )
  const attachmentsDialogPath = path.join(
    adminDir,
    'src',
    'components',
    'AttachmentsDialog.vue'
  )
  const backupListPath = path.join(
    adminDir,
    'src',
    'views',
    'index',
    'backup',
    'BackupList.vue'
  )
  const pagePaths = [
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'dashboard',
      'MultilingualDashboard.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'source',
      'SourcePostImport.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'source',
      'SourcePostSnapshotList.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'translation',
      'TranslationPostList.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'relation',
      'RelationList.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'media',
      'MultilingualMediaList.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'config',
      'MultilingualConfig.vue'
    )
  ]
  const responsiveListPages = [
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'source',
      'SourcePostSnapshotList.vue'
    ),
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'translation',
      'TranslationPostList.vue'
    )
  ]

  assert(fs.existsSync(indexPath), '缺少 admin 菜单入口')
  assert(fs.existsSync(routerPath), '缺少 admin router')
  assert(fs.existsSync(apiModulePath), '缺少 multilingual admin API module')
  for (const pagePath of pagePaths) {
    assert(fs.existsSync(pagePath), `缺少第 9 切片页面: ${pagePath}`)
  }

  assertFileIncludes(indexPath, [
    '多语言管理后台',
    '源数据管理',
    '源文章导入',
    '源文章快照',
    '源关联内容',
    '源媒体快照',
    '多语言数据管理',
    '多语言文章',
    '关联内容',
    '媒体库',
    '导航',
    '横幅',
    '侧边栏',
    '多语言站点配置',
    '备份'
  ])
  assertFileNotIncludes(indexPath, [
    'CommentList',
    'ReaderlogList',
    'LinkList',
    'PostLikeLogList',
    'CommentLikeLogList',
    'EmailSendHistoryList',
    'UserList',
    '友链',
    '访客统计',
    '点赞统计',
    '评论统计',
    '邮件模板',
    '管理员列表'
  ])

  assertFileIncludes(routerPath, [
    'MultilingualDashboard',
    'SourcePostImport',
    'SourcePostSnapshotList',
    'SourceRelationList',
    'SourceMediaSnapshotList',
    'TranslationPostList',
    'RelationList',
    'MultilingualMediaList',
    'MultilingualConfig'
  ])
  assertFileIncludes(apiIndexPath, [
    "baseURL: '/api/multilingual-admin'",
    'multilingualApi'
  ])
  assertFileIncludes(apiModulePath, [
    '/source/post/import',
    '/source/post/overwrite',
    '/source/post/list',
    '/source/post/detail',
    '/settings/language/list',
    '/settings/language/update',
    '/translation/post/create',
    '/translation/post/list-by-source',
    '/translation/relation/update',
    '/media/replace-local',
    '/media/convert-remote'
  ])
  assertFileIncludes(
    path.join(adminDir, 'src', 'views', 'index', 'navi', 'NaviList.vue'),
    ['languageCode', 'SUPPORTED_LANGUAGE_OPTIONS']
  )
  assertFileIncludes(
    path.join(adminDir, 'src', 'views', 'index', 'banner', 'BannerList.vue'),
    ['languageCode', 'SUPPORTED_LANGUAGE_OPTIONS', 'getBannerList(params)']
  )
  assertFileIncludes(
    path.join(adminDir, 'src', 'views', 'index', 'sidebar', 'SidebarList.vue'),
    ['languageCode', 'SUPPORTED_LANGUAGE_OPTIONS', 'getSidebarList(params)']
  )
  assertFileIncludes(
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'config',
      'MultilingualConfig.vue'
    ),
    [
      'getLanguageSettings',
      'updateLanguageSettings',
      '保存当前语言',
      'defaultLanguageText',
      'blogLanguageEnabled',
      'NON_COPY_FIELD_NAMES',
      'sitePostRandomSimilarTitle'
    ]
  )
  assertFileNotIncludes(
    path.join(
      adminDir,
      'src',
      'views',
      'index',
      'config',
      'MultilingualConfig.vue'
    ),
    ['等待配置字段盘点确认后接入', '不保存任何配置']
  )

  for (const listPagePath of responsiveListPages) {
    assertFileIncludes(listPagePath, [
      'ResponsiveTable',
      'ResponsiveTableColumn'
    ])
    assertFileNotIncludes(listPagePath, ['<el-table', '<el-table-column'])
  }

  assertFileIncludes(attachmentsDialogPath, [
    '/api/multilingual-admin/attachment/upload'
  ])
  assertFileIncludes(backupListPath, [
    '/api/multilingual-admin/backup/download'
  ])
}

function validateSourcePostImportApi() {
  const serverDir = path.join(rootDir, 'server')
  const appPath = path.join(serverDir, 'app.js')
  const routePath = path.join(serverDir, 'routes', 'multilingualAdmin.js')
  const responsePath = path.join(
    serverDir,
    'utils',
    'multilingualAdminResponse.js'
  )
  const populatePath = path.join(serverDir, 'utils', 'sourcePostPopulate.js')
  const servicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'importPostSourceService.js'
  )
  const controllerDir = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'source',
    'post'
  )
  const controllerFiles = [
    'getSourcePostList.js',
    'importPost.js',
    'overwritePost.js',
    'getPostList.js',
    'getPostDetail.js'
  ]

  assert(fs.existsSync(routePath), '缺少 server/routes/multilingualAdmin.js')
  assert(
    fs.existsSync(responsePath),
    '缺少 multilingualAdminResponse sendError 工具'
  )
  assert(fs.existsSync(populatePath), '缺少 sourcePostPopulate 工具')
  assert(fs.existsSync(servicePath), '缺少 importPostSourceService')

  for (const controllerFile of controllerFiles) {
    const controllerPath = path.join(controllerDir, controllerFile)
    assert(
      fs.existsSync(controllerPath),
      `缺少 API controller: ${controllerFile}`
    )
    assertFileIncludes(controllerPath, ['handleApiError', 'res.send({ data })'])
  }

  assertFileIncludes(appPath, [
    "require('./routes/multilingualAdmin')",
    "app.use('/api/multilingual-admin', multilingualAdminRouter)"
  ])
  assertFileIncludes(routePath, [
    '/source/post/import',
    '/source/post/overwrite',
    '/source/post/source-list',
    '/source/post/list',
    '/source/post/detail',
    'checkAuth',
    'checkJWT',
    'global.$mongodDB.source.repositories.users.findOne',
    'sendError'
  ])
  assertFileIncludes(responsePath, [
    'sendError',
    'errorList',
    'LANGUAGE_CODE_UNSUPPORTED',
    'SOURCE_POST_ID_OR_ALIAS_REQUIRED',
    'SOURCE_ID_INVALID',
    'SOURCE_POST_NOT_FOUND',
    'SOURCE_EXISTS',
    'SOURCE_SNAPSHOT_NOT_FOUND'
  ])
  assertFileIncludes(populatePath, [
    'buildSourcePostPopulate',
    'author',
    'sort',
    'tags',
    'mappointList',
    'coverImages',
    'bangumiList',
    'movieList',
    'gameList',
    'bookList',
    'postList',
    'tweetList',
    'eventList',
    'voteList',
    'contentBangumiList',
    'contentMovieList',
    'contentGameList',
    'contentBookList',
    'contentPostList',
    'contentTweetList',
    'contentEventList',
    'contentVoteList'
  ])
  assertFileIncludes(servicePath, [
    'copySourceRecord',
    'createSourceHash',
    'overwrite',
    'sourceHash',
    'snapshotVersion++',
    'sourceSnapshotAt',
    'sourceUpdatedAt',
    'mediaMode',
    "data.mediaMode = 'remote'",
    'remoteSnapshot',
    'pendingReview',
    'sourceChanged',
    'sourceChangedAt',
    'getSourceDatabasePostList',
    "getSourceRepository('posts')",
    'sourcePostsRepository.find(',
    'global.$mongodDB.source.repositories.posts.findOne',
    'mongoose.Types.ObjectId.isValid',
    'normalizeLanguageCode'
  ])
  assertFileNotIncludes(servicePath, [
    'comments',
    'postLikeLogs',
    'commentLikeLogs',
    'npm install'
  ])

  validateSourceReadOnlyFiles()
  validateNoSchemaErrorsPath()
}

function validateMultilingualAdminApi() {
  const serverDir = path.join(rootDir, 'server')
  const appPath = path.join(serverDir, 'app.js')
  const routePath = path.join(serverDir, 'routes', 'multilingualAdmin.js')
  const responsePath = path.join(
    serverDir,
    'utils',
    'multilingualAdminResponse.js'
  )
  const loginPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'auth',
    'login.js'
  )
  const loginInfoPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'auth',
    'getLoginUserInfo.js'
  )
  const servicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'importPostSourceService.js'
  )
  const dashboardPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'dashboard',
    'getSummary.js'
  )
  const optionListPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'option',
    'getList.js'
  )
  const languageSettingsServicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'languageSettingsService.js'
  )
  const languageSettingsListPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'settings',
    'language',
    'getList.js'
  )
  const languageSettingsUpdatePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'settings',
    'language',
    'update.js'
  )
  const localContentControllerPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'localContentController.js'
  )

  assert(fs.existsSync(routePath), '缺少 server/routes/multilingualAdmin.js')
  assert(fs.existsSync(loginPath), '缺少 multilingual admin login API')
  assert(
    fs.existsSync(dashboardPath),
    '缺少 multilingual dashboard summary API'
  )
  assert(fs.existsSync(optionListPath), '缺少 multilingual option list API')
  assert(
    fs.existsSync(languageSettingsServicePath),
    '缺少 multilingual language settings service'
  )
  assert(
    fs.existsSync(languageSettingsListPath),
    '缺少 multilingual language settings list API'
  )
  assert(
    fs.existsSync(languageSettingsUpdatePath),
    '缺少 multilingual language settings update API'
  )
  assert(
    fs.existsSync(localContentControllerPath),
    '缺少 multilingual local content controller'
  )
  assert(
    fs.existsSync(loginInfoPath),
    '缺少 multilingual admin loginuserinfo API'
  )
  assertFileIncludes(appPath, [
    "app.use('/api/multilingual-admin', multilingualAdminRouter)"
  ])
  assertFileIncludes(routePath, [
    '/login',
    '/loginuserinfo',
    '/dashboard/summary',
    '/option/list',
    '/settings/language/list',
    '/settings/language/update',
    '/navi/list',
    '/navi/detail',
    '/navi/create',
    '/navi/update',
    '/navi/delete',
    '/banner/list',
    '/banner/create',
    '/banner/update',
    '/banner/delete',
    '/banner/update/taxis',
    '/sidebar/list',
    '/sidebar/create',
    '/sidebar/update',
    '/sidebar/delete',
    '/sidebar/update/taxis',
    '/referrer/list',
    '/backup/create',
    '/backup/list',
    '/backup/delete',
    '/backup/update',
    '/backup/mark/delete',
    '/backup/detail',
    '/backup/download',
    '/backup/download/token',
    '/backup/restore',
    '/backup/upload/create',
    '/backup/upload/chunk/list',
    '/backup/upload/chunk/:id/:chunkindex',
    '/backup/upload/merge',
    'checkAuth',
    'checkJWT',
    'global.$mongodDB.source.repositories.users.findOne',
    'decoded.data.pwversion',
    'admin.disabled',
    'sendError',
    '/source/post/import',
    '/source/post/overwrite',
    '/source/post/source-list',
    '/source/post/list',
    '/source/post/detail',
    '/translation/post/create',
    '/translation/post/list-by-source',
    '/translation/post/detail',
    '/translation/post/update',
    '/translation/relation/update',
    '/translation/relation/list',
    '/media/list',
    '/media/replace-local',
    '/media/convert-remote'
  ])
  assertFileNotIncludes(routePath, [
    '/readerlog/list',
    '/readerlog/stats',
    '/readerlog/delete'
  ])
  assertFileIncludes(loginPath, [
    'global.$mongodDB.source.repositories.users.findOne',
    'global.$mongodDB.multilingual.repositories.userLoginLogs.model',
    'utils.checkBcryptStr',
    'utils.creatJWT',
    'pwversion',
    'version: 1',
    'Number(user.role) >= 990',
    'sendError'
  ])
  assertFileIncludes(loginInfoPath, ['req.admin', 'nickname', 'role'])
  assertFileIncludes(dashboardPath, [
    'sourceSnapshotTotal',
    'pendingReviewTotal',
    'localMediaTotal',
    'languageStats',
    'recentImports'
  ])
  assertFileIncludes(optionListPath, [
    'global.$mongodDB.multilingual.repositories.options',
    "scope: 'multilingual'",
    'languageCode',
    'nameList'
  ])
  assertFileIncludes(languageSettingsServicePath, [
    'LANGUAGE_SETTING_FIELDS',
    'blogLanguageEnabled',
    'isBlogLanguageEnabled',
    'siteTitle',
    'sitePostRandomSimilarTitle',
    'scope: OPTION_SCOPE',
    'normalizeLanguageCode',
    'SETTINGS_FIELD_INVALID',
    'findOneAndUpdate'
  ])
  assertFileIncludes(languageSettingsListPath, [
    'getLanguageSettingsList',
    'res.send({ data })'
  ])
  assertFileIncludes(languageSettingsUpdatePath, [
    'updateLanguageSettings',
    'req.body',
    'res.send({ data })'
  ])
  assertFileIncludes(localContentControllerPath, [
    'getNaviList',
    'createNavi',
    'getBannerList',
    'updateBannerTaxis',
    'getSidebarList',
    'updateSidebarTaxis',
    'languageCode',
    'recordKind: RECORD_KIND',
    'refreshCache'
  ])
  assertFileNotIncludes(loginPath, [
    'userUtils.updateOne',
    'global.$mongodDB.source.repositories.users.update'
  ])
  assertFileIncludes(responsePath, [
    'errorList',
    'code',
    'message',
    'field',
    'TRANSLATION_EXISTS',
    'ALIAS_CONFLICT_IN_LANGUAGE',
    'LANGUAGE_CODE_UNSUPPORTED',
    'SOURCE_SNAPSHOT_NOT_FOUND',
    'RELATION_LANGUAGE_MISMATCH',
    'MEDIA_MODE_INVALID',
    'SETTINGS_FIELD_INVALID',
    'SETTINGS_VALUES_INVALID',
    'CONTENT_ID_INVALID',
    'CONTENT_FIELD_INVALID',
    'CONTENT_NOT_FOUND',
    'CONFIRM_TEXT_REQUIRED',
    'LOCAL_FILE_DELETE_FAILED'
  ])
  assertFileIncludes(servicePath, [
    'getSourcePostList',
    'getSourcePostDetail',
    'translationSummary',
    'orphanRelations',
    'orphanMedia',
    'SOURCE_SNAPSHOT_NOT_FOUND'
  ])
  assertFileNotIncludes(routePath, [
    '{ errors',
    'comments',
    'postLikeLogs',
    'commentLikeLogs'
  ])
  assertFileNotIncludes(servicePath, [
    'deleteOne(',
    'deleteMany(',
    'comments',
    'postLikeLogs',
    'commentLikeLogs'
  ])

  validateNoSchemaErrorsPath()
  validateAdminPathMigration()
  validateMultilingualAdminConsoleSlice()
}

function validateTranslationPostApi() {
  const serverDir = path.join(rootDir, 'server')
  const routePath = path.join(serverDir, 'routes', 'multilingualAdmin.js')
  const responsePath = path.join(
    serverDir,
    'utils',
    'multilingualAdminResponse.js'
  )
  const servicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'translationPostService.js'
  )
  const relationServicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'relationService.js'
  )
  const mediaServicePath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'services',
    'mediaService.js'
  )
  const controllerDir = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'translation',
    'post'
  )
  const controllerFiles = [
    'createPost.js',
    'getPostListBySource.js',
    'getPostDetail.js',
    'updatePost.js'
  ]
  const relationControllerPath = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'translation',
    'relation',
    'update.js'
  )
  const mediaControllerDir = path.join(
    serverDir,
    'api',
    'multilingual-admin',
    'media'
  )

  assert(fs.existsSync(routePath), '缺少 server/routes/multilingualAdmin.js')
  assert(fs.existsSync(servicePath), '缺少 translationPostService')
  assert(fs.existsSync(relationServicePath), '缺少 relationService')
  assert(fs.existsSync(mediaServicePath), '缺少 mediaService')

  for (const controllerFile of controllerFiles) {
    const controllerPath = path.join(controllerDir, controllerFile)
    assert(
      fs.existsSync(controllerPath),
      `缺少翻译文章 API controller: ${controllerFile}`
    )
    assertFileIncludes(controllerPath, [
      'translationPostService',
      'handleApiError',
      'res.send({ data })'
    ])
  }
  assert(
    fs.existsSync(relationControllerPath),
    '缺少 translation relation update controller'
  )
  assertFileIncludes(relationControllerPath, [
    'relationService',
    'handleApiError',
    'res.send({ data })'
  ])
  for (const controllerFile of ['replaceLocal.js', 'convertRemote.js']) {
    const controllerPath = path.join(mediaControllerDir, controllerFile)
    assert(
      fs.existsSync(controllerPath),
      `缺少媒体 API controller: ${controllerFile}`
    )
    assertFileIncludes(controllerPath, [
      'mediaService',
      'handleApiError',
      'res.send({ data })'
    ])
  }

  assertFileIncludes(routePath, [
    '/translation/post/create',
    '/translation/post/list-by-source',
    '/translation/post/detail',
    '/translation/post/update',
    '/translation/relation/update',
    '/media/replace-local',
    '/media/convert-remote',
    'multer.memoryStorage()',
    "upload.single('file')",
    'checkAuth'
  ])
  assertFileIncludes(responsePath, [
    'errorList',
    'TRANSLATION_EXISTS',
    'ALIAS_CONFLICT_IN_LANGUAGE',
    'LANGUAGE_CODE_UNSUPPORTED',
    'SOURCE_SNAPSHOT_NOT_FOUND',
    'RELATION_LANGUAGE_MISMATCH',
    'MEDIA_MODE_INVALID',
    'CONFIRM_TEXT_REQUIRED',
    'LOCAL_FILE_DELETE_FAILED'
  ])
  assertFileIncludes(servicePath, [
    'createTranslationPost',
    'getTranslationPostListBySource',
    'getTranslationPostDetail',
    'updateTranslationPost',
    'findExistingTranslationRecord',
    'copyRelationToLanguage',
    'copyMode',
    "copyMode !== 'source'",
    'sourceSnapshotId',
    'SOURCE_RECORD_KIND',
    'TRANSLATION_RECORD_KIND',
    'recordKind: SOURCE_RECORD_KIND',
    'recordKind: TRANSLATION_RECORD_KIND',
    'translationGroupId',
    'AUTHOR_SNAPSHOT_PASSWORD',
    'data.username = `source:${String(sourceId)}:${context.languageCode}`',
    'data.password = AUTHOR_SNAPSHOT_PASSWORD',
    'data.role = 0',
    'data.disabled = true',
    'TRANSLATION_EXISTS',
    'ALIAS_CONFLICT_IN_LANGUAGE',
    'LANGUAGE_CODE_UNSUPPORTED',
    'SOURCE_SNAPSHOT_NOT_FOUND',
    'status: { $ne: 99 }',
    'SUPPORTED_LANGUAGE_CODES',
    'buildEmptyTranslationMatrix',
    '_id title alias type languageCode translationGroupId status',
    'POST_SINGLE_RELATION_COLLECTIONS',
    'POST_ARRAY_RELATION_COLLECTIONS',
    'copyPostRelations',
    "data.mediaMode = 'remote'",
    "mediaMode: 'remote'",
    'remoteSnapshot',
    'data.views = 0',
    'data.likes = 0',
    'data.shares = 0',
    'data.comnum = 0',
    'data.status = 0',
    'confirmReview === true',
    'updateData.sourceChanged = false',
    'updateData.pendingReview = false',
    'updateData.sourceChangedAt = null'
  ])
  assertFileIncludes(relationServicePath, [
    'updateRelation',
    'ALLOWED_COLLECTION_NAMES',
    'users',
    'sorts',
    'tags',
    'mappoints',
    'bangumis',
    'movies',
    'games',
    'gamePlatforms',
    'books',
    'booktypes',
    'events',
    'eventtypes',
    'votes',
    'attachments',
    'SYSTEM_FIELDS',
    'mediaMode',
    'remoteSnapshot',
    'localFilepath',
    'localThumbnailPath',
    'localStorageStatus',
    'record.languageCode !== input.languageCode',
    'RELATION_LANGUAGE_MISMATCH',
    'recordKind: TRANSLATION_RECORD_KIND',
    'schema.path(field)'
  ])
  assertFileIncludes(mediaServicePath, [
    'replaceLocalAttachment',
    'convertLocalAttachmentToRemote',
    'DELETE_LOCAL_FILE_CONFIRM_TEXT',
    'DELETE_LOCAL_FILE',
    'confirmText',
    'CONFIRM_TEXT_REQUIRED',
    'MEDIA_MODE_INVALID',
    'LOCAL_FILE_DELETE_FAILED',
    'RELATION_LANGUAGE_MISMATCH',
    "mediaMode: 'local'",
    "mediaMode: 'remote'",
    "localStorageStatus: 'stored'",
    "localStorageStatus: 'none'",
    'remoteSnapshot',
    'remoteFilepath',
    'global.$mongodDB.source.repositories.options',
    'normalizeStoredContentPath',
    'safeDeleteContentFiles',
    'path.relative(CONTENT_ROOT, filePath)',
    'fs.promises.unlink',
    'utils.imageMetadata',
    'utils.imageCompress'
  ])
  assertFileNotIncludes(servicePath, [
    'global.$mongodDB.source',
    'deleteOne(',
    'deleteMany(',
    'comments',
    'postLikeLogs',
    'commentLikeLogs',
    'npm install'
  ])
  assertFileNotIncludes(relationServicePath, [
    'comments',
    'postLikeLogs',
    'commentLikeLogs',
    'npm install'
  ])
  assertFileNotIncludes(mediaServicePath, [
    'deleteOne(',
    'deleteMany(',
    'comments',
    'postLikeLogs',
    'commentLikeLogs',
    'npm install'
  ])

  validateNoSchemaErrorsPath()
}

function validateBlogApiSplit() {
  const blogApiDir = path.join(rootDir, 'blog', 'app', 'api')
  const sourcePath = path.join(blogApiDir, 'source.js')
  const multilingualPath = path.join(blogApiDir, 'multilingual.js')
  const indexPath = path.join(blogApiDir, 'index.js')
  const sourceProxyPath = path.join(
    rootDir,
    'blog',
    'server',
    'routes',
    'api',
    'source-blog',
    '[...].js'
  )
  const oldSourceProxyPath = path.join(
    rootDir,
    'blog',
    'server',
    'routes',
    'api',
    'blog',
    '[...].js'
  )

  assert(fs.existsSync(sourcePath), '缺少 blog/app/api/source.js')
  assert(fs.existsSync(multilingualPath), '缺少 blog/app/api/multilingual.js')
  assert(fs.existsSync(indexPath), '缺少 blog/app/api/index.js')
  assert(
    fs.existsSync(sourceProxyPath),
    '缺少 /api/source-blog Nuxt 代理 route'
  )
  assert(
    !fs.existsSync(oldSourceProxyPath),
    '禁止保留 /api/blog Nuxt 代理 route'
  )
  assertFileIncludes(sourceProxyPath, ['sourceApiDomain', "'/api/blog'"])

  const sourceContent = stripJavaScriptComments(
    fs.readFileSync(sourcePath, 'utf8')
  )
  const multilingualContent = stripJavaScriptComments(
    fs.readFileSync(multilingualPath, 'utf8')
  )
  const indexContent = stripJavaScriptComments(
    fs.readFileSync(indexPath, 'utf8')
  )

  assert(
    !/BASE_URL\s*=\s*['"]\/api\/blog['"]/.test(indexContent),
    'blog/app/api/index.js 禁止保留单一 BASE_URL=/api/blog'
  )
  assert(
    indexContent.includes('sourceRequest') &&
      indexContent.includes('multilingualRequest'),
    'blog/app/api/index.js 必须按接口归属转发到 source 或 multilingual'
  )

  assert(
    sourceContent.includes("'/api/source-blog'"),
    'source.js 必须使用 /api/source-blog'
  )
  assert(
    !sourceContent.includes("'/api/blog'"),
    'source.js 禁止直接请求 /api/blog，需通过 /api/source-blog 代理'
  )
  assert(
    !sourceContent.includes('languageCode'),
    'source.js 禁止自动写入 languageCode'
  )
  assert(
    !sourceContent.includes('/api/multilingual-blog'),
    'source.js 禁止请求 /api/multilingual-blog'
  )
  assert(
    !multilingualContent.includes("'/options'"),
    'multilingual.js 禁止接管 /options，非多语言配置必须走 /api/source-blog'
  )

  assert(
    multilingualContent.includes("'/api/multilingual-blog'"),
    'multilingual.js 必须使用 /api/multilingual-blog'
  )
  assert(
    !multilingualContent.includes("'/api/blog'"),
    'multilingual.js 禁止请求 /api/blog'
  )
  assertFileIncludes(multilingualPath, [
    'normalizeLanguageCode',
    'params.languageCode',
    'body.languageCode',
    "method === 'GET' || method === 'DELETE'",
    "method === 'POST' || method === 'PUT'"
  ])

  assertFileIncludes(sourcePath, [
    "'/options'",
    "'/comment/'",
    "'/post/view/count'",
    "'/post/share/count'",
    "'/post/like/log'",
    "'/post/like/log/list'",
    "'/comment/like/log'",
    "'/comment/like/log/list'",
    "'/log/create'",
    "'/log/update/performance'",
    "'/link/list'"
  ])

  assertFileIncludes(multilingualPath, [
    "'/post/list'",
    "'/post/archive'",
    "'/post/detail'",
    "'/sort/'",
    "'/tag/'",
    "'/mappoint/'",
    "'/bangumi/'",
    "'/movie/'",
    "'/game/'",
    "'/book/'",
    "'/booktype/'",
    "'/event/'",
    "'/vote'",
    "'/vote/'",
    "'/attachment/'",
    "'/navi/'",
    "'/banner/'",
    "'/sidebar/'",
    "'/trend/'"
  ])
}

function validateBlogLanguageSeo() {
  const blogAppDir = path.join(rootDir, 'blog', 'app')
  const pageDir = path.join(blogAppDir, 'pages', '[[code]]')
  const appPath = path.join(blogAppDir, 'app.vue')
  const layoutPath = path.join(blogAppDir, 'layouts', 'default.vue')
  const naviItemPath = path.join(blogAppDir, 'components', 'NaviItem.vue')
  const useLangPath = path.join(blogAppDir, 'composables', 'useLang.js')
  const usePostSeoPath = path.join(blogAppDir, 'composables', 'usePostSeo.js')

  assert(fs.existsSync(pageDir), '缺少 blog/app/pages/[[code]]')

  const pageFiles = getFilesRecursively(pageDir, ['.vue'])
  assert(pageFiles.length > 0, 'blog/app/pages/[[code]] 下缺少页面')

  for (const filePath of pageFiles) {
    const content = fs.readFileSync(filePath, 'utf8')
    assert(
      content.includes('useLang()'),
      `${filePath} 必须在 setup 中调用 useLang()`
    )
    assert(
      content.includes('languageCode.value'),
      `${filePath} 必须在 setup 开头触发 code 校验`
    )
  }

  assertFileIncludes(appPath, [
    'normalizeLanguageCode',
    'currentLanguageCode',
    'lang: currentLanguageCode.value',
    '`${siteUrl}/${languageCode}/rss`',
    '`${siteUrl}/${languageCode}/rss/blog`',
    '`${siteUrl}/${languageCode}/rss/tweet`'
  ])
  assertFileNotIncludes(appPath, [
    "lang: 'zh-hans'",
    "'/rss'",
    "'/rss/blog'",
    "'/rss/tweet'"
  ])

  assertFileIncludes(useLangPath, [
    'assertLanguageCode(routeCode)',
    'languageCode.value',
    'export function buildLanguagePath',
    'localePath',
    'localeUrl'
  ])
  assertFileIncludes(usePostSeoPath, [
    'normalizeLanguageCode',
    'getCanonicalPath(route.path)'
  ])
  assertFileIncludes(layoutPath, [
    ':to="homePath"',
    'localePath(`/post/list/keyword/${keywordValue}/1`)',
    "localeUrl(options.siteUrl, '/sitemap.xml')",
    "localeUrl(options.siteUrl, '/rss')",
    "localeUrl(options.siteUrl, '/rss/blog')",
    "localeUrl(options.siteUrl, '/rss/tweet')",
    "t('common.footer.sitemap')",
    'getSidebarBuiltinTitle'
  ])
  assertFileNotIncludes(layoutPath, ['SIDEBAR_BUILTIN_TITLE_MAP'])
  assertFileIncludes(naviItemPath, ['getItemUrl(item)', 'localePath(item.url)'])

  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    const commonPath = path.join(blogAppDir, 'lang', languageCode, 'common.js')
    assertFileIncludes(commonPath, [
      'navigation:',
      'sidebarBuiltinTitles:',
      'search:',
      'footer:',
      'rssSubscribe'
    ])
  }
}

function validateBlogRssSitemapRoutes() {
  const serverDir = path.join(rootDir, 'server')
  const blogServerDir = path.join(rootDir, 'blog', 'server')
  const rssPath = path.join(serverDir, 'utils', 'rss.js')
  const sitemapPath = path.join(serverDir, 'utils', 'sitemap.js')
  const mongodbIndexPath = path.join(serverDir, 'mongodb', 'index.js')
  const multilingualRssRoutePath = path.join(
    serverDir,
    'routes',
    'multilingualRss.js'
  )
  const languageSeoPath = path.join(blogServerDir, 'utils', 'languageSeo.js')
  const routePaths = [
    path.join(blogServerDir, 'routes', '[code]', 'rss.js'),
    path.join(blogServerDir, 'routes', '[code]', 'rss', 'blog.js'),
    path.join(blogServerDir, 'routes', '[code]', 'rss', 'tweet.js'),
    path.join(blogServerDir, 'routes', '[code]', 'sitemap.xml.js')
  ]
  const rootRoutePaths = [
    path.join(blogServerDir, 'routes', 'rss.js'),
    path.join(blogServerDir, 'routes', 'rss', 'blog.js'),
    path.join(blogServerDir, 'routes', 'rss', 'tweet.js'),
    path.join(blogServerDir, 'routes', 'sitemap.xml.js')
  ]

  assertFileIncludes(rssPath, [
    'SUPPORTED_LANGUAGE_CODES',
    'reflushLanguageRSS',
    'languageCode,',
    "recordKind: 'translation'",
    '`${siteUrl}/${languageCode}/rss`',
    '`${siteUrl}/${languageCode}/rss/blog`',
    '`${siteUrl}/${languageCode}/rss/tweet`',
    'path.join(rssCacheFolder, languageCode)',
    'getPostUrl(siteUrl, languageCode, item)'
  ])
  assertFileIncludes(sitemapPath, [
    'SUPPORTED_LANGUAGE_CODES',
    'updateLanguageSitemap',
    'reflushLanguageSitemap',
    "recordKind: 'translation'",
    '`/${languageCode}/${pathType}/${post.alias || post._id}`',
    'path.join(sitemapCacheFolder, languageCode)',
    '`/${languageCode}`'
  ])
  assertFileIncludes(multilingualRssRoutePath, [
    'normalizeLanguageCode(req.params.code)',
    'RSS_TYPE_FILE_MAP',
    'languageCode,'
  ])
  assertFileIncludes(mongodbIndexPath, [
    'await rssToolUtils.reflushRSS()',
    'await sitemapToolUtils.reflushSitemap()',
    'global.$isReady = true'
  ])
  assertFileIncludes(languageSeoPath, [
    '#shared/languages',
    'LANGUAGE_CONFIG_LIST',
    'getCanonicalLanguageCode',
    'getCanonicalRequestUrl',
    'proxyLanguageSeoRequest',
    "getRouterParam(event, 'code')"
  ])
  assertFileNotIncludes(languageSeoPath, [
    "'zh-CN'",
    "'zh-HK'",
    "'zh-TW'",
    "'zh-SG'",
    "'ja-JP'",
    "'en-US'"
  ])

  for (const routePath of routePaths) {
    assert(fs.existsSync(routePath), `${routePath} 不存在`)
    assertFileIncludes(routePath, ['proxyLanguageSeoRequest'])
  }

  for (const routePath of rootRoutePaths) {
    assert(
      !fs.existsSync(routePath),
      `${routePath} 禁止保留根级 RSS/Sitemap 路由`
    )
  }
}

function validateBlogCacheAndVisitorStats() {
  const serverDir = path.join(rootDir, 'server')
  const cacheDataPath = path.join(serverDir, 'config', 'cacheData.js')
  const readerlogsModelPath = path.join(
    serverDir,
    'mongodb',
    'models',
    'readerlogs.js'
  )
  const mongodbIndexPath = path.join(serverDir, 'mongodb', 'index.js')
  const blogRoutePath = path.join(serverDir, 'routes', 'blog.js')
  const trendPath = path.join(
    serverDir,
    'api',
    'blog',
    'trend',
    'getTrendPostList.js'
  )
  const randomTagPath = path.join(
    serverDir,
    'api',
    'blog',
    'tag',
    'getRandomTagList.js'
  )
  const postListPath = path.join(
    serverDir,
    'api',
    'blog',
    'post',
    'getPostList.js'
  )
  const postDetailPath = path.join(
    serverDir,
    'api',
    'blog',
    'post',
    'getPostDetail.js'
  )
  const removedVisitorWriteControllerPaths = [
    path.join(serverDir, 'api', 'blog', 'log', 'createLog.js'),
    path.join(
      serverDir,
      'api',
      'blog',
      'log',
      'updateLogPerformanceNavigationTiming.js'
    ),
    path.join(serverDir, 'api', 'blog', 'post', 'updatePostViewCount.js')
  ]

  assertFileIncludes(cacheDataPath, [
    'SUPPORTED_LANGUAGE_CODES',
    'global.$cacheData.byLanguage',
    'exports.getRequestLanguageCode',
    'exports.getLanguageCache',
    'exports.getTranslationParams',
    "recordKind: 'translation'",
    'languageCache.naviList',
    'languageCache.sidebarList',
    'languageCache.bannerList',
    'languageCache.sortList',
    'languageCache.postArchiveList',
    'exports.refreshAllLanguageCache'
  ])
  assertFileNotIncludes(cacheDataPath, [
    'global.$cacheData.naviList',
    'global.$cacheData.sidebarList',
    'global.$cacheData.bannerList',
    'global.$cacheData.sortList',
    'global.$cacheData.postArchiveList',
    'this.getCommentList()'
  ])

  assertFileIncludes(readerlogsModelPath, [
    'SUPPORTED_LANGUAGE_CODES',
    'languageCode:',
    'routeOwnership:',
    "enum: ['multilingual-blog']"
  ])
  assertFileIncludes(mongodbIndexPath, [
    'await cacheDataUtils.refreshAllLanguageCache()'
  ])

  for (const removedPath of removedVisitorWriteControllerPaths) {
    assert(!fs.existsSync(removedPath), `${removedPath} 必须删除`)
  }

  assertFileIncludes(trendPath, [
    'cacheDataUtils.getRequestLanguageCode(req)',
    'languageCache.trendPostListData',
    'global.$mongodDB?.source?.repositories?.readerlogs',
    'sourceId',
    "action: 'postView'",
    "recordKind: 'translation'"
  ])
  assertFileNotIncludes(trendPath, [
    "from: 'comments'",
    'postShare',
    'postLike',
    'postDislike'
  ])
  assertFileIncludes(randomTagPath, [
    'cacheDataUtils.getRequestLanguageCode(req)',
    'languageCache.randomTagListData',
    'cacheDataUtils.getTranslationParams(languageCode)',
    "recordKind: 'translation'"
  ])
  assertFileIncludes(postListPath, [
    'cacheDataUtils.getRequestLanguageCode(req)',
    'languageCode,',
    "recordKind: 'translation'",
    'languageCache?.sortList'
  ])
  assertFileIncludes(postDetailPath, [
    'cacheDataUtils.getRequestLanguageCode(req)',
    'languageCode,',
    "recordKind: 'translation'",
    'languageCache?.sortList'
  ])

  assertFileNotIncludes(blogRoutePath, [
    "path: '/comment/",
    "path: '/post/view/count'",
    "path: '/post/share/count'",
    "path: '/post/like/log'",
    "path: '/comment/like/log'",
    "path: '/log/create'",
    "path: '/log/update/performance'",
    "path: '/link/list'"
  ])
}

const validateScopes = {
  foundation() {
    validateLanguageCodeRules()
    validateBlogLanguageEntry()
    validateDualMongoFoundation()
    validateMultilingualBackupScope()
    validateAdminPathMigration()
  },
  models() {
    validateModelSchemaFields()
  },
  import() {
    validateSourcePostImportApi()
  },
  translation() {
    validateTranslationPostApi()
  },
  adminApi() {
    validateMultilingualAdminApi()
  },
  blog() {
    validateBlogApiSplit()
    validateBlogLanguageSeo()
    validateBlogRssSitemapRoutes()
    validateBlogCacheAndVisitorStats()
  }
}

// 获取命令行参数
const args = process.argv.slice(2)

if (args.length === 1 && validateScopes[args[0]]) {
  try {
    validateScopes[args[0]]()
    console.log(`validate:${args[0]} 通过`)
  } catch (error) {
    console.log(`validate:${args[0]} 失败: ${error.message}`)
    process.exit(1)
  }

  process.exit(0)
}

if (args.length < 2) {
  console.log('用法: node validator-tool.js <方法名> <值> [额外参数...]')
  console.log('验证: node validator-tool.js foundation')
  console.log('例如: node validator-tool.js isEmail test@example.com')
  console.log('例如: node validator-tool.js isURL http://example.com')
  console.log(
    '支持的方法: isEmail, isURL, isIP, isUUID, isMobilePhone, 等validator.js的所有方法'
  )
  process.exit(1)
}

const methodName = args[0]
const value = args[1]
const extraArgs = args.slice(2)
const validator = require('validator')

// 检查方法是否存在
if (typeof validator[methodName] !== 'function') {
  console.log(`错误: 方法 '${methodName}' 不存在于validator.js中`)
  process.exit(1)
}

try {
  // 调用validator方法
  const result = validator[methodName](value, ...extraArgs)
  console.log(
    `validator.${methodName}('${value}'${
      extraArgs.length ? ', ' + extraArgs.join(', ') : ''
    }) => ${result}`
  )
} catch (error) {
  console.log(`错误: ${error.message}`)
  process.exit(1)
}
