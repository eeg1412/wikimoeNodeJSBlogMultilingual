const fs = require('fs')
const path = require('path')
const {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODE_MAP,
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

function validateLanguageCodeRules() {
  assert(DEFAULT_LANGUAGE_CODE === 'zh-CN', '默认语言必须是 zh-CN')
  assert(SUPPORTED_LANGUAGE_CODES.length === 6, '必须支持 6 个语言 code')

  const expectedCodes = ['zh-CN', 'zh-HK', 'zh-TW', 'zh-SG', 'ja-JP', 'en-US']
  for (const code of expectedCodes) {
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
  assert(normalizeLanguageCode('fr-FR') === null, '不支持语言必须返回 null')
  assert(normalizeLanguageCode('') === null, '空字符串必须返回 null')
}

function validateBlogLanguageEntry() {
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

  assert(fs.existsSync(blogLangIndexPath), '缺少 blog/app/lang/index.js')
  assert(fs.existsSync(useLangPath), '缺少 blog/app/composables/useLang.js')
  assertFileIncludes(blogLangIndexPath, [
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

  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const commonPath = path.join(
      rootDir,
      'blog',
      'app',
      'lang',
      code,
      'common.js'
    )
    assert(
      fs.existsSync(commonPath),
      `缺少语言包: blog/app/lang/${code}/common.js`
    )
  }
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
  const sitemapPath = path.join(serverDir, 'utils', 'sitemap.js')

  assert(fs.existsSync(rssRoutePath), '缺少 server/routes/multilingualRss.js')
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
    '备份',
    '访客统计'
  ])
  assertFileNotIncludes(indexPath, [
    'CommentList',
    'LinkList',
    'PostLikeLogList',
    'CommentLikeLogList',
    'EmailSendHistoryList',
    'UserList',
    '友链',
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
      '复制简体中文',
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
    '/readerlog/list',
    '/readerlog/stats',
    '/readerlog/delete',
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
    "'/post/share/count'",
    "'/post/like/log'",
    "'/post/like/log/list'",
    "'/comment/like/log'",
    "'/comment/like/log/list'",
    "'/link/list'"
  ])

  assertFileIncludes(multilingualPath, [
    "'/post/list'",
    "'/post/archive'",
    "'/post/detail'",
    "'/post/view/count'",
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
    "'/trend/'",
    "'/log/create'",
    "'/log/update/performance'"
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
    'assertLanguageCode(getRouteCode(route))',
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
    "t('common.footer.sitemap')"
  ])
  assertFileIncludes(naviItemPath, ['getItemUrl(item)', 'localePath(item.url)'])

  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    const commonPath = path.join(blogAppDir, 'lang', languageCode, 'common.js')
    assertFileIncludes(commonPath, [
      'navigation:',
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
    '`/${languageCode}/index/${pathType}/${post.alias || post._id}`',
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
    'getCanonicalLanguageCode',
    'getCanonicalRequestUrl',
    'proxyLanguageSeoRequest',
    "getRouterParam(event, 'code')"
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
  const createLogPath = path.join(
    serverDir,
    'api',
    'blog',
    'log',
    'createLog.js'
  )
  const updateLogPath = path.join(
    serverDir,
    'api',
    'blog',
    'log',
    'updateLogPerformanceNavigationTiming.js'
  )
  const updateViewPath = path.join(
    serverDir,
    'api',
    'blog',
    'post',
    'updatePostViewCount.js'
  )
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

  assertFileIncludes(createLogPath, [
    'normalizeLanguageCode(req.body.languageCode)',
    "const ROUTE_OWNERSHIP = 'multilingual-blog'",
    'languageCode,',
    'routeOwnership: ROUTE_OWNERSHIP'
  ])
  assertFileIncludes(updateLogPath, [
    'normalizeLanguageCode(req.body.languageCode)',
    'languageCode,',
    'routeOwnership: ROUTE_OWNERSHIP'
  ])
  assertFileIncludes(updateViewPath, [
    'normalizeLanguageCode(req.body.languageCode)',
    'languageCode,',
    'routeOwnership: ROUTE_OWNERSHIP',
    "recordKind: 'translation'"
  ])
  assertFileIncludes(trendPath, [
    'cacheDataUtils.getRequestLanguageCode(req)',
    'languageCache.trendPostListData',
    "routeOwnership: 'multilingual-blog'",
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
    "path: '/post/share/count'",
    "path: '/post/like/log'",
    "path: '/comment/like/log'",
    "path: '/link/list'"
  ])
}

const validateScopes = {
  foundation() {
    validateLanguageCodeRules()
    validateBlogLanguageEntry()
    validateDualMongoFoundation()
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
