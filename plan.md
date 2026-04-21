# wikimoeNodeJSBlogMultilingual 实施计划

更新时间：2026-04-21

## 1. 目标与硬约束

### 1.1 项目目标

- 基于 wikimoeNodeJSBlog 的现有技术栈，建设一个独立运行的多语言附属站 wikimoeNodeJSBlogMultilingual。
- 在完全不修改 wikimoeNodeJSBlog 项目的前提下，通过其公开博客接口拉取文章与关联数据，完成导入、翻译、编辑、校验、发布和前台展示。
- 多语言附属站必须独立部署、独立数据库、独立后台、独立前台、独立配置。

### 1.2 已确认且必须严格执行的规则

- 技术栈与原项目保持一致：博客端使用 Nuxt 4，服务端使用 Express，管理端使用 Vue 3 + Vite，数据库使用 MongoDB。
- 管理后台访问路径固定为 /multilingual-admin。
- 表单校验统一改为 joi 18.1.2。
- AI 翻译统一使用 @google/genai 1.50.1。
- AI 翻译必须采用工具调用模式，不允许直接依赖自由文本输出作为最终写库结果。
- 必须支持 AI_GATEWAY_URL 配置。
- 仅支持导入和翻译博文与推文。
- 页面类型文章必须禁止导入，并给出明确错误提示。
- 附件体系拆分为远程附件和翻译站附件两类。
- 远程附件用于映射原站资源，默认只保存原站相对路径，运行时再拼接原站域名配置。
- 翻译站附件用于存储多语言站本地上传的语言专属媒体文件。
- 当前语言文章可以继续使用远程附件，也可以替换为当前语言的翻译站附件。
- 所有来自原站的内部链接、媒体路径、作者头像路径、作者封面路径、来源快照、导入任务载荷都不允许保存完整原站 URL，只允许保存相对路径；运行时通过 SOURCE_BLOG_PUBLIC_ORIGIN 配置拼接。
- 评论、点赞、分享、浏览计数、投票互动在多语言站全部关闭。
- 投票在翻译站统一按只读信息处理，只展示，不允许提交、不允许写入、不允许统计。
- languageCode 直接使用 en、jp、tw。
- 同一原文加同一语言重复导入时，必须先提示已存在。
- 用户确认重复导入后，目标文章状态强制改为草稿，再执行覆盖更新。
- 作者与管理员必须拆成两张表管理，不能共用 users 表。
- 多语言站需要复制原站作者信息到 authors 表，并支持作者信息翻译流程。
- 每种语言都是独立文章，但必须按原始文章 sourceId 分组。
- 前台公开访问路径必须支持 /en、/jp、/tw。
- 列表路径规则必须在原博客路径前面增加语言路径前缀。
- 编辑页富文本体验必须与 wikimoeNodeJSBlog 一致，优先复制原后台 RichEditor5 相关实现。
- 作者、分类、标签、地点、附件、bangumi、movie、game、book、event、vote 等关联实体都必须可以在后台独立管理，不依赖文章编辑页入口。

### 1.3 一期范围边界

- 一期只实现文章与推文的多语言前台展示，以及普通列表、分类列表、标签列表、地点列表、详情页。
- 一期不实现 bangumi、movie、game、book、event、vote 的独立公开列表页和详情页。
- 上述关联实体在一期仅作为文章详情页中的关联信息存在，并且必须可导入、可翻译、可编辑、可校验。
- 原站公开接口之外的数据不读取，不走原站后台私有接口，不直接连原站数据库。

## 2. 现状基线

### 2.1 原项目已确认技术基线

- 原博客端：Nuxt 4 + TailwindCSS。
- 原服务端：Express 4.22.1 + Mongoose 9.0.1。
- 原管理端：Vue 3 + Vite + Element Plus。
- 原后台富文本：Wangeditor 5。
- 原博客公开接口挂载在 /api/blog。
- 原文章详情接口 /api/blog/post/detail 已经会返回文章及其大部分关联内容。
- 原文章列表接口 /api/blog/post/list 已经支持 type、sort、tag、mappoint、archive 等筛选。

### 2.2 原站接口使用策略

- 导入文章时，优先调用原站 /api/blog/post/detail。
- 为了明确区分“文章不存在”和“页面不允许导入”，导入流程必须执行两步判定：
  1. 先调用带 type=[1,2] 的 post/detail，只允许博文和推文命中。
  2. 若返回 404，再调用不带 type 的 post/detail。
  3. 若第二次返回 type=3，则报错“页面不支持导入”。
  4. 若第二次仍 404，则报错“文章不存在”。
- 多语言站前台运行时不再依赖原站公开接口，前台统一读取本地 MongoDB 中的多语言数据。

## 3. 总体架构

## 3.1 目录结构

项目目录按原项目三端结构拆分，并增加 shared/common 层：

```text
wikimoeNodeJSBlogMultilingual/
├─ package.json
├─ build-all.js
├─ README.md
├─ plan.md
├─ example.env
├─ admin/
│  ├─ package.json
│  └─ src/
├─ blog/
│  ├─ package.json
│  └─ app/
├─ server/
│  ├─ package.json
│  └─ src/ 或沿用原 server 结构
└─ common/
   ├─ constants/
   ├─ validation/
   └─ utils/
```

### 3.2 代码复用策略

从 wikimoeNodeJSBlog 可直接复制并在新项目中适配的部分：

- server 侧：路由注册模式、MongoDB utils 模式、JWT 工具、日志配置、缓存配置模式。
- admin 侧：RichEditor5、RichEditorEventSelectorDialog、AttachmentsDialog、ResponsiveTable、ResponsiveTableColumn、IpInfoDisplay、DeviceInfoDisplay、axios API 封装层、登录页骨架。
- blog 侧：公共布局组件、文章列表卡片、文章详情展示组件、颜色模式切换、部分 wui 组件、SEO 工具函数。

必须重写或显著改造的部分：

- 所有表单校验逻辑，统一切换到 joi 18.1.2。
- 所有文章、作者、分类、标签、地点、关联实体的模型与接口。
- 管理后台路由基座，从 /admin 改为 /multilingual-admin。
- 前台路由结构，统一增加语言前缀。
- 所有与评论、点赞、分享、投票、浏览写入相关的接口与前端行为。
- 原后台 users 表相关逻辑，拆分为 adminUsers 和 authors 两套模型。
- AI 翻译服务和 HTML 文本抽取回填服务。

## 4. 数据模型设计

### 4.1 统一字段规则

除 adminUsers、importJobs、aiTranslationLogs、translationMemories 外，其余多语言业务集合统一遵守以下规则：

- 除翻译站附件外，其余业务集合原则上都必须包含 sourceId 字段，用于记录原站对应实体 ID。
- 必须包含 languageCode 字段，值只允许 en、jp、tw。
- 必须包含 sourceSnapshot 字段，用于保存最近一次来源快照。原站同步实体保存经过“原站内部 URL 相对化”后的快照，翻译站附件保存本地上传快照。
- 必须包含 sourceHash 字段，用于检测来源内容是否变化。原站同步实体保存相对路径归一化后的原文哈希，翻译站附件保存文件与元数据哈希。
- 必须包含 translationStatus 字段。
- translationStatus 取值固定为：pending、ai_draft、manual_draft、approved、not_required、stub、outdated。
- 必须包含 createdAt、updatedAt。
- 所有“共享实体”必须通过稳定唯一键做唯一约束。原站同步实体使用 sourceId + languageCode，翻译站附件使用 attachmentGroupKey + languageCode + attachmentSourceType。
- 所有原站来源数据在写入数据库前都必须先经过 sourceUrlNormalizer，把命中原站域名的内部 URL 统一转换为相对路径。

### 4.2 adminUsers

用途：后台登录账号，仅用于后台权限与操作审计。

字段：

- username
- password
- nickname
- role
- disabled
- pwversion
- IP
- ipInfo
- createdAt
- updatedAt

索引：

- username 唯一索引。

强约束：

- adminUsers 不允许存放作者展示信息。
- 后台登录接口只能查询 adminUsers，不能查询 authors。

### 4.3 authors

用途：多语言作者展示资料。

字段：

- sourceId
- languageCode
- nickname
- description
- photoAttachment
- coverAttachment
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode 唯一索引。

规则：

- authors 不包含 username、password、role、pwversion 等登录字段。
- 作者头像和封面统一通过 attachments 引用管理，不允许在 authors 中直接保存完整原站 URL。
- 原站作者头像和封面若来自原站资源，必须先归一化为相对路径，再生成或复用 remote 类型 attachments。
- 作者是共享实体，编辑某语言作者资料会影响同语言下所有引用该作者的文章，后台必须给出明确提示。

### 4.4 sorts

字段：

- sourceId
- languageCode
- sortname
- alias
- description
- template
- taxis
- parentSourceId
- parent
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode 唯一索引。
- languageCode + alias 普通唯一索引，空 alias 允许为空。

规则：

- 必须保留分类层级关系。
- 导入时先按 sourceId 建立树，再回填本地 parent 引用。

### 4.5 tags

字段：

- sourceId
- languageCode
- tagname
- lastusetime
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode 唯一索引。

### 4.6 mappoints

字段：

- sourceId
- languageCode
- title
- summary
- longitude
- latitude
- zIndex
- status
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode 唯一索引。

规则：

- 经纬度、zIndex、status 不翻译，只同步原值。
- title、summary 允许翻译。

### 4.7 attachments

用途：统一记录封面图、关联媒体和正文内解析出的媒体资源，但逻辑上拆分为远程附件和翻译站附件两类。

字段：

- attachmentSourceType，值只允许 remote 或 localized
- attachmentGroupKey，用于把同一概念媒体的不同语言版本归组
- sourceId，远程附件必填，翻译站附件可为空
- languageCode
- sourcePath，原站内部资源相对路径，仅 remote 且来源于原站时使用
- sourcePathHash
- externalUrl，第三方外链资源完整 URL，仅 remote 且来源于第三方时使用
- externalUrlHash
- filename
- filepath，公开访问相对路径，不允许保存完整原站 URL
- storagePath，翻译站附件使用的本地存储相对路径
- name
- description
- filesize
- fileHash
- width
- height
- mimetype
- thumfor
- thumWidth
- thumHeight
- albumSourceId
- is360Panorama
- derivedFromSourceId，可选，若翻译站附件由远程附件演化而来则记录原远程附件 sourceId
- importOrigin，值固定为 sourceAttachment、htmlDiscovered、localizedUpload、localizedDerived
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode + attachmentSourceType 唯一索引，用于原站附件有 ID 的远程附件。
- sourcePathHash + languageCode + attachmentSourceType 唯一索引，用于正文中解析出的无 sourceId 原站远程资源。
- externalUrlHash + languageCode + attachmentSourceType 唯一索引，用于正文中解析出的第三方远程资源。
- attachmentGroupKey + languageCode + attachmentSourceType 唯一索引，用于翻译站附件的语言版本归组。

规则：

- 原站资源型远程附件只允许保存 sourcePath 和 filepath 的相对路径，不允许保存完整原站 URL。
- 原站资源型远程附件在渲染阶段通过 sourceAssetResolver 使用 SOURCE_BLOG_PUBLIC_ORIGIN 与相对路径拼接最终访问地址。
- 第三方外链型远程附件允许保存 externalUrl，但不允许误存为原站完整 URL。
- 远程附件在导入阶段只登记元数据和远程地址，不复制原文件二进制。
- 翻译站附件的 filepath 必须指向多语言站本地可访问地址，storagePath 必须指向本地持久化存储位置。
- 同一 attachmentGroupKey 下，允许 en、jp、tw 分别拥有不同的翻译站附件文件。
- 当前语言文章可将远程附件替换为当前语言的翻译站附件，且该替换不能影响其他语言文章。
- 远程附件与翻译站附件的 name、description 都可翻译；只有翻译站附件允许替换二进制文件本身。

### 4.8 关联实体集合

以下集合必须存在，并且统一采用 sourceId + languageCode 唯一约束：

- bangumis
- movies
- games
- books
- events
- votes

这些集合的一期字段原则：

- 只存原站文章详情接口实际返回、并且前台文章详情展示需要的字段。
- 文本字段允许翻译。
- 非文本字段直接同步。
- 若原站 detail 返回中不包含某个字段，则一期不为了该字段额外走私有接口补数。

votes 额外规则：

- 因多语言站关闭投票互动，votes 仅作为展示型关联信息存在。
- votes 只能展示标题、选项及必要的只读说明，不渲染可交互控件，不产生任何本地投票记录。
- options.title 允许翻译。
- options.\_id 记录为 sourceOptionId，不在多语言站产生投票写入数据。

### 4.9 posts

用途：多语言文章主表，只保存 type=1 和 type=2。

字段：

- sourceId
- sourceAlias
- groupSourceId，固定等于 sourceId，用于分组
- languageCode
- type，只允许 1 或 2
- title
- excerpt
- content
- alias
- date
- lastChangDate
- status，沿用 0 草稿、1 发布、99 回收站
- allowRemark，固定 false
- template
- code
- editorVersion，默认 5
- coverImages
- author
- sort
- tags
- mappointList
- bangumiList
- movieList
- gameList
- bookList
- postList
- tweetList
- eventList
- voteList
- seriesSortList
- contentBangumiList
- contentMovieList
- contentGameList
- contentBookList
- contentPostList
- contentTweetList
- contentEventList
- contentVoteList
- contentSeriesSortList
- importMeta
- publishMeta
- validationState
- sourceSnapshot
- sourceHash
- translationStatus
- isManualEdited
- createdAt
- updatedAt

索引：

- sourceId + languageCode 唯一索引。
- groupSourceId + languageCode 普通索引。
- languageCode + alias 唯一索引。
- languageCode + type + status + date 组合索引。
- languageCode + sort + status + date 组合索引。
- languageCode + tags + status + date 组合索引。
- languageCode + mappointList + status + date 组合索引。

规则：

- 不允许写入 type=3。
- allowRemark 固定为 false。
- views、likes、shares、comnum 不作为互动计数使用，不提供写入接口。
- postList 与 tweetList 中若目标语言对应文章不存在，则必须建立 stub 记录并阻止当前文章发布。
- coverImages 以及所有媒体引用都指向 attachments，attachments 可为 remote 或 localized 两种类型。

### 4.10 importJobs

用途：记录导入任务全流程。

字段：

- sourceIdentifier
- sourceResolvedId
- languageCode
- operatorAdminId
- status，值为 running、success、failed、cancelled
- stage，值为 resolveSource、extractDependencies、upsertSharedEntities、upsertPost、finalize
- sourcePayload
- sourcePayloadHash
- resultPostId
- warnings
- errors
- startedAt
- finishedAt
- createdAt
- updatedAt

规则：

- 每次导入都要落 importJobs 记录。
- sourcePayload 只允许保存经过原站内部 URL 相对化后的载荷，禁止原样保存带原站完整域名的数据。
- sourcePayloadHash 必须基于归一化后的 sourcePayload 计算。
- 同一 sourceResolvedId + languageCode 的 running 任务必须加锁，禁止并发导入。

### 4.11 translationMemories

用途：复用重复文本的翻译结果，降低重复调用 AI 的成本。

字段：

- sourceTextHash
- sourceText
- targetLanguageCode
- fieldKind
- translatedText
- provider，固定 google-genai
- model
- approved
- createdAt
- updatedAt

索引：

- sourceTextHash + targetLanguageCode + fieldKind 唯一索引。

### 4.12 aiTranslationLogs

用途：审计每一次 AI 翻译操作。

字段：

- entityType
- entityId
- fieldPath
- languageCode
- sourceHash
- requestPayload
- responsePayload
- normalizedResult
- provider
- model
- promptVersion
- tokenUsage
- success
- errorMessage
- operatorAdminId
- createdAt
- updatedAt

## 5. 导入工作流

### 5.1 后台导入页面

新增页面：/multilingual-admin/import。

页面表单字段：

- sourceIdentifier，支持原文章 ID 或别名。
- languageCode，只允许 en、jp、tw。
- confirmOverwrite，仅当系统检测到已存在记录时才显示。

表单校验：

- sourceIdentifier 必填，string，最大长度 64。
- languageCode 必填，enum(en,jp,tw)。
- confirmOverwrite 为 boolean。

### 5.2 导入流程

导入服务必须严格按以下顺序执行：

1. 校验入参。
2. 调用原站 post/detail 并按 2.2 节规则确认实体存在且类型合法。
3. 取回原文详情数据。
4. 分析文章主数据。
5. 提取作者、分类、标签、地点、封面图远程附件、关联实体、正文内关联实体、正文内媒体 URL。
6. 对原站内部 URL 执行相对路径归一化，对第三方外链保持原样。
7. 生成 sourceHash。
8. 对共享实体和远程附件执行 upsert。
9. 对 post/tweet 关联文章执行 stub 建档或已有记录复用。
10. 对目标多语言文章执行新建或覆盖更新。
11. 落 importJobs 日志。
12. 返回目标文章编辑页跳转信息。

### 5.3 文章关联内容提取清单

导入服务必须把一篇文章中的关联信息拆成三类：

#### A. 文章主体元信息

- title
- excerpt
- content
- alias
- date
- lastChangDate
- author
- sort
- tags
- mappointList
- coverImages
- type

#### B. 详情页推荐相关内容

- bangumiList
- movieList
- gameList
- bookList
- postList
- tweetList
- eventList
- voteList
- seriesSortList

#### C. 正文内强相关内容

- contentBangumiList
- contentMovieList
- contentGameList
- contentBookList
- contentPostList
- contentTweetList
- contentEventList
- contentVoteList
- contentSeriesSortList
- 正文 HTML 中解析出来的 img、video、source、a[href] 等媒体链接

### 5.4 正文媒体提取规则

正文 HTML 必须使用服务端 DOM 解析，不允许正则硬拆整段 HTML。

需要识别的资源前缀：

- /upload
- /content
- /ucloudImg
- /up_works
- /web_demo

处理规则：

- 解析到相对地址时，必须直接保存为相对路径，不允许在数据库中拼接完整原站域名。
- 解析到绝对地址且域名属于原站时，必须剥离域名，仅保存相对路径。
- 解析到第三方外链时，原样保留，并登记为 htmlDiscovered 第三方远程附件或第三方外链。
- 导入阶段从原站识别出的所有媒体都先登记为 remote 类型 attachments。
- 编辑阶段若用户为当前语言上传翻译站附件并替换某个媒体引用，则当前语言文章改引用 localized 类型 attachments，原 remote 附件记录保留。
- 正文中的原站内部 a[href]、img[src]、video[src]、source[src] 等定位符在落库前必须统一改写为相对路径。
- 前台渲染正文时，若检测到原站相对路径资源，则由 sourceAssetResolver 在渲染时拼接 SOURCE_BLOG_PUBLIC_ORIGIN。

### 5.5 重复导入处理规则

若 sourceId + languageCode 已存在：

1. 后台先提示“当前语言文章已存在”。
2. 若用户取消，则终止导入。
3. 若用户确认覆盖：
   - 目标文章 status 立即改为 0。
   - 覆盖所有 source 同步字段。
   - 清空该文章自己的发布校验通过标记。
   - 重新计算 sourceHash。
   - 将该文章 translationStatus 重置为 pending 或 outdated，具体取决于源文本是否变化。
4. 共享实体不直接重复插入，只做 upsert。
5. 共享实体若 sourceHash 未变化，保留现有翻译结果。
6. 共享实体若 sourceHash 已变化，标记为 outdated，要求重新确认后才能用于发布。

## 6. AI 翻译设计

### 6.1 服务约束

- 统一使用 @google/genai 1.50.1。
- 统一封装 GoogleGenAI 单例客户端。
- 若 AI_GATEWAY_URL 有值，则所有 GenAI 请求都必须通过该网关转发。
- AI 输出只接受工具调用结果，不接受自由文本直接落库。

### 6.2 工具调用接口设计

至少实现以下工具声明：

#### submit_translation_segments

用途：提交结构化翻译结果。

入参：

- items: 数组，每项包含 segmentId、translatedText。

校验：

- segmentId 必须与服务端发出的 segment 列表完全对齐。
- translatedText 必须是 string。
- 数量不一致、segmentId 缺失、空值、类型错误全部视为失败。

#### submit_entity_translation_summary

用途：提交本次翻译摘要信息，便于日志审计。

入参：

- entityType
- entityId
- fieldPath
- notes

说明：

- 该工具不直接决定写库结果，只用于辅助日志。

### 6.3 翻译触发点

后台编辑页必须支持以下按钮：

- 翻译标题。
- 翻译摘要。
- 翻译正文。
- 翻译作者信息。
- 翻译分类。
- 翻译标签。
- 翻译地点。
- 翻译远程附件和翻译站附件的名称和描述。
- 翻译 bangumi、movie、game、book、event、vote 关联文本。
- 翻译关联 post、tweet 的共享信息。
- 一键翻译当前文章所有未完成字段。

### 6.4 HTML 翻译规则

正文 HTML 严格按以下策略处理：

1. 先解析 DOM。
2. 只抽取可翻译文本节点和允许翻译的属性值。
3. 不把整段 HTML 原样丢给 AI。
4. 翻译完成后按 segmentId 回填到原 DOM。
5. 重新序列化成 HTML。
6. 保存前再做一次 DOM 可解析校验。

允许抽取的内容：

- p、li、h1-h6、td、th、blockquote、figcaption、a 的文本节点。
- img 的 alt、title。
- 通用元素上的 title、aria-label。

禁止抽取的内容：

- script
- style
- code
- pre
- iframe 的 src
- video 和 source 的 src
- 所有 URL
- data-\* 属性
- 自定义富文本扩展节点中的结构性标识字段

批处理规则：

- 单批次最多 80 个 segment。
- 单批次源文本累计不超过 6000 个字符。
- 超出阈值则自动拆批。

### 6.5 翻译记忆去重策略

#### 共享实体去重

- authors、sorts、tags、mappoints、bangumis、movies、games、books、events、votes 统一通过 sourceId + languageCode 唯一约束复用。
- attachments 采用分类型去重。远程附件通过 sourceId + languageCode + attachmentSourceType、sourcePathHash + languageCode + attachmentSourceType 或 externalUrlHash + languageCode + attachmentSourceType 复用，翻译站附件通过 attachmentGroupKey + languageCode + attachmentSourceType 复用。

#### 正文文本去重

- 所有 HTML 抽取文本先做标准化：trim、合并连续空白、统一换行。
- 使用标准化文本生成 sourceTextHash。
- 若 translationMemories 中存在同 fieldKind + languageCode 的 approved 结果，则直接复用。

#### 关联文章去重

- 关联的 post 与 tweet 统一复用 posts 集合。
- 未完整导入的关联文章只建 stub，不重复建第二份。

## 7. 编辑与人工确认工作流

### 7.1 后台文章列表

新增页面：/multilingual-admin/post/group/list。

列表维度：

- 按 groupSourceId 聚合。
- 每行展示原文章 sourceId、sourceAlias、原类型、en 状态、jp 状态、tw 状态。
- 支持按文章类型、语言状态、发布日期、翻译状态筛选。

### 7.2 后台文章编辑页

新增页面：/multilingual-admin/post/editor/:id。

编辑页必须包含以下区域：

- 基本信息区：sourceId、languageCode、type、status、title、excerpt、alias、date。
- 富文本正文区：复用 RichEditor5。
- 作者区：展示当前 authors 记录，并提供编辑按钮。
- 分类区：展示当前分类并可编辑。
- 标签区：展示标签列表并可编辑。
- 地点区：展示地点列表并可编辑。
- 封面与媒体区：分为远程附件和翻译站附件两个面板，支持查看远程附件、上传当前语言翻译站附件、替换文章引用，并编辑两类附件的名称和描述。
- 关联内容区：按 bangumi、movie、game、book、post、tweet、event、vote 分组展示。
- 正文内关联区：按 contentBangumiList、contentMovieList、contentGameList、contentBookList、contentPostList、contentTweetList、contentEventList、contentVoteList 分组展示。
- AI 操作区：提供分字段和整篇翻译按钮。
- 发布校验区：展示未完成项、过期项、stub 项。
- 原文快照区：展示 sourceSnapshot 和最近一次导入时间。

### 7.3 共享实体编辑规则

- 作者、分类、标签、地点、媒体、关联实体都属于共享实体。
- 翻译站附件虽然是本地文件，但仍按语言维度作为共享媒体实体管理，可被同语言下多个文章复用。
- 所有共享实体都必须提供独立的后台列表页和编辑入口，允许不进入文章编辑页直接维护。
- 文章编辑页中的相关区域只作为快捷入口和上下文入口，不能替代独立管理页。
- 编辑共享实体时，后台必须提示“此修改会影响当前语言下所有引用该实体的文章”。
- 共享实体保存成功后，对当前 languageCode 下所有已发布文章立即生效，不做版本冻结，不自动打回草稿。
- 保存共享实体后，需要刷新相关文章的 validationState。

### 7.4 人工确认规则

- AI 翻译完成后，translationStatus 只能进入 ai_draft。
- 人工修改后，translationStatus 进入 manual_draft。
- 用户点击确认后，translationStatus 才能进入 approved。
- 发布校验只接受 approved 和 not_required。

## 8. 发布工作流

### 8.1 发布前强校验

文章从草稿改为发布前，服务端必须统一执行 publishValidator。

必须校验以下项目：

- type 必须为 1 或 2。
- languageCode 必须为 en、jp、tw。
- title、excerpt、content 必须满足类型要求。
- alias 必须存在且在当前 languageCode 下唯一。
- author 必须存在且 translationStatus 为 approved 或 not_required。
- sort 必须存在且 translationStatus 为 approved 或 not_required。
- tags 全部必须为 approved 或 not_required。
- mappointList 全部必须为 approved 或 not_required。
- coverImages 全部必须为 approved 或 not_required。
- 所有关联实体必须为 approved 或 not_required。
- 所有关联 post、tweet 不允许处于 stub。
- 所有附件引用都必须能解析到合法的 remote 或 localized attachments 记录。
- 若文章使用 localized 类型 attachments，则这些附件必须属于当前 languageCode，且本地文件必须真实存在。
- HTML 回填后的 content 必须可被 DOM 正常解析。
- 正文中的资源定位符必须全部为可解析的原站相对路径、第三方外链 URL 或多语言站本地合法媒体路由。
- 对原站相对路径资源的最终访问地址必须由运行时 resolver 基于 SOURCE_BLOG_PUBLIC_ORIGIN 拼接，不能在数据库中预存。

### 8.2 发布动作

发布成功后必须执行：

- posts.status 从 0 变为 1。
- 写入 publishMeta.publishedAt。
- 刷新该语言下的文章列表缓存。
- 刷新该语言下涉及到的分类、标签、地点列表缓存。
- 刷新 sitemap 和 hreflang 数据缓存。

### 8.3 撤回发布

- 撤回发布后 status 变回 0。
- 保留已翻译内容，不清空正文与关联关系。

## 9. 前台路由与展示方案

### 9.1 语言路由规则

前台只允许以下语言前缀：

- /en
- /jp
- /tw

根路径 / 的处理规则：

- 统一 302 跳转到 siteDefaultLanguageCode。
- siteDefaultLanguageCode 存在数据库 options 中，默认值为 en。

### 9.2 路由清单

必须提供以下公开页面：

- /:lang
- /:lang/post/list
- /:lang/post/list/:page?/:type?
- /:lang/post/:id
- /:lang/post/list/sort/:sortid
- /:lang/post/list/sort/:sortid/:page/:type?
- /:lang/post/list/tag/:tagid
- /:lang/post/list/tag/:tagid/:page/:type?
- /:lang/post/list/mappoint/:mappointid
- /:lang/post/list/mappoint/:mappointid/:page/:type?

说明：

- 路由命名、分页模式、列表逻辑尽量与原博客保持一致。
- 详情页只支持 post 和 tweet。
- page 详情页一期不提供。

### 9.3 前台交互约束

- 不渲染评论区。
- 不渲染点赞、分享、投票提交、浏览计数上报按钮。
- 若文章包含 voteList 或 contentVoteList，只允许渲染只读投票信息卡片，不允许渲染可选择项、提交按钮和结果写入逻辑。
- 若正文或实体中包含原站相对路径资源，前台必须通过统一 resolver 在运行时拼接 SOURCE_BLOG_PUBLIC_ORIGIN。
- 若复用原组件，必须用 feature flag 显式关闭这些区域，不能依赖样式隐藏。

### 9.4 SEO 规则

- 每篇文章详情页必须输出 canonical。
- 同 groupSourceId 下已发布的其他语言版本必须输出 hreflang alternate。
- sitemap 只收录 status=1 的页面。
- sitemap URL 必须带语言前缀。

## 10. 服务端接口计划

### 10.1 后台接口

必须实现以下后台接口组：

- auth
- import
- post
- author
- sort
- tag
- mappoint
- attachment
- bangumi
- movie
- game
- book
- event
- vote
- option
- aiTranslationLog

关键接口最小清单：

- POST /api/admin/login
- POST /api/admin/import/post
- GET /api/admin/import/job/list
- GET /api/admin/post/list
- GET /api/admin/post/detail
- PUT /api/admin/post/update
- POST /api/admin/post/translate-field
- POST /api/admin/post/translate-html
- POST /api/admin/post/translate-all
- POST /api/admin/post/publish
- POST /api/admin/post/unpublish
- GET /api/admin/author/list
- GET /api/admin/author/detail
- PUT /api/admin/author/update
- GET /api/admin/sort/list
- GET /api/admin/sort/detail
- PUT /api/admin/sort/update
- GET /api/admin/tag/list
- GET /api/admin/tag/detail
- PUT /api/admin/tag/update
- GET /api/admin/mappoint/list
- GET /api/admin/mappoint/detail
- PUT /api/admin/mappoint/update
- GET /api/admin/attachment/list
- GET /api/admin/attachment/detail
- POST /api/admin/attachment/upload-localized
- PUT /api/admin/attachment/update
- GET /api/admin/bangumi/list
- GET /api/admin/bangumi/detail
- PUT /api/admin/bangumi/update
- GET /api/admin/movie/list
- GET /api/admin/movie/detail
- PUT /api/admin/movie/update
- GET /api/admin/game/list
- GET /api/admin/game/detail
- PUT /api/admin/game/update
- GET /api/admin/book/list
- GET /api/admin/book/detail
- PUT /api/admin/book/update
- GET /api/admin/event/list
- GET /api/admin/event/detail
- PUT /api/admin/event/update
- GET /api/admin/vote/list
- GET /api/admin/vote/detail
- PUT /api/admin/vote/update
- GET /api/admin/option/list
- PUT /api/admin/option/update
- GET /api/admin/aitranslationlog/list

### 10.2 前台公开接口

多语言站前台读取本地数据库，建议仍沿用 /api/blog 前缀，但每个接口都必须带 languageCode 过滤。

最小清单：

- GET /api/blog/options?lang=en
- GET /api/blog/post/list?lang=en&page=1
- GET /api/blog/post/detail?lang=en&id=alias-or-id
- GET /api/blog/post/archive?lang=en
- GET /api/blog/sort/list?lang=en
- GET /api/blog/sort/detail?lang=en&id=sortid
- GET /api/blog/tag/detail?lang=en&id=tagid
- GET /api/blog/mappoint/detail?lang=en&id=mappointid

明确不提供的公开写接口：

- comment/create
- comment/retract
- post/view/count
- post/share/count
- post/like/log
- comment/like/log
- vote 提交接口

## 11. 配置落点规划

### 11.1 必须放在 env 的配置

符合“长期不常改且缺失会导致服务无法正常启动”的配置，统一进入 env：

- PORT
- DB_HOST
- JSON_LIMIT
- URLENCODED_LIMIT
- MAX_HISTORYLOGS_SIZE
- IP2LOCATION_FILE_NAME
- NITRO_PORT
- NUXT_API_DOMAIN
- SOURCE_BLOG_API_BASE_URL
- SOURCE_BLOG_PUBLIC_ORIGIN
- LOCAL_ATTACHMENT_STORAGE_DIR
- LOCAL_ATTACHMENT_PUBLIC_BASE_PATH
- JWT_SECRET_ADMIN
- GEMINI_API_KEY
- GEMINI_MODEL
- GEMINI_THINKING_BUDGET
- AI_GATEWAY_URL
- INIT_ADMIN_USERNAME
- INIT_ADMIN_PASSWORD
- INIT_ADMIN_NICKNAME

说明：

- SOURCE_BLOG_API_BASE_URL 用于调用原站公开接口。
- SOURCE_BLOG_PUBLIC_ORIGIN 用于在运行时把 /upload、/content 等原站相对路径拼接成最终访问地址。
- LOCAL_ATTACHMENT_STORAGE_DIR 用于存放翻译站附件的本地文件。
- LOCAL_ATTACHMENT_PUBLIC_BASE_PATH 用于生成翻译站附件的公开访问路径。
- 多语言站由于关闭博客侧登录，不需要 JWT_SECRET_BLOG。

### 11.2 必须放在数据库 options 的配置

符合“可以在后台长期调整、调整后无需重启”的配置，统一进 options：

- siteTitle
- siteSubTitle
- siteDescription
- siteKeywords
- siteUrl
- siteLogo
- siteDarkLogo
- siteFavicon
- siteFooterInfo
- siteExtraCss
- siteExtraJs
- siteThemeMode
- siteAllowSwitchTheme
- sitePageSize
- siteTimeZone
- siteShowBlogVersion
- siteEnableSitemap
- siteRobotsTxt
- siteDefaultLanguageCode
- googleAdEnabled
- googleAdId
- googleAdPostBottomEnabled
- googleAdPostBottomParams
- AdAdsTxt
- translationSystemPrompt
- translationHtmlBatchMaxSegments
- translationHtmlBatchMaxChars
- translationRetryLimit

### 11.3 固定写在代码常量中的内容

- 支持语言枚举：en、jp、tw。
- 文章类型白名单：1、2。
- 页面类型禁入：3。
- 后台根路径：/multilingual-admin。
- 原站资源相对路径白名单：/upload、/content、/ucloudImg、/up_works、/web_demo。

## 12. 依赖与版本计划

### 12.1 服务端

- express 4.x，保持与原项目同代。
- mongoose 9.x，保持与原项目同代。
- joi 18.1.2。
- @google/genai 1.50.1。
- async-lock，用于导入与发布加锁。
- cheerio 或等价 DOM 解析库，用于 HTML 文本抽取与回填。

### 12.2 管理端

- vue 3。
- vite。
- element-plus。
- @wangeditor/editor。
- @wangeditor/editor-for-vue。
- joi 18.1.2。

### 12.3 博客端

- nuxt 4。
- @nuxtjs/tailwindcss。
- @nuxtjs/color-mode。
- 复用原项目中已验证的展示依赖。

## 13. 详细实施拆解

### Phase 0：仓库骨架与依赖初始化

- [ ] 按原项目结构创建 admin、blog、server、common 四层目录。
- [ ] 创建根 package.json、build-all.js、README 草稿、example.env。
- [ ] 复制并适配原项目可复用的公共组件和工具函数。
- [ ] 将后台路由基座统一改为 /multilingual-admin。
- [ ] 在 common/constants 中建立语言、状态、类型、资源路径常量。

### Phase 1：共享校验与基础配置

- [ ] 在 common/validation 中建立 Joi schema。
- [ ] 将 import、post update、publish、shared entity update、settings update 全部接入 Joi。
- [ ] 建立服务端 env 加载器与必填项校验器。
- [ ] 建立 options 初始化逻辑与默认值。
- [ ] 初始化谷歌广告配置项和默认语言配置项。
- [ ] 建立 sourceUrlNormalizer 和 sourceAssetResolver，统一处理原站相对路径存储与运行时拼接。

### Phase 2：MongoDB 模型与索引

- [ ] 建立 adminUsers 模型。
- [ ] 建立 authors 模型。
- [ ] 建立 sorts、tags、mappoints、attachments 模型，并完成 remote/local 双类型字段与索引设计。
- [ ] 建立 bangumis、movies、games、books、events、votes 模型。
- [ ] 建立 posts 模型。
- [ ] 建立 importJobs、translationMemories、aiTranslationLogs 模型。
- [ ] 为原站同步实体建立 sourceId + languageCode 唯一索引，并为附件建立 remote/local 分类型唯一索引。
- [ ] 为 posts 建立 alias、列表筛选和分组索引。

### Phase 3：原站公开接口客户端与导入服务

- [ ] 封装 sourceBlogClient。
- [ ] 实现“先 type=[1,2]，后无 type 回查”的类型确认逻辑。
- [ ] 实现原站资源 URL 规范化。
- [ ] 实现文章关联内容提取器。
- [ ] 实现正文内媒体 URL 解析器与远程附件登记逻辑。
- [ ] 实现共享实体 upsert 服务。
- [ ] 实现关联文章 stub 建档逻辑。
- [ ] 实现重复导入确认与覆盖更新逻辑。
- [ ] 接入 importJobs 流程日志。

### Phase 4：AI 翻译服务

- [ ] 建立 GoogleGenAI 单例客户端。
- [ ] 接入 AI_GATEWAY_URL。
- [ ] 建立工具调用定义 submit_translation_segments。
- [ ] 建立文本翻译服务。
- [ ] 建立 HTML 文本抽取、分批、回填服务。
- [ ] 建立 translationMemories 读写逻辑。
- [ ] 建立 aiTranslationLogs 审计逻辑。
- [ ] 为作者、分类、标签、地点、媒体、关联实体、文章正文分别封装翻译入口。

### Phase 5：后台登录与基础管理页面

- [ ] 建立 adminUsers 登录接口。
- [ ] 建立首次启动管理员初始化逻辑。
- [ ] 完成 /multilingual-admin/login。
- [ ] 完成 /multilingual-admin/import。
- [ ] 完成 /multilingual-admin/post/group/list。
- [ ] 完成 /multilingual-admin/post/list。

### Phase 6：后台文章编辑页

- [ ] 复制并接入 RichEditor5。
- [ ] 完成文章基础信息编辑区。
- [ ] 完成作者编辑抽屉。
- [ ] 完成分类、标签、地点编辑抽屉。
- [ ] 完成远程附件与翻译站附件双面板、上传、替换和编辑抽屉。
- [ ] 完成关联实体编辑区。
- [ ] 完成正文内关联实体编辑区。
- [ ] 完成 AI 按钮区。
- [ ] 完成发布校验面板。
- [ ] 完成原文快照查看区。

### Phase 7：共享实体独立管理页

- [ ] 完成 /multilingual-admin/author/list。
- [ ] 完成 /multilingual-admin/sort/list。
- [ ] 完成 /multilingual-admin/tag/list。
- [ ] 完成 /multilingual-admin/mappoint/list。
- [ ] 完成 /multilingual-admin/attachment/list。
- [ ] 完成 /multilingual-admin/bangumi/list。
- [ ] 完成 /multilingual-admin/movie/list。
- [ ] 完成 /multilingual-admin/game/list。
- [ ] 完成 /multilingual-admin/book/list。
- [ ] 完成 /multilingual-admin/event/list。
- [ ] 完成 /multilingual-admin/vote/list。
- [ ] 完成 /multilingual-admin/aitranslationlog/list。

### Phase 8：前台博客端

- [ ] 建立语言前缀路由层。
- [ ] 建立根路径按 siteDefaultLanguageCode 跳转逻辑。
- [ ] 完成 /:lang 首页列表。
- [ ] 完成 /:lang/post/list。
- [ ] 完成 /:lang/post/:id。
- [ ] 完成分类、标签、地点列表页。
- [ ] 接入本地多语言公开接口。
- [ ] 关闭评论、点赞、分享、投票、浏览上报相关 UI 和调用。
- [ ] 接入 hreflang、canonical、sitemap。

### Phase 9：发布、缓存与广告

- [ ] 建立 publishValidator。
- [ ] 建立发布与撤回发布接口。
- [ ] 建立多语言缓存刷新逻辑。
- [ ] 建立站点 options 管理页。
- [ ] 建立翻译站附件本地存储与公开静态访问路径。
- [ ] 建立谷歌广告位开关与参数配置。
- [ ] 输出 ads.txt。

### Phase 10：测试、文档与上线准备

- [ ] 编写导入流程集成测试。
- [ ] 编写 HTML 文本抽取与回填单元测试。
- [ ] 编写发布校验单元测试。
- [ ] 编写重复导入与 stub 处理测试。
- [ ] 编写后台编辑流程端到端测试。
- [ ] 编写前台多语言路由访问测试。
- [ ] 完成 example.env。
- [ ] 完成部署文档。
- [ ] 完成与原站接口依赖说明文档。

## 14. 验收标准

以下条件全部满足，才视为一期完成：

- 管理员可以在 /multilingual-admin 输入原文章 ID 或别名并选择 en、jp、tw 发起导入。
- 页面类型文章会被明确拒绝导入。
- 导入后，文章与关联作者、分类、标签、地点、媒体、关联实体均能在本地库中看到对应语言副本。
- 重复导入时会提示，确认后目标文章回到草稿并覆盖更新。
- 富文本编辑器体验与原后台一致。
- 正文 HTML 翻译不会破坏标签结构。
- 可以为 en、jp、tw 分别替换或上传各自语言专属的翻译站附件，且只影响对应语言文章。
- 修改 SOURCE_BLOG_PUBLIC_ORIGIN 后，不需要迁移数据库即可继续正确解析原站内部资源。
- 共享实体不会因为重复导入产生重复翻译副本。
- 共享实体在后台独立修改后，会立即反映到对应语言下的已发布文章。
- 作者、分类、标签、地点、附件、bangumi、movie、game、book、event、vote 都可以在后台独立管理。
- 发布前能准确指出哪些关联内容尚未完成翻译。
- 发布成功后，可通过 /en、/jp、/tw 访问对应语言文章列表和详情页。
- 分类、标签、地点列表都能在对应语言前缀下独立工作。
- 多语言站不会向原站写入任何评论、点赞、分享、投票、浏览计数数据。
- 谷歌广告配置可在后台 options 中调整并即时生效。

## 15. 风险与规避策略

### 15.1 原站 detail 返回字段不覆盖全部业务字段

规避：

- 一期仅落地原站公开 detail 已返回且前台展示必需的字段。
- 不额外依赖原站私有接口。

### 15.2 HTML 翻译破坏结构

规避：

- DOM 级抽取文本。
- segmentId 回填。
- 保存前二次解析校验。

### 15.3 共享实体修改影响多篇文章

规避：

- 明确采用共享实体模型。
- 共享实体修改后的影响范围在保存前明确提示，并按当前 languageCode 立即作用到已发布文章。
- 后台保存前弹出影响提示。
- 发布校验始终读取实体当前状态。

### 15.4 关联文章未导入导致发布断链

规避：

- 未导入时建立 stub。
- 发布前强制阻止 stub 通过。
- 编辑页提供“导入关联文章”快捷入口。

### 15.5 AI 输出不稳定

规避：

- 只接受工具调用。
- 结果数量、类型、顺序全部由服务端校验。
- 失败后允许按批次重试。

## 16. 本计划的强制执行结论

- 用户表必须拆分为 adminUsers 与 authors，两者职责完全不同。
- 多语言共享实体采用稳定唯一键复用。原站同步实体使用 sourceId + languageCode，附件使用 remote/local 分类型唯一键。
- 共享实体的后台独立修改对对应语言下已发布文章立即生效，不做历史版本冻结。
- 多语言文章全部采用 sourceId 分组，不允许脱离原文章分组单独漂移。
- 前台公开页面只服务本地多语言数据，不在运行期回查原站文章接口。
- 原站作为导入数据源和远程附件来源存在，但所有原站内部资源都只存相对路径，由运行时按 SOURCE_BLOG_PUBLIC_ORIGIN 拼接；多语言站同时支持本地翻译站附件，不依赖原站参与运行期渲染。
