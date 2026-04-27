# Wikimoe 多语言附属程序产品计划书

> 目标仓库：wikimoeNodeJSBlogMultilingual  
> 源仓库：wikimoeNodeJSBlog  
> 当前日期：2026年4月27日

## 0. 执行原则

这份计划书面向接下来由 AI 无人值守完成的实现过程。后续任务按可验证的产品模块推进；每个模块完成后立刻验证，直到形成一款可上线使用的多语言附属产品。

已确认的关键设计：

- 多语言程序未来与 wikimoeNodeJSBlog 共用同一个域名，通过 `/:code` 区分语言版本。
- 根路径 `/` 由源站处理，多语言端只处理 `/:code` 及其子路径。
- 第一版支持 `zh-CN`、`zh-HK`、`zh-TW`、`zh-SG`、`ja-JP`、`en-US`。
- URL 语言 code 匹配不区分大小写，内部统一归一化为 canonical code，例如 `/zh-cn` 与 `/zh-CN` 都对应 `zh-CN`。
- Sitemap 和 RSS 必须按语言 code 分别生成；Sitemap 公开路径为 `/:code/sitemap.xml`，RSS 公开路径保留源站三种形态：`/:code/rss`、`/:code/rss/blog`、`/:code/rss/tweet`，输出链接使用 canonical code。
- 评论不按语言拆分，blog 端直接使用源博客 wikimoeNodeJSBlog 的评论接口；多语言 server 不反代、不落库、多语言后台不管理评论。
- 点赞不按语言拆分，blog 端直接使用源博客 wikimoeNodeJSBlog 的点赞接口；多语言 server 不反代、不落库、多语言后台不管理点赞统计。
- 因未来同域名部署，所有源站已完全接管的接口由前端直接请求源站接口，不再通过多语言 server 反代。
- `DB_HOST` 仅用于只读访问源站数据库，禁止多语言程序对 `DB_HOST` 执行任何写入、更新、删除、索引变更或维护操作。
- 管理员认证使用源站数据库的账号密码，但多语言站自行签发多语言站 token。
- 作者不是登录角色，而是文章内容中的可翻译实体；创建多语言文章时需要创建对应语言的作者信息。
- 覆盖源快照不是同步，不删除旧关联数据和旧媒体；旧关联内容、旧媒体进入专门管理页面处理。

## 1. 源项目功能盘点

| 功能域                       | 源项目关键路径                                                                                                     | 多语言影响点                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 管理后台菜单与路由           | `admin/src/router/index.js`、`admin/src/views/index/Index.vue`                                                     | 当前菜单按单站博客组织：面板、分类、标签、地点、媒体库、文章、评论、友链、导航、侧边栏、横幅、番剧、电影、游戏、书籍、活动、投票、日志、管理员、备份、设置。多语言版需要改为源数据管理和多语言数据管理，后台访问路径也要避开源站 `/admin`。评论、点赞完全由源站接管，不进入多语言后台菜单和统计。                 |
| 管理端列表与编辑器           | `admin/src/views/index/post/PostList.vue`、`PostEditor.vue`，各实体 List/Editor                                    | 文章列表要以源文章快照为主，子表格展示各语言版本；编辑器要保留普通文章编辑体验，并加入关联内容快捷编辑弹窗。                                                                                                                                                                                                      |
| 管理端配置                   | `admin/src/views/index/config/Config.vue`、`admin/src/components/Config*.vue`                                      | 当前配置覆盖站点、文章页、评论、RSS、媒体、地图、邮件、广告、IP 黑名单、其他。多语言版只保留语言相关配置，并为这些配置加二级语言 tab。非语言配置不在多语言后台维护，博客端直接调用源站接口获取。                                                                                                                  |
| 管理端权限/账号              | `server/routes/admin.js`、`server/api/admin/user/*`、`server/mongodb/models/users.js`                              | 源站 users 同时承载管理员与作者。多语言版管理员登录只读源站 DB；多语言 DB 的 users 固定作为作者快照表，字段占位规则见 2.3。                                                                                                                                                                                       |
| 服务端管理 API               | `server/routes/admin.js`、`server/api/admin/*`                                                                     | 源项目有 158 条左右管理路由，覆盖 CRUD、日志、备份、配置和上传。多语言版管理 API 固定挂载 `/api/multilingual-admin`；新增源导入、源覆盖确认、翻译创建、远程/本地媒体切换、关系实体快捷编辑，不新增评论/点赞管理。                                                                                                 |
| 服务端博客 API               | `server/routes/blog.js`、`server/api/blog/*`                                                                       | 源项目有 options、navi、post、banner、sidebar、comment、sort、archive、like/share、link、bangumi、movie、tag、mappoint、game、book、attachment、event、log、trend、vote。多语言站自有内容接口需要语言 code 过滤；源站接管的 options、comment、like/share 等接口由 blog 端通过 `/api/source-blog` 代理到源站接口。 |
| 文章模型                     | `server/mongodb/models/posts.js`                                                                                   | post 关联 author、sort、tags、mappointList、coverImages，以及 bangumi/movie/game/book/post/tweet/event/vote 两套推荐与内容关联列表。多语言版按 2.3 固定加入源快照、翻译组、语言 code、源 ID、源语言 code、源快照 ID 字段。                                                                                        |
| 媒体模型                     | `server/mongodb/models/attachments.js`、`albums.js`                                                                | 现有媒体只有本地文件路径、缩略图、相册、描述、全景状态。多语言版要区分 remote/local：remote 是抓取源文章时的源媒体快照，local 是多语言站本地文件。                                                                                                                                                                |
| 关联内容模型                 | `bangumis.js`、`movies.js`、`games.js`、`books.js`、`events.js`、`votes.js`、`mappoints.js`、`sorts.js`、`tags.js` | 创建翻译时按语言复制关联内容；同一语言下如已存在同源关联内容则复用，不重复创建。                                                                                                                                                                                                                                  |
| 横幅/侧边栏/导航             | `banners.js`、`sidebars.js`、`navis.js`                                                                            | 与文章无关联，按原表增加 languageCode 即可；不同语言看到不同内容。                                                                                                                                                                                                                                                |
| 友链                         | `links.js`                                                                                                         | 用户明确友链不需要多语言。多语言后台不提供本地友链配置；博客端友链列表通过 `/api/source-blog/link/list` 代理到源站。                                                                                                                                                                                              |
| 评论                         | `comments.js`、`server/api/blog/comment/*`                                                                         | 完全由源站接管，blog 端通过 `/api/source-blog/comment/*` 代理到源站评论接口；多语言 server 不反代、不写本地 comments、不提供评论后台。前端评论 UI 文案仍走语言包。                                                                                                                                                |
| 点赞                         | `postLikeLogs.js`、`commentLikeLogs.js`、`server/api/blog/postLikeLog/*`、`server/api/blog/commentLikeLog/*`       | 完全由源站接管，blog 端通过 `/api/source-blog/*` 代理到源站点赞接口；多语言 server 不写本地点赞日志，多语言后台不提供点赞统计管理。                                                                                                                                                                               |
| 访客统计、缓存、RSS、Sitemap | `server/config/cacheData.js`、`server/utils/rss.js`、`server/utils/sitemap.js`、`readerlogs.js`、`referrers.js`    | 多语言站需要保留与源站一致的访客统计体系，统计多语言站自己负责的页面和内容访问；评论、点赞、非多语言配置等源站完全接管内容不计入多语言统计。缓存键必须包含 languageCode；RSS/Sitemap 需要按语言生成，Sitemap 路径为 `/:code/sitemap.xml`，RSS 路径为 `/:code/rss`、`/:code/rss/blog`、`/:code/rss/tweet`。        |
| 博客端页面                   | `blog/app/pages/**`，多语言仓库当前已有 `blog/app/pages/[[code]]/**`                                               | 目标仓库已把页面放到 `[[code]]` 下，但尚未形成完整语言映射、canonical code 校验和 API 语言过滤。                                                                                                                                                                                                                  |
| 博客端组件/API               | `blog/app/components/**`、`blog/app/api/*.js`、`blog/app/composables/*`                                            | 大量组件有中文硬编码文案，需要按页面/组件拆分语言包；API 客户端需要带 canonical languageCode。                                                                                                                                                                                                                    |

## 2. 目标产品结构

### 2.1 语言 code 基础设施

新增统一语言模块：

- `SUPPORTED_LANGUAGE_CODES = ['zh-CN', 'zh-HK', 'zh-TW', 'zh-SG', 'ja-JP', 'en-US']`
- `LANGUAGE_CODE_MAP` 使用小写 key 映射 canonical code。
- `normalizeLanguageCode(input)` 返回 canonical code 或 `null`。
- Blog SSR、server API、admin 表单、数据库写入全部只保存 canonical code。
- URL 接受任意大小写，但 SEO canonical link 输出 canonical code 路径。

### 2.2 双 MongoDB 连接

多语言 server 必须拆成两个显式连接，禁止继续让 `server/mongodb/index.js` 直接调用 `mongoose.connect(process.env.DB_HOST)` 作为全局默认连接。

| 文件                                            | 职责                                                                                                         | 硬性规则                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `server/mongodb/sourceConnection.js`            | 通过 `mongoose.createConnection(process.env.DB_HOST, { autoCreate: false, autoIndex: false })` 连接源站 DB。 | 只导出 connection 和只读状态，不导出可写 model。                                                       |
| `server/mongodb/multilingualConnection.js`      | 通过 `mongoose.createConnection(process.env.DB_HOST_MULTILINGUAL)` 连接多语言 DB。                           | 所有源快照、翻译、本地媒体、多语言配置、统计、日志只写入这个连接。                                     |
| `server/mongodb/modelFactory/registerModels.js` | 接收 connection，注册现有 `models/*.js` 对应 schema。                                                        | 同一个模型名必须分别注册到 source 和 multilingual connection，禁止使用默认 `mongoose.model()` 取模型。 |
| `server/mongodb/sourceRepositories/*.js`        | 包装源站只读查询。                                                                                           | 只允许导出 `find`、`findOne`、`countDocuments`、`aggregate`、`findCursor`。                            |
| `server/mongodb/multilingualRepositories/*.js`  | 包装多语言 DB 读写。                                                                                         | 可导出现有 CRUD 方法，并承担新增多语言字段的过滤条件。                                                 |

`DB_HOST` 连接禁止出现以下调用：`save`、`create`、`insertMany`、`updateOne`、`updateMany`、`findOneAndUpdate`、`deleteOne`、`deleteMany`、`bulkWrite`、`dropCollection`、`dropDatabase`、`createCollection`、`createIndex`、`syncIndexes`。验证脚本必须在 `server/validator-tool.js` 或新增 validator 中扫描 `sourceConnection`、`sourceRepositories` 和所有 `source*` 命名文件，发现上述调用直接失败。

`server/mongodb/index.js` 改为启动编排文件，导出结构固定为：

```javascript
module.exports = {
  source: {
    connection: sourceConnection,
    repositories: sourceRepositories
  },
  multilingual: {
    connection: multilingualConnection,
    repositories: multilingualRepositories
  }
}
```

`global.$isReady` 必须在两个连接都 open、且多语言 DB 完成配置缓存、RSS/Sitemap 预生成后才置为 `true`。源站 DB 连接成功后不得调用 `globalConfigUtils.initGlobalConfig()`、`cacheDataUtils.*`、`rssToolUtils.reflushRSS()`、`sitemapToolUtils.reflushSitemap()`，这些初始化只允许读取 `DB_HOST_MULTILINGUAL`。

管理员登录流程固定为：`POST /api/multilingual-admin/login` 从源站 `users` 只读查询管理员，使用源站密码字段完成校验，签发多语言站 JWT；`GET /api/multilingual-admin/loginuserinfo` 再次只读源站 `users` 校验 `disabled` 和 `pwversion`。登录日志写入多语言 DB 的 `userLoginLogs`，不得写入源站 DB。

源站接口已经接管的评论、点赞、非多语言配置，由 blog 端直接请求源站接口；多语言 server 不读取源站 comments、postLikeLogs、commentLikeLogs、options 来代理这些能力。例外：多语言本地媒体上传的压缩质量、缩略图尺寸、视频压缩参数只读源站 options 作为处理配置，不在多语言后台编辑，也不把这些配置写入多语言 options。

### 2.3 数据身份字段

以下字段必须加入这些模型：`posts`、`users`、`sorts`、`tags`、`mappoints`、`attachments`、`albums`、`bangumis`、`movies`、`games`、`gamePlatforms`、`books`、`booktypes`、`events`、`eventtypes`、`votes`。

| 字段                 | Mongoose 类型           | 取值规则                                                                                                                                                                                    |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languageCode`       | `String`                | 必填，枚举 `zh-CN`、`zh-HK`、`zh-TW`、`zh-SG`、`ja-JP`、`en-US`。                                                                                                                           |
| `sourceLanguageCode` | `String`                | 必填，存源文章的 canonical code。                                                                                                                                                           |
| `sourceId`           | `Schema.Types.ObjectId` | 必填，存源站原始 `_id`。                                                                                                                                                                    |
| `sourceCollection`   | `String`                | 必填，枚举 `posts`、`users`、`sorts`、`tags`、`mappoints`、`attachments`、`albums`、`bangumis`、`movies`、`games`、`gamePlatforms`、`books`、`booktypes`、`events`、`eventtypes`、`votes`。 |
| `sourceSnapshotId`   | `Schema.Types.ObjectId` | 关联到多语言 DB 中 `recordKind: 'source'` 的源快照记录。                                                                                                                                    |
| `translationGroupId` | `Schema.Types.ObjectId` | 同一源文章组固定使用源快照 post 的 `_id`；源快照自身也写入自己的 `_id`。                                                                                                                    |
| `recordKind`         | `String`                | 必填，枚举 `source`、`translation`。                                                                                                                                                        |
| `snapshotVersion`    | `Number`                | 从 1 开始，源覆盖成功后加 1；翻译记录保留创建时的源版本。                                                                                                                                   |
| `sourceSnapshotAt`   | `Date`                  | 每次抓取源站数据时写当前时间。                                                                                                                                                              |
| `sourceUpdatedAt`    | `Date`                  | 源站记录的 `updatedAt`，源站不存在该字段时使用 `null`。                                                                                                                                     |
| `sourceHash`         | `String`                | 对去除 `_id`、`createdAt`、`updatedAt` 后的源记录 JSON 做稳定序列化哈希，用于判断覆盖前后差异。                                                                                             |

`posts` 中 `recordKind: 'translation'` 的记录还必须加入 `sourceChanged`、`pendingReview`、`sourceChangedAt`。源快照覆盖且 `sourceHash` 变化后，server 必须批量更新同一 `translationGroupId` 下已有翻译：`sourceChanged = true`、`pendingReview = true`、`sourceChangedAt = 当前时间`；翻译编辑保存并由管理员确认复核后，才允许把这两个布尔值改回 `false`。列表和编辑页必须显示待复核状态。

`navis`、`banners`、`sidebars` 只加入 `languageCode`、`recordKind`、`translationGroupId`，不加入 `sourceId`；这些记录由多语言后台本地创建，不参与源文章快照。

唯一索引固定如下：

| 集合           | 索引                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `posts` 源快照 | `{ sourceCollection: 1, sourceId: 1, sourceLanguageCode: 1, recordKind: 1 }`，`recordKind: 'source'` 下唯一。 |
| `posts` 翻译   | `{ translationGroupId: 1, languageCode: 1, recordKind: 1 }`，`recordKind: 'translation'` 下唯一。             |
| `posts` alias  | `{ languageCode: 1, alias: 1, type: 1 }`，`alias != null` 且 `status != 99` 下唯一。                          |
| 关联内容集合   | `{ sourceCollection: 1, sourceId: 1, languageCode: 1, recordKind: 1 }` 唯一。                                 |
| `attachments`  | `{ sourceCollection: 1, sourceId: 1, languageCode: 1, mediaMode: 1 }`，remote 媒体下唯一。                    |
| `options`      | `{ scope: 1, languageCode: 1, name: 1 }` 唯一。                                                               |

`users` 在多语言 DB 中只表示作者快照，不参与管理员登录。作者快照写入规则固定为：`username = source:${sourceId}:${languageCode}`，`password = '__AUTHOR_SNAPSHOT_NO_LOGIN__'`，`role = 0`，`disabled = true`，`nickname/photo/email/description/cover` 从源站作者复制并允许按语言编辑。多语言后台禁止用本地 `users` 执行登录。

`options` 模型必须增加 `scope` 和 `languageCode` 字段。多语言站自有配置统一写入 `scope: 'multilingual'`；源站接管配置不写入多语言 DB。

## 3. 源数据管理

### 3.1 导入源文章

后台页面 `admin/src/views/index/source/SourcePostImport.vue` 调用 `POST /api/multilingual-admin/source/post/import`。

请求体固定为：

```json
{
  "sourceId": "源站 posts._id，可为空",
  "alias": "源站 posts.alias，可为空",
  "sourceLanguageCode": "zh-CN",
  "overwrite": false
}
```

校验规则固定为：

- `sourceId` 和 `alias` 必须二选一；同时为空返回 `SOURCE_POST_ID_OR_ALIAS_REQUIRED`。
- `sourceLanguageCode` 必须能被 `normalizeLanguageCode()` 转成 canonical code；失败返回 `LANGUAGE_CODE_UNSUPPORTED`。
- `sourceId` 存在时必须通过 `mongoose.Types.ObjectId.isValid(sourceId)`；失败返回 `SOURCE_ID_INVALID`。
- 源文章查询条件为：`sourceId` 模式 `{ _id: sourceObjectId }`；`alias` 模式 `{ alias }`。
- 源文章不存在返回 `SOURCE_POST_NOT_FOUND`。
- 多语言 DB 已存在 `{ sourceCollection: 'posts', sourceId, sourceLanguageCode, recordKind: 'source' }` 且 `overwrite !== true` 时返回 `SOURCE_EXISTS`，响应内带已有 `sourceSnapshotId` 和 `snapshotVersion`。

成功导入流程固定为：

1. 使用 `sourceRepositories.posts.findOne()` 读取源文章，并按 `server/mongodb/utils/posts.js` 的 populate 关系读取作者、分类、标签、地点、封面媒体、推荐列表和内容强关联列表。
2. 使用 `copySourceRecord(collectionName, sourceDoc, context)` 写入多语言 DB；源文章写入 `posts`，`recordKind: 'source'`，`languageCode = sourceLanguageCode`。
3. 源快照 post 首次创建后，将自身 `_id` 写入 `translationGroupId`，同时写入所有已复制关联记录的 `sourceSnapshotId`。
4. 作者写入多语言 DB 的 `users`，按 `username = source:${sourceUserId}:${sourceLanguageCode}` 去重。
5. 分类、标签、地点、番剧、电影、游戏、阅读、活动、投票写入各自同名集合，按 `{ sourceCollection, sourceId, languageCode, recordKind }` 去重。
6. `coverImages`、文章内媒体和关联实体封面媒体写入 `attachments`，`mediaMode = 'remote'`，不下载物理文件。
7. `albums`、`gamePlatforms`、`booktypes`、`eventtypes` 作为被依赖实体先查再写，写入规则同关联内容集合。
8. 返回 `{ data: { sourceSnapshotId, translationGroupId, snapshotVersion, copiedCounts } }`。

覆盖导入规则固定为：`overwrite: true` 只更新当前源快照记录和新增缺失关联；旧关联、旧媒体、本地媒体不删除。源记录哈希未变化时仍更新 `sourceSnapshotAt`，但 `snapshotVersion` 不增加；哈希变化时 `snapshotVersion + 1`，并把同一 `translationGroupId` 下已有翻译标记为 `sourceChanged: true`、`pendingReview: true`。

### 3.2 源快照列表

源数据管理页面固定提供：

- 源文章快照列表：按标题、alias、源 ID、源语言、导入时间、覆盖版本过滤。
- 源文章详情：展示源快照、关联内容、媒体快照、已创建语言版本。
- 源覆盖入口：需要二次确认，并显示“不会删除旧关联和旧媒体”。
- 旧关联/旧媒体管理入口：用于清理或归档被覆盖后不再被当前源快照引用的数据。

源快照列表接口固定为 `GET /api/multilingual-admin/source/post/list`，查询参数为 `page`、`limit`、`keyword`、`sourceLanguageCode`、`hasTranslationLanguageCode`、`snapshotVersionMin`、`snapshotVersionMax`。返回字段固定包含 `_id`、`title`、`alias`、`type`、`sourceId`、`sourceLanguageCode`、`translationGroupId`、`snapshotVersion`、`sourceSnapshotAt`、`updatedAt`、`translationSummary`。

源快照详情接口固定为 `GET /api/multilingual-admin/source/post/detail?id=<sourceSnapshotId>`。返回结构分为 `post`、`author`、`sort`、`tags`、`mappointList`、`coverImages`、`recommendRelations`、`contentRelations`、`translations`、`orphanRelations`、`orphanMedia`。`orphanRelations` 和 `orphanMedia` 只读展示，不在详情接口执行删除。

## 4. 多语言数据管理

### 4.1 文章列表

列表页以源文章快照为主：

- 主表展示源文章标题、源语言、源 ID/alias、最近覆盖时间、翻译完成度。
- 子表格展示该源下 `zh-CN`、`zh-HK`、`zh-TW`、`zh-SG`、`ja-JP`、`en-US` 的文章版本。
- 子表格操作：创建、编辑、复制源快照、发布/草稿、预览。
- 创建某语言版本时，包括源语言本身，也从源数据复制一份到对应语言的多语言表。

多语言文章列表接口固定为 `GET /api/multilingual-admin/translation/post/list-by-source`。查询参数为 `page`、`limit`、`keyword`、`sourceLanguageCode`、`languageCode`、`status`、`type`。返回列表每一项必须包含 `sourcePost` 和 `translations`，其中 `translations` 是以六个 canonical code 为 key 的对象，缺失语言值为 `null`，前端子表格不再自行拼装语言矩阵。

### 4.2 创建多语言文章

创建 `ja-JP` 的《文章ja》时：

1. 从源快照复制 post 到 `languageCode: 'ja-JP'`、`recordKind: 'translation'`。
2. 作者作为内容实体复制到多语言 DB 的 `users` 表；若同语言同源作者已存在则复用。
3. 分类、标签、地点、bangumi、movie、game、book、event、vote、相关 post/tweet 等关联内容按语言复制并去重。
4. 媒体记录默认复制为 `mediaMode: 'remote'`，保留源媒体快照信息，不复制物理文件。
5. 编辑页面允许像普通文章一样编辑 title/content/excerpt/status/cover/关联内容等。

创建接口固定为 `POST /api/multilingual-admin/translation/post/create`，请求体固定为：

```json
{
  "sourceSnapshotId": "多语言 DB 中 recordKind=source 的 posts._id",
  "languageCode": "ja-JP",
  "copyMode": "source"
}
```

`copyMode` 第一版只允许 `source`。若同一 `translationGroupId + languageCode + recordKind: 'translation'` 已存在，返回 `TRANSLATION_EXISTS`。创建成功返回 `{ data: { translationPostId, translationGroupId, languageCode } }`。

翻译复制算法固定为：

1. 读取 `sourceSnapshotId` 对应 post，确认 `recordKind === 'source'`。
2. 对作者、分类、标签、地点、关联作品、活动、投票、媒体执行 `copyRelationToLanguage(collectionName, sourceRecordId, languageCode, sourceSnapshotId)`。
3. `copyRelationToLanguage` 先查 `{ sourceCollection, sourceId, languageCode, recordKind: 'translation' }`，存在则返回已有 `_id`，不存在则复制源快照字段并写入新记录。
4. post 的 `views`、`likes`、`shares`、`comnum` 初始化为 `0`；评论数和点赞数显示由源站接口返回结果决定，不从多语言 DB 聚合。
5. post 的 `status` 初始值为 `0`，`date` 复制源快照 date，`lastChangDate` 写当前时间。
6. post 的 `alias` 默认复制源 alias；不同 `languageCode` 下允许使用相同 alias。保存前只检查当前语言内 `{ languageCode, alias, type, status: { $ne: 99 } }`，冲突时返回 `ALIAS_CONFLICT_IN_LANGUAGE`，由后台要求编辑 alias 后重试。

### 4.3 关联内容编辑

文章编辑器新增关联内容快捷按钮：

- 作者、分类、标签、地点。
- 番剧、电影、游戏、阅读、活动、投票。
- 相关文章/推文和内容强关联列表。
- 媒体。

点击后弹窗编辑对应语言的关联内容。保存后文章编辑器动态重新加载关联内容，避免保存旧引用。

关联内容保存接口固定为 `PUT /api/multilingual-admin/translation/relation/update`，请求体固定为 `{ collectionName, id, languageCode, payload }`。`collectionName` 只允许 `users`、`sorts`、`tags`、`mappoints`、`bangumis`、`movies`、`games`、`gamePlatforms`、`books`、`booktypes`、`events`、`eventtypes`、`votes`、`attachments`。接口必须校验记录的 `languageCode` 与请求一致，失败返回 `RELATION_LANGUAGE_MISMATCH`。

### 4.4 媒体远程/本地策略

媒体字段固定加入 `attachments`：

- `mediaMode`: `remote` 或 `local`。
- `remoteSourceId`、`remoteFilepath`、`remoteSnapshot`。
- `localFilepath`、`localThumbnailPath`、`localStorageStatus`。
- `description` 按语言可编辑。

行为：

- remote：使用源站媒体内容，但以抓取时的源媒体信息作为快照。
- local：替换文件后转为本地媒体，文件保存在多语言站。
- local -> remote：后台按钮触发二次确认；确认后删除本地文件和缩略图，恢复 remote 快照引用。
- 源覆盖不删除旧媒体。旧 remote/local 媒体由媒体管理页面处理。

`mediaMode = 'remote'` 时，`filepath` 和 `thumfor` 保存源站公开路径快照，`remoteSnapshot` 保存源媒体的 `filename`、`filesize`、`width`、`height`、`mimetype`、`filepath`、`thumfor`、`createdAt`、`updatedAt`。`mediaMode = 'local'` 时，`localFilepath` 和 `localThumbnailPath` 必填，`remoteSnapshot` 保留不变。

本地替换接口固定为 `POST /api/multilingual-admin/media/replace-local`，使用 `multipart/form-data`，字段为 `id`、`languageCode`、`file`。转回远程接口固定为 `POST /api/multilingual-admin/media/convert-remote`，请求体为 `{ id, languageCode, confirmText: 'DELETE_LOCAL_FILE' }`。`confirmText` 不匹配时返回 `CONFIRM_TEXT_REQUIRED`，本地文件删除失败时返回 `LOCAL_FILE_DELETE_FAILED` 并保持 `mediaMode = 'local'`。

## 5. 管理后台菜单设计

多语言管理后台必须避开源站后台路径：

- 前端后台访问路径使用 `/multilingual-admin`，不使用源站的 `/admin`。
- Vue Router history base 使用 `/multilingual-admin`。
- Server 静态资源和 history fallback 只挂载到 `/multilingual-admin`。
- 管理 API 使用 `/api/multilingual-admin`，不复用源站 `/api/admin`。
- 多语言博客内容 API 使用 `/api/multilingual-blog`，不复用源站 `/api/blog`。
- 源站已接管接口在源站仍保持 `/api/blog/*`，多语言 Nuxt 侧通过 `/api/source-blog/*` 代理到源站，避免多语言服务占用 `/api/blog`。
- Blog 编译资源、public 资源、全景查看器和本地上传资源统一使用 `/multilingual-assets/*` 或 `/_multilingual_nuxt/*`，不占用源站 `/img`、`/geojson`、`/panorama`、`/upload`、`/content` 等根路径。

现有路径迁移规则固定为：

| 文件                        | 当前值                               | 必须改成                                                                                                                               |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `server/app.js`             | `app.use('/api/admin', adminRouter)` | `app.use('/api/multilingual-admin', multilingualAdminRouter)`                                                                          |
| `server/app.js`             | `app.use('/api/blog', blogRouter)`   | `app.use('/api/multilingual-blog', multilingualBlogRouter)`                                                                            |
| `server/app.js`             | `app.use('/rss', rssRouter)`         | 删除根级挂载，新增 `app.use('/:code/rss', multilingualRssRouter)`；router 内校验 code，并处理 `/`、`/blog`、`/tweet` 三种 RSS 子路径。 |
| `server/app.js`             | `app.use('/sitemap.xml', ...)`       | 删除根级挂载，新增 `app.get('/:code/sitemap.xml', sitemapToolUtils.getLanguageSitemap)`。                                              |
| `server/app.js`             | history index `/admin/index.html`    | history index `/multilingual-admin/index.html`。                                                                                       |
| `server/app.js`             | static path `/admin` + `front/admin` | static path `/multilingual-admin` + `front/multilingual-admin`。                                                                       |
| `admin/vite.config.js`      | `base: '/admin/'`                    | `base: '/multilingual-admin/'`。                                                                                                       |
| `admin/vite.config.js`      | `outDir: '../server/front/admin/'`   | `outDir: '../server/front/multilingual-admin/'`。                                                                                      |
| `admin/src/router/index.js` | `createWebHistory('/admin')`         | `createWebHistory('/multilingual-admin')`。                                                                                            |
| `admin/src/api/index.js`    | `baseURL: '/api/admin'`              | `baseURL: '/api/multilingual-admin'`。                                                                                                 |
| `blog/nuxt.config.js`       | 默认 `/_nuxt/` 和根 public 路径      | `buildAssetsDir: '/_multilingual_nuxt/'`，public 资源由 `/multilingual-assets/*` 提供。                                                |
| `blog/app/api/source.js`    | `baseURL: '/api/blog'`               | `baseURL: '/api/source-blog'`，Nuxt route 再代理到源站 `/api/blog`。                                                                   |

`server/app.js` 中第一级路径 404 规则必须允许 `multilingual-admin`，并继续拒绝未知一级路径。`/api/blog`、`/api/admin`、`/admin`、`/rss`、`/rss/blog`、`/rss/tweet`、`/sitemap.xml` 不在多语言 server 中挂载，由同域名源站处理。

Admin 组件中硬编码上传地址必须同步替换：`action="/api/admin/attachment/upload"`、`api.post('/api/admin/attachment/upload', ...)`、备份下载 `form.action = '/api/admin/backup/download'` 全部改为 `/api/multilingual-admin/...`。列表页继续使用 `ResponsiveTable` 和 `ResponsiveTableColumn`，禁止新增 Element Plus 原生 `el-table` 作为主列表。

后台菜单固定重组为以下结构：

| 菜单组         | 页面               | 说明                                                                                                                     |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 面板           | 工作台             | 展示源快照数量、各语言文章数量、待翻译/待发布、媒体本地化数量、最近导入记录和多语言站访客统计概览。                      |
| 源数据管理     | 源文章导入         | 输入源 ID/alias 和源语言 code，执行抓取；源存在时提示覆盖。                                                              |
| 源数据管理     | 源文章快照         | 源文章列表、详情、覆盖、查看关联内容和媒体快照。                                                                         |
| 源数据管理     | 源关联内容         | 管理源快照产生的作者、分类、标签、地点、作品、活动、投票等旧记录。                                                       |
| 源数据管理     | 源媒体快照         | 管理 remote 媒体快照和被覆盖后遗留的媒体记录。                                                                           |
| 多语言数据管理 | 多语言文章         | 源文章主表 + 语言版本子表格。                                                                                            |
| 多语言数据管理 | 关联内容           | 按语言管理作者、分类、标签、地点、番剧、电影、游戏、阅读、活动、投票等。                                                 |
| 多语言数据管理 | 媒体库             | 按语言和 remote/local 管理媒体，支持替换文件和转为远程。                                                                 |
| 多语言数据管理 | 导航               | 多语言后台本地创建，原 navi 表增加 languageCode，不从源站快照复制。                                                      |
| 多语言数据管理 | 横幅               | 多语言后台本地创建，原 banner 表增加 languageCode，不从源站快照复制。                                                    |
| 多语言数据管理 | 侧边栏             | 多语言后台本地创建，原 sidebar 表增加 languageCode，不从源站快照复制。                                                   |
| 设置           | 多语言站点配置     | 二级 tab 切换语言，仅配置语言相关内容。                                                                                  |
| 系统           | 备份/日志/访客统计 | 只备份多语言 DB 和多语言本地文件；只保留导入日志、错误日志、访客统计。评论统计和点赞统计由源站接管，不在多语言后台出现。 |

不再作为多语言本地核心菜单：友链、评论管理、评论统计、点赞统计、管理员管理。友链不多语言；评论和点赞由 blog 端直接调用源站接口；管理员账号由源站认证。

## 6. 配置整理

配置边界重新定义为：需要按语言展示或影响多语言内容呈现的配置，才进入多语言后台；不需要多语言后台配置的内容不是“继承后本地缓存”，而是 blog 端直接使用源站接口获取。因为未来同域名部署，源站接口不需要多语言 server 再反代一层。

### 6.1 需要多语言配置并使用二级语言 tab

多语言配置写入多语言 DB 的 `options` 集合，字段固定为：`scope: 'multilingual'`、`languageCode`、`name`、`value`。后台保存时一次只保存一个语言 tab，接口为 `PUT /api/multilingual-admin/settings/language/update`，请求体为 `{ languageCode, values }`。

| 配置域           | 字段                                                                                                                                  | 说明                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 站点基础展示     | `siteTitle`、`siteSubTitle`、`siteLogo`、`siteDarkLogo`、`siteDefaultCover`、`siteDescription`、`siteKeywords`、`siteShowLoadingText` | 直接影响不同语言页面的品牌展示和 SEO。                                                                                                             |
| 图标/封面        | `siteFavicon`、`siteDefaultCover`、`siteShareImage`                                                                                   | 这些图片进入多语言后台；每个语言必须能独立配置。                                                                                                   |
| 分享与页脚       | `siteShareDescription`、`siteFooterInfo`、`siteShowSitemapInFooter` 的展示文案                                                        | 分享文案和页脚内容需要语言化。                                                                                                                     |
| 文章页           | `sitePostBlogCommonFooterContent`、`sitePostTweetCommonFooterContent`、`sitePostRandomSimilarTitle`                                   | 文章页公共文案和标题需要语言化。                                                                                                                   |
| RSS/Sitemap 展示 | RSS title/description、语言 sitemap 元信息                                                                                            | 多语言站 RSS/Sitemap 必须按语言区分，Sitemap 公开路径为 `/:code/sitemap.xml`，RSS 公开路径为 `/:code/rss`、`/:code/rss/blog`、`/:code/rss/tweet`。 |
| 广告文案类       | 自定义广告位 HTML 中可见文案                                                                                                          | 若只是 Google Ad ID 或 ads.txt，则不做多语言。                                                                                                     |

6.1 中的字段表是当前候选范围，不作为最终实现清单。设置模块进入实现前，必须先由 `wikimoe-general-codebase-cartographer` 盘点 `admin/src/views/index/config/Config.vue`、`admin/src/components/Config*.vue`、`server/config/*`、`server/mongodb/models/options.js` 中实际 option 字段，产出 `doc/multilingual-config-field-inventory.md`。该盘点表每一项必须标记为 `language-owned`、`source-owned`、`runtime-global` 或 `out-of-scope`，并说明进入该分类的影响；确认后的 `language-owned` 字段才允许写入 `GET /api/multilingual-admin/settings/language/list` 和 `PUT /api/multilingual-admin/settings/language/update`。

`GET /api/multilingual-admin/settings/language/list` 返回六个语言的已确认 `language-owned` 配置矩阵；缺失字段由 server 返回空字符串或布尔默认值，前端不在组件内补默认值。

### 6.2 不需要多语言后台配置

| 配置域                                                  | 处理方式                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 评论开关、评论频率、审核、撤回限制                      | 评论完全由源站接管，blog 端直接请求源站评论接口和配置接口，多语言后台不设置。             |
| 点赞开关、点赞日志、点赞统计                            | 点赞完全由源站接管，blog 端直接请求源站点赞接口，多语言后台不设置、不统计。               |
| 邮件 SMTP、通知模板                                     | 邮件通知由源站评论体系接管，多语言站不设置。                                              |
| 媒体压缩质量、缩略图尺寸、视频压缩参数                  | 多语言 server 只读源站 options 获取这些处理配置；多语言后台不编辑，不写入多语言 options。 |
| 地图精度、默认中心点、默认缩放                          | 不按语言配置；若博客端需要这些值，直接使用源站 options 接口。                             |
| IP 黑名单、引用白名单、敏感词、管理员登录限制、JWT 刷新 | 安全/运维配置，不按语言配置。管理员认证使用源站账号，只读校验源站 DB。                    |
| Google Ad ID、ads.txt                                   | 账号级/域名级配置，不按语言配置；blog 端直接使用源站配置接口或域名级静态文件。            |
| 主题模式、是否允许切换主题、额外 CSS/JS                 | 全站体验和安全相关，不放入语言 tab；blog 端需要时直接使用源站 options 接口。              |
| 友链                                                    | 用户明确不需要多语言。                                                                    |

## 7. 博客端语言包设计

目录按用户要求：

```text
blog/app/lang/
  index.js
  zh-CN/
    common.js
    app.js
    postDetail.js
    postList.js
    commentForm.js
    components/PostItem.js
  zh-HK/
    common.js
    ...
  zh-TW/
  zh-SG/
  ja-JP/
  en-US/
```

规则：

- 常用内容放 `common.js`。
- 页面级文案放页面名文件，例如 `postDetail.js`、`postList.js`。
- 组件级文案放组件名文件，例如 `components/CommentForm.js`。
- `lang/index.js` 负责 supported codes、case-insensitive map、fallback 和按需加载。
- `useLang()` 或 `useI18nText()` composable 读取当前 route code，返回 canonical code 和 t 函数。
- 不引入新 i18n 依赖，先使用项目内 plain JS map，降低改造风险。
- 评论、点赞数据不区分语言且完全由源站接口处理；评论表单、按钮、点赞按钮、提示语等 UI 文案使用当前语言包。

`blog/app/lang/index.js` 必须导出：`SUPPORTED_LANGUAGE_CODES`、`DEFAULT_LANGUAGE_CODE = 'zh-CN'`、`normalizeLanguageCode`、`assertLanguageCode`、`getLanguageText`。`assertLanguageCode` 在 Nuxt page setup 中使用；无法归一化的 code 调用 `showError({ statusCode: 404 })`。

`blog/app/app.vue` 的 `htmlAttrs.lang` 不再固定 `zh-hans`，必须从当前 canonical code 映射为 `zh-CN`、`zh-HK`、`zh-TW`、`zh-SG`、`ja-JP`、`en-US`。RSS head 链接必须同时输出当前语言的三条地址：`${siteUrl}/${languageCode}/rss`、`${siteUrl}/${languageCode}/rss/blog`、`${siteUrl}/${languageCode}/rss/tweet`。

## 8. API 与路由策略

### 8.1 Blog API

- 多语言自有内容查询 API 使用 `/api/multilingual-blog`，接收 `languageCode`，server 侧归一化。
- 文章列表、详情、归档、分类、标签、地点、作品、横幅、导航、侧边栏都按 languageCode 过滤。
- Sitemap 按 code 输出，公开路径为 `/:code/sitemap.xml`；路径中的 code 不区分大小写，生成内容和 URL 使用 canonical code。
- RSS 按 code 输出，公开路径保留源站三种形态：`/:code/rss`、`/:code/rss/blog`、`/:code/rss/tweet`；路径中的 code 不区分大小写，feed title、description、item link 和正文摘要都使用对应语言数据。
- 多语言站不接管根级 `/sitemap.xml`、`/rss`、`/rss/blog`、`/rss/tweet`；根级路径继续由源站负责，避免同域名部署冲突。
- 访问统计保留语言维度，并沿用源站 readerlog、referrer、performance 三类统计字段；新增 `languageCode` 和 `routeOwnership` 字段。统计只写多语言 DB，不写源站 DB，不与源站统计表合并。
- 访问统计只统计多语言站负责的页面和内容，不统计源站完全接管的评论、点赞、非多语言配置请求。
- 评论相关请求由 blog 端通过 `/api/source-blog/comment/*` 代理到源站 `/api/blog/comment/*`，不经过多语言 Express server，不写入本地 comments。
- 点赞相关请求由 blog 端通过 `/api/source-blog/*` 代理到源站点赞接口，不经过多语言 Express server，不写入本地点赞日志。
- 非多语言配置由 blog 端通过 `/api/source-blog/options` 代理到源站 `/api/blog/options` 等源站接口，不在多语言 Express server 代理和缓存。

Blog API 客户端拆分为两个实例：

| 文件                           | baseURL                  | 使用范围                                                                                                                                                        |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blog/app/api/source.js`       | `/api/source-blog`       | `options`、`comment/*`、`post/like/log`、`post/like/log/list`、`comment/like/log`、`comment/like/log/list`、`link/list`，由 Nuxt route 转发到源站 `/api/blog`。 |
| `blog/app/api/multilingual.js` | `/api/multilingual-blog` | post、sort、tag、mappoint、bangumi、movie、game、book、event、vote、attachment、navi、banner、sidebar、archive、trend、readerlog、performance log。             |

`blog/app/api/index.js` 不再保留单一 `BASE_URL = '/api/blog'`。所有多语言 API 请求必须自动附带 `languageCode`，GET/DELETE 写入 `params.languageCode`，POST/PUT 写入 `body.languageCode`。源站直连 API 不附带 `languageCode`，保持源站接口参数格式。

Express 负责生成 XML 文件，Nuxt 负责把公开路径转发到 Express；这是与源站现有 `/rss`、`/sitemap.xml` 机制一致的边界。

| 层级    | 文件                                        | 路径                                                            | 行为                                                                                                                                                                                                                     |
| ------- | ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Express | `server/routes/multilingualRss.js`          | `GET /:code/rss`、`GET /:code/rss/blog`、`GET /:code/rss/tweet` | 校验 code，根据路径映射 RSS 类型：`rss -> all`、`rss/blog -> blog`、`rss/tweet -> tweet`；读取 `seo/rss/<canonical-code>/<type>.xml`，记录 `rsslogs`，返回 `application/rss+xml; charset=utf-8`。                        |
| Express | `server/utils/rss.js`                       | `reflushLanguageRSS(languageCode)`                              | 沿用源站三种 RSS 类型生成文件：`all.xml` 查询 `{ languageCode, status: 1, type: { $in: [1, 2] }, recordKind: 'translation' }`，`blog.xml` 查询 `type: 1`，`tweet.xml` 查询 `type: 2`，写入 `seo/rss/<canonical-code>/`。 |
| Express | `server/app.js` + `server/utils/sitemap.js` | `GET /:code/sitemap.xml`                                        | 校验 code，读取 `seo/sitemap/<canonical-code>/sitemap.xml`，返回 `application/xml; charset=utf-8`。                                                                                                                      |
| Express | `server/utils/sitemap.js`                   | `reflushLanguageSitemap(languageCode)`                          | 查询 `posts` 中 `{ languageCode, status: 1, type: { $in: [1, 2, 3] }, recordKind: 'translation' }`，写入 `seo/sitemap/<canonical-code>/sitemap.xml`。                                                                    |
| Nuxt    | `blog/server/routes/[code]/rss.js`          | `GET /:code/rss`                                                | 校验 code 后 `proxyRequest(event, apiDomain + event.node.req.url)`，不生成 XML。                                                                                                                                         |
| Nuxt    | `blog/server/routes/[code]/rss/blog.js`     | `GET /:code/rss/blog`                                           | 校验 code 后 `proxyRequest(event, apiDomain + event.node.req.url)`，不生成 XML。                                                                                                                                         |
| Nuxt    | `blog/server/routes/[code]/rss/tweet.js`    | `GET /:code/rss/tweet`                                          | 校验 code 后 `proxyRequest(event, apiDomain + event.node.req.url)`，不生成 XML。                                                                                                                                         |
| Nuxt    | `blog/server/routes/[code]/sitemap.xml.js`  | `GET /:code/sitemap.xml`                                        | 校验 code 后 `proxyRequest(event, apiDomain + event.node.req.url)`，不生成 XML。                                                                                                                                         |

多语言端必须保留源站 RSS 的三种 feed 形态：`/:code/rss` 对应 `all.xml`，`/:code/rss/blog` 对应 `blog.xml`，`/:code/rss/tweet` 对应 `tweet.xml`。现有根级 `blog/server/routes/rss.js`、`blog/server/routes/rss/blog.js`、`blog/server/routes/rss/tweet.js`、`blog/server/routes/sitemap.xml.js` 不作为多语言公开路径使用；多语言页面只使用 `[code]` 目录下的新路由。

Sitemap 第一版只保留 `/:code/sitemap.xml`，不新增 sitemap index 或分类型 sitemap。Sitemap URL 规则固定为：首页 `/${languageCode}`，文章和推文 `/${languageCode}/index/post/${alias || _id}`，页面 `/${languageCode}/index/page/${alias || _id}`，列表聚合页不进入 sitemap。RSS item link 使用同样规则。

### 8.2 Admin API

新增或重构，统一挂载在 `/api/multilingual-admin`：

- `POST /source/post/import`
- `POST /source/post/overwrite`
- `GET /source/post/list`
- `GET /source/post/detail`
- `GET /source/relation/list`
- `POST /translation/post/create`
- `GET /translation/post/list-by-source`
- `GET /translation/post/detail`
- `PUT /translation/post/update`
- `PUT /translation/relation/update`
- `POST /media/replace-local`
- `POST /media/convert-remote`
- `GET /settings/language/list`
- `PUT /settings/language/update`

API 错误响应固定为 `{ errorList: [{ code, message, field }] }`。禁止新增名为 `errors` 的 Mongoose schema path；对外兼容旧前端时可在响应拦截器中兼容读取 `errors`，新接口只输出 `errorList`。

错误码固定包含：`LANGUAGE_CODE_UNSUPPORTED`、`SOURCE_POST_ID_OR_ALIAS_REQUIRED`、`SOURCE_ID_INVALID`、`SOURCE_POST_NOT_FOUND`、`SOURCE_EXISTS`、`SOURCE_SNAPSHOT_NOT_FOUND`、`TRANSLATION_EXISTS`、`ALIAS_CONFLICT_IN_LANGUAGE`、`RELATION_LANGUAGE_MISMATCH`、`MEDIA_MODE_INVALID`、`CONFIRM_TEXT_REQUIRED`、`LOCAL_FILE_DELETE_FAILED`、`DB_HOST_WRITE_FORBIDDEN`。

不得新增评论管理、点赞日志管理、点赞统计管理 API；这些能力由源站后台负责。

`checkAuth` 必须只校验多语言站 JWT，再通过源站只读 `users` 校验是否为管理员。`checkRole` 不再依赖本地作者快照 `users.role`，也不读取源站细粒度角色/菜单权限；多语言后台只校验管理员身份，不同步源站角色权限模型。

## 9. 数据迁移与兼容策略

实现切片固定按以下顺序推进；每个切片完成后必须更新验证脚本，验证通过后进入下一切片。

1. `server/utils/language.js`、`blog/app/lang/index.js`：建立同一份 canonical code 规则，完成单元验证 `normalizeLanguageCode('ZH-cn') === 'zh-CN'`。
2. `server/mongodb/sourceConnection.js`、`server/mongodb/multilingualConnection.js`、`server/mongodb/modelFactory/registerModels.js`：完成双连接，`server/mongodb/index.js` 不再导出默认 mongoose connection。
3. `server/mongodb/models/*.js`：加入 2.3 中固定字段和索引；`users` 写作者快照占位字段；`options` 加 `scope/languageCode`。
4. `server/mongodb/sourceRepositories/*.js`：完成源站只读 repository，验证脚本扫描 `DB_HOST` 写操作黑名单。
5. `server/api/multilingual-admin/source/post/*` 和 `server/routes/multilingualAdmin.js`：完成源导入、覆盖、列表、详情。
6. `server/api/multilingual-admin/translation/post/*`：完成翻译创建、列表、详情、更新和 alias 语言内冲突校验。
7. `server/api/multilingual-admin/translation/relation/update.js`、`server/api/multilingual-admin/media/*`：完成关联弹窗保存、本地替换、转回远程。
8. `admin/vite.config.js`、`admin/src/router/index.js`、`admin/src/api/index.js`、`server/app.js`：完成 `/multilingual-admin` 和 `/api/multilingual-admin` 路径迁移。
9. `admin/src/views/index/Index.vue` 和对应 view：删除评论、点赞、邮件模板、友链、本地管理员菜单；新增源数据管理、多语言数据管理、多语言设置、访客统计。
10. `blog/app/api/source.js`、`blog/app/api/multilingual.js`、`blog/app/api/index.js`：完成源站直连和多语言自有 API 分流。
11. `blog/app/pages/[[code]]/**`、`blog/app/composables/useLang.js`、`blog/app/composables/usePostSeo.js`、`blog/app/app.vue`：完成 code 校验、语言包、SEO、三种 RSS head 链接。
12. `server/utils/rss.js`、`server/utils/sitemap.js`、`server/routes/multilingualRss.js`、`blog/server/routes/[code]/rss.js`、`blog/server/routes/[code]/rss/blog.js`、`blog/server/routes/[code]/rss/tweet.js`、`blog/server/routes/[code]/sitemap.xml.js`：完成 Express 生成 XML 文件、Nuxt 转发公开路径。
13. `server/config/cacheData.js`、`server/api/blog/log/*` 对应多语言实现：缓存键加入 `languageCode`，访客统计只记录多语言页面、文章、推文、页面详情和多语言自有 API。
14. `server/validator-tool.js`、`admin` 验证脚本、`blog` 构建验证：补齐所有切片的断言。

旧数据策略固定为：导入、覆盖、创建翻译都不删除旧数据。清理旧关联、旧媒体、本地文件只能通过专门管理页面触发，接口必须要求二次确认字段；没有确认字段的删除请求返回 `CONFIRM_TEXT_REQUIRED`。

## 10. 验证脚本与构建命令

验证命令固定使用 yarn classic 或项目已有脚本，不使用 `npm install`。

| 范围               | 命令                        | 必须覆盖                                                                                                                                      |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| server foundation  | `yarn validate:foundation`  | 语言 code、双连接导出结构、`server/app.js` 路径挂载、`DB_HOST` 写操作黑名单。                                                                 |
| server models      | `yarn validate:models`      | 必填字段、枚举、索引、`users` 作者快照规则、`options` scope/languageCode。                                                                    |
| server import      | `yarn validate:import`      | 源导入请求体、`SOURCE_EXISTS`、覆盖版本、源变化后翻译待复核标记、关联复制、remote 媒体。                                                      |
| server translation | `yarn validate:translation` | 翻译创建、语言矩阵、alias 冲突、关联去重、媒体转换确认。                                                                                      |
| server admin API   | `yarn validate:adminApi`    | `/api/multilingual-admin` 全部路由、认证、错误码 `errorList`。                                                                                |
| server blog API    | `yarn validate:blog`        | `/api/multilingual-blog` languageCode 过滤、`all.xml/blog.xml/tweet.xml` 三种 RSS 文件生成、单 `sitemap.xml` 生成、访客统计排除源站接管内容。 |
| admin              | `yarn build`                | `/multilingual-admin/` base、响应式列表、无评论/点赞/邮件/友链/管理员菜单、备份范围只覆盖多语言 DB 和本地文件。                               |
| blog               | `yarn build`                | `/:code` 页面、语言包、三种 RSS head、Nuxt `[code]` RSS/Sitemap 转发路由。                                                                    |

第一切片必须把上述 validate 脚本写入 `server/package.json`，脚本入口统一走 `node ./validator-tool.js <scope>`。

## 11. 子 agent 设计与使用

### 11.1 通用 agent

这些 agent 可长期保留：

| 文件                                                            | 角色                             | 后续使用方式                                      |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `.github/agents/wikimoe-general-codebase-cartographer.agent.md` | 只读功能盘点、路径梳理、差异分析 | 每个实现模块开始前先让它读取相关现状，减少误改。  |
| `.github/agents/wikimoe-general-validation-specialist.agent.md` | 运行验证命令、整理失败输出       | 每个模块完成后运行 server/admin/blog 的对应验证。 |

### 11.2 此次任务专用 agent

这些文件带 `task-multilingual-20260427-` 前缀；项目完成并通过第 12 章验收后整组删除：

| 文件                                                                      | 角色                 | 适用任务                                                                                          |
| ------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `.github/agents/task-multilingual-20260427-source-snapshot.agent.md`      | 源快照与双数据库专家 | 双 MongoDB、`DB_HOST` 只读、源导入、覆盖确认、管理员源站认证、元数据字段。                        |
| `.github/agents/task-multilingual-20260427-admin-console.agent.md`        | 管理后台专家         | `/multilingual-admin` 路径避让、菜单重组、源数据管理、多语言文章列表、语言 tab 配置、响应式后台。 |
| `.github/agents/task-multilingual-20260427-blog-i18n.agent.md`            | 博客端语言专家       | `/:code`、大小写归一化、语言包、SEO、API languageCode、评论/点赞/非多语言配置直连源站前端接入。   |
| `.github/agents/task-multilingual-20260427-media-relations.agent.md`      | 媒体与关联内容专家   | remote/local 媒体、关系实体复制去重、编辑弹窗、转远程删除本地文件。                               |
| `.github/agents/task-multilingual-20260427-release-orchestrator.agent.md` | 执行编排专家         | 按计划分派任务、检查完成度、协调验证，确保无人值守推进到产品状态。                                |

执行方式固定为：

1. 由 `task-multilingual-20260427-release-orchestrator` 读取本计划，拆出当前最小产品切片。
2. 每个切片先交给 `wikimoe-general-codebase-cartographer` 做只读现状确认。
3. 按切片类型交给对应专用 agent 修改。
4. 修改完成后交给 `wikimoe-general-validation-specialist` 验证。
5. 验证失败回到对应专用 agent 修复；验证通过再进入下一切片。

## 12. 验收标准

产品完成时至少满足：

- `/zh-CN`、`/zh-cn`、`/ja-JP`、`/en-US` 等大小写输入都能匹配到正确语言。
- 多语言后台使用 `/multilingual-admin`，多语言管理 API 使用 `/api/multilingual-admin`，不与源站 `/admin`、`/api/admin` 冲突。
- `DB_HOST` 在多语言程序中只有只读用途，验证脚本或代码审查不得发现任何针对源站 DB 的写入、更新、删除或索引维护操作。
- 管理员可用源站账号登录多语言后台，并获得多语言站 token。
- 后台能按源 ID/alias + 源语言 code 导入源文章及所有关联快照。
- 源存在时会提示覆盖；覆盖不会删除旧关联和旧媒体。
- 后台文章列表以源快照为主，子表格展示各语言文章。
- 可从源快照创建任一支持语言的文章版本，关联内容按语言复制并去重。
- 文章编辑器可编辑正文，也可快捷编辑对应语言的关联内容并刷新。
- 媒体能区分 remote/local，支持替换为本地文件和二次确认转回远程。
- 横幅、侧边栏、导航按 languageCode 展示；友链不做本地多语言配置。
- 设置页实现前完成配置字段盘点，只保留确认后的多语言配置，并用二级语言 tab 切换。
- 不需要多语言后台配置的内容由 blog 端直接请求源站接口获取，不在多语言后台维护，也不通过多语言 server 反代。
- 博客端 UI 文案从 `blog/app/lang/<code>/...` 读取，常用内容在 `common.js`。
- 评论和点赞由 blog 端直接调用源站接口，不按语言拆分，多语言后台没有评论管理、点赞统计管理。
- 多语言站具备与源站一致的访客统计体系，但只统计多语言站负责的页面和内容；源站完全接管内容不计入多语言统计，统计只写多语言 DB。
- 多语言后台备份功能只备份多语言 DB 和多语言本地文件。
- `/zh-CN/sitemap.xml`、`/zh-cn/sitemap.xml`、`/ja-JP/rss`、`/ja-JP/rss/blog`、`/en-US/rss/tweet` 等路径能按对应 canonical code 输出独立 Sitemap 和 RSS。
- RSS/Sitemap XML 文件由 Express 写入 `server/seo/rss/<canonical-code>/all.xml`、`blog.xml`、`tweet.xml` 和 `server/seo/sitemap/<canonical-code>/sitemap.xml`，Nuxt `[code]` route 只负责转发。
- Blog API 客户端中，源站接管接口只走 `/api/source-blog`，多语言自有内容只走 `/api/multilingual-blog`。
- 新增 server API 错误响应使用 `errorList`，不得新增 Mongoose `errors` schema path。
- 缓存、RSS、Sitemap、SEO、访客统计不会把不同语言数据混在一起，也就是说根据语言单独设定。
- Admin build、Blog build、Server 验证脚本通过；已知非阻塞警告需记录。

## 13. 当前待注意事项

- `blog/app/pages/[[code]]/**` 已存在；必须新增 `blog/app/composables/useLang.js`，并在每个 page setup 开头执行 code 校验，不允许页面组件自行解析 route param。
- `server/sample.env` 已有 `DB_HOST_MULTILINGUAL`；第一切片必须让 `server/mongodb/index.js` 停止使用默认 `mongoose.connect(process.env.DB_HOST)`，否则后续模型会继续误写源站 DB。
- `users` 模型保留为作者快照表；多语言管理员登录只读源站 `users`，本地 `users.password` 固定写 `__AUTHOR_SNAPSHOT_NO_LOGIN__`，不得用于登录。
- comments、postLikeLogs、commentLikeLogs 的本地模型文件保留给历史代码引用；不得挂到 `/api/multilingual-admin` 和 `/api/multilingual-blog`，不得出现在多语言后台菜单。
- 设置页实现前必须先完成 `doc/multilingual-config-field-inventory.md`，逐项确认哪些源站配置字段进入多语言 options；未确认字段不得写入多语言设置接口。
- `/admin`、`/api/admin`、`/api/blog`、`/rss`、`/rss/blog`、`/rss/tweet`、`/sitemap.xml` 在多语言 server 中不再挂载；同域名部署时这些路径留给源站。
- 删除旧关联、旧媒体、本地文件的接口必须有 `confirmText`，并且必须先写操作日志，再执行删除。
