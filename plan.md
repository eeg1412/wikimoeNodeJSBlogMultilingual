# wikimoeNodeJSBlogMultilingual 实施计划

更新时间：2026-04-22

## 1. 目标与硬约束

### 1.1 项目目标

- 基于 wikimoeNodeJSBlog 的现有技术栈，建设一个独立运行的多语言附属站 wikimoeNodeJSBlogMultilingual。
- 在完全不修改 wikimoeNodeJSBlog 项目的前提下，通过其公开博客接口拉取文章与关联数据，完成导入、翻译、编辑、校验、发布和前台展示。
- 多语言附属站必须独立部署、独立数据库、独立后台、独立前台、独立配置。

### 1.2 已确认且必须严格执行的规则

- 技术栈总体延续原项目的 Node.js + Express + MongoDB 主干，但博客端不再使用 Nuxt 4，改为基于 Express 的 EJS 5.0.2 服务端渲染，样式统一使用 TailwindCSS 3.4.17；管理端使用 Vue 3 + Vite，数据库使用 MongoDB。
- 凡涉及对齐、复用、迁移 wikimoeNodeJSBlog 的行为、组件、样式、接口和交互，必须先查阅 https://github.com/eeg1412/wikimoeNodeJSBlog 源码，禁止凭记忆或二手资料推断实现。
- 管理后台访问路径固定为 /multilingual-admin。
- SEO 不是后补优化项，必须作为一级设计目标贯穿路由、ViewModel、模板输出、canonical、hreflang、sitemap、结构化数据和缓存设计。
- 表单校验统一改为 joi 18.1.2。
- AI 翻译统一使用 @google/genai 1.50.1。
- AI 翻译必须采用工具调用模式，不允许直接依赖自由文本输出作为最终写库结果。
- 必须支持后台系统配置项 system.aiGatewayUrl。
- 必须保存原站原始结构化数据，作为未来派生更多语言内容的长期上游来源；命中原站内部域名的 URL 仍按既有规则相对化后再入库。
- 后台 JWT 管理密钥不通过 env 明文提供，服务启动时必须检查 server/secret/JWTSecretAdmin.key；若不存在则自动生成新密钥并写入文件。
- 管理后台必须提供“重新生成后台 JWT 密钥”能力；密钥轮换后所有既有后台 JWT 立即失效。
- 后台所有受保护接口都必须执行 Authorization Bearer JWT 校验、管理员 disabled 校验、pwversion 校验和 role 校验。
- 后台登录必须记录 IP、ipInfo、deviceInfo、成功失败结果与失败原因，并按 IP 维度限制短时间内的失败重试次数。
- 翻译站附件上传必须执行 MIME 白名单、扩展名白名单、文件头校验、大小限制、路径规范化与脚本文件拦截。
- 富文本 HTML 在导入、翻译回填、保存和发布前都必须执行危险标签、危险属性与危险 URL 校验，阻止 XSS 落库与渲染。
- 仅支持导入和翻译博文与推文。
- 页面类型文章必须禁止导入，并给出明确错误提示。
- 附件体系拆分为远程附件和翻译站附件两类。
- 远程附件用于映射原站资源，默认只保存原站相对路径，运行时再拼接原站域名配置。
- 翻译站附件用于存储多语言站本地上传的语言专属媒体文件。
- 当前语言文章可以继续使用远程附件，也可以替换为当前语言的翻译站附件。
- 所有来自原站的内部链接、媒体路径、作者头像路径、作者封面路径、来源快照、导入任务载荷都不允许保存完整原站 URL，只允许保存相对路径；运行时通过 system.sourceBlogPublicOrigin 配置拼接。
- 评论、点赞、分享、浏览计数、投票互动在多语言站全部关闭。
- 投票在翻译站统一按只读信息处理，只展示，不允许提交、不允许写入、不允许统计。
- languageCode 直接使用 en、jp、tw。
- 同一原文加同一语言重复导入时，必须先提示已存在。
- 用户确认重复导入后，目标文章状态强制改为草稿，再执行覆盖更新。
- 作者与管理员必须拆成两张表管理，不能共用 users 表。
- 多语言站需要复制原站作者信息到 authors 表，并支持作者信息翻译流程。
- 每种语言都是独立文章，但必须按原始文章 sourceId 分组。
- 后台所有多语言相关列表页必须统一采用组表展示，父级展示原始数据，子表格展示各语言版本，不允许把不同语言版本平铺成同一层重复行。
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

- 原博客端：Nuxt 4 + TailwindCSS；本项目博客端改为 EJS 5.0.2 + TailwindCSS 3.4.17，保留原有内容组织与视觉语言，不复用 Nuxt 运行时。
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

### 2.3 原项目源码参考准则

- 所有涉及 wikimoeNodeJSBlog 的复用、比对、移植、视觉对齐和行为判断，都必须以 GitHub 仓库 https://github.com/eeg1412/wikimoeNodeJSBlog 的源码为准。
- 若 GitHub 源码中没有找到对应实现，不允许把猜测性的行为描述写入本计划，也不允许把“印象中的原项目行为”当作实现依据。
- RichEditor5、列表与详情页结构、SEO 字段映射、server 侧工具函数、管理端公共组件等复用项，都必须以源码比对结果为准再落地。

### 2.4 博客模板基线落点

- 本项目已经在 blog/template-source/wikimoeToGithubPage/src 内固化一套由 wikimoeToGithubPage 模板链路分析提炼出的博客端模板源，作为后续 EJS SSR 落地的直接基线。
- 该目录不是运行时视图目录，而是“界面结构、前台轻交互、媒体展示、足迹地图、只读投票、SEO 入口”的标准参考面；后续博客端实现必须先对齐该目录，再映射到运行时 blog/views、blog/public/assets 与 server/viewmodels。
- 对博客端模板、DOM 结构、样式层级和轻量脚本的判断，默认优先以本仓库内的 blog/template-source/wikimoeToGithubPage/src 为直接执行依据；只有当该目录未覆盖某个细节时，才回查原项目源码继续比对。
- blog/public/glightbox、blog/public/highlight、blog/public/openlayers 是与该模板源绑定的固定第三方静态资源基线，后续实现不得再改为 CDN 依赖、外部仓库路径引用或临时下载脚本。

## 3. 总体架构

## 3.1 目录结构

项目目录按原项目三端结构拆分，但不引入 workspace 或独立 shared/common 层；公共能力按所属端就近归位，博客端改为“服务端渲染模板层 + 样式构建层”的组合：

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
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  ├─ src/
│  │  └─ styles/
│  ├─ template-source/
│  │  └─ wikimoeToGithubPage/
│  │     └─ src/
│  │        ├─ views/
│  │        ├─ client/
│  │        ├─ styles/
│  │        └─ utils/
│  ├─ views/
│  │  ├─ layouts/
│  │  ├─ partials/
│  │  ├─ pages/
│  │  └─ components/
│  └─ public/
│     ├─ assets/
│     ├─ glightbox/
│     ├─ highlight/
│     └─ openlayers/
├─ server/
│  ├─ package.json
│  ├─ app.js
│  ├─ routes/
│  ├─ api/
│  ├─ constants/
│  ├─ validation/
│  ├─ services/
│  ├─ controllers/
│  ├─ viewmodels/
│  └─ middleware/
```

- 不建立独立 common 目录；服务端写入规则、校验与常量集中放在 server/constants、server/validation 等端内目录，管理端和博客端通过接口契约或各自端内模块消费。

### 3.2 代码复用策略

从 wikimoeNodeJSBlog 可直接复制并在新项目中适配的部分。所有复用工作都必须先对照 GitHub 仓库 https://github.com/eeg1412/wikimoeNodeJSBlog 源码确认后再执行：

- server 侧：路由注册模式、MongoDB utils 模式、JWT 工具、日志配置、缓存配置模式。
- admin 侧：RichEditor5、RichEditorEventSelectorDialog、AttachmentsDialog、ResponsiveTable、ResponsiveTableColumn、IpInfoDisplay、DeviceInfoDisplay、axios API 封装层、登录页骨架。
- blog 侧：文章卡片与详情页的视觉层级、SEO 字段映射规则、颜色模式交互约束、部分可拆分的样式 token 和通用 DOM 结构。
- blog 模板侧：必须复用并持续维护 blog/template-source/wikimoeToGithubPage/src 这套模板源拆分结果，包括 layout、partial、component、page、client script、style baseline 与 view-model contract；后续新页面或重构页面时，不允许重新发明另一套无关的博客视觉体系。
- blog 静态资源侧：GLightbox、highlight.js、OpenLayers 的本地静态目录必须保留在 blog/public 下，由 Express 统一托管，不允许改为运行时从外部地址拼装依赖。

必须重写或显著改造的部分：

- 所有表单校验逻辑，统一切换到 joi 18.1.2。
- 所有文章、作者、分类、标签、地点、关联实体的模型与接口。
- 管理后台路由基座，从 /admin 改为 /multilingual-admin。
- 博客端渲染基座，统一改为 Express Controller + ViewModel + EJS Template 结构。
- 前台路由结构，统一增加语言前缀，并由服务端直接渲染 HTML。
- 所有与评论、点赞、分享、投票、浏览写入相关的接口与前端行为。
- 原后台 users 表相关逻辑，拆分为 adminUsers 和 authors 两套模型。
- AI 翻译服务和 HTML 文本抽取回填服务。

### 3.3 博客端渲染框架

博客端采用“单 Node 进程内的 SSR 页面系统”，不再引入 Nuxt、Nitro、前台独立服务或页面级 hydration 框架。

版本锁定：

- EJS 固定为 5.0.2。
- TailwindCSS 固定为 3.4.17。
- 选择 TailwindCSS 3.4.17 而不是 4.x 的原因是：当前方案以 EJS 模板扫描、PostCSS 构建和稳定的 class dark mode 为核心，3.4.17 的 content 配置、模板扫描行为、插件生态和已有工程经验更成熟，适合先把多语言站 SSR 页面体系落稳，不在一期额外承担 Tailwind 4 配置范式变化的迁移成本。

- 请求链路固定为：语言中间件 -> 页面控制器 -> Query Service -> ViewModel Mapper -> EJS 模板 -> HTML 输出。
- 页面控制器只负责参数校验、语言识别、缓存命中与模板选择；不直接拼装 Mongo 原始数据。
- Query Service 直接读取本地 MongoDB，不允许博客端页面在服务端内部回环调用 /api/blog 自己的 HTTP 接口。
- ViewModel 层负责把 posts、authors、sorts、tags、attachments 等实体整理成模板可直接消费的数据结构，避免在 EJS 中写复杂判断。
- SEO ViewModel 与内容 ViewModel 必须同步生成，title、description、canonical、hreflang、open graph 和结构化数据不允许在模板层临时拼装。
- 模板层采用 layout + partial + page 三级拆分，至少包含 base layout、head、header、footer、post-card、post-detail、entity-panel、vote-readonly-card 等模板片段。
- 模板结构设计必须先对齐 blog/template-source/wikimoeToGithubPage/src/views 的拆分结果；运行时 blog/views 可以做端到端适配，但不允许背离这套模板基线重新组织页面骨架。
- 前台允许的轻量脚本能力固定为：导航下拉、GLightbox 媒体灯箱、代码高亮与复制、足迹地图渲染；这些脚本必须以 blog/template-source/wikimoeToGithubPage/src/client 为基线实现，不允许额外扩展为前台状态管理系统。
- 足迹地图、代码高亮和媒体灯箱依赖固定为 OpenLayers、highlight.js、GLightbox，资源来源固定为 blog/public/openlayers、blog/public/highlight、blog/public/glightbox。
- TailwindCSS 只承担样式生成，不承担路由、状态管理或数据获取职责；前台样式构建产物固定输出到 blog/public/assets/blog.css，由 Express 统一托管，不允许在 blog/public 和 server/public 之间二选一实现。
- Tailwind 的 content 扫描范围固定为 blog/views/**/\*.ejs、blog/src/**/_.js、server/viewmodels/\*\*/_.js；若后续模板类名进入其他目录，必须先修改本计划后再扩展扫描范围，不允许实现时自行猜测。
- 前台不引入客户端框架；一期只允许原生脚本处理颜色模式切换和广告位延迟加载，不允许额外加入页面级 hydration、前台状态管理、客户端路由或“必要交互增强”这类未定义范围的脚本逻辑。
- 页面首屏内容必须由服务端完整输出，前台 JSON 接口仅作为补充能力，不作为首屏渲染主链路。

## 4. 数据模型设计

### 4.1 统一字段规则

除 adminUsers、importJobs、aiTranslationLogs、translationMemories 外，其余多语言业务集合统一遵守以下规则：

- 除 attachments 集合中 attachmentSourceType=localized 的记录外，其余受本节约束的业务集合都必须包含 sourceId 字段，用于记录原站对应实体 ID；本计划不存在其他 sourceId 例外集合。
- 必须包含 languageCode 字段，值只允许 en、jp、tw。
- 必须包含 sourceSnapshot 字段，用于保存最近一次来源快照。原站同步实体保存经过“原站内部 URL 相对化”后的快照，翻译站附件保存本地上传快照。
- sourceSnapshot 是归一化后的业务快照，不等同于原始数据主档；原站原始结构化数据必须额外独立保存。
- 必须包含 sourceHash 字段，用于检测来源内容是否变化。原站同步实体保存相对路径归一化后的原文哈希，翻译站附件保存文件与元数据哈希。
- 必须包含 translationStatus 字段。
- translationStatus 取值固定为：pending、ai_draft、manual_draft、approved、not_required、stub、outdated。
- 必须包含 createdAt、updatedAt。
- 所有“共享实体”必须通过稳定唯一键做唯一约束。原站同步实体使用 sourceId + languageCode，翻译站附件使用 attachmentGroupKey + languageCode + attachmentSourceType。
- 所有原站来源数据在写入数据库前都必须先经过 sourceUrlNormalizer，把命中原站域名的内部 URL 统一转换为相对路径。
- 原始数据主档必须保留原站字段结构、原文字段值和关联关系，供未来新增语言时直接派生，不允许只保留已经拆解过的多语言业务字段。

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
- adminUsers.password 必须使用 bcrypt 哈希存储，不允许保存明文或可逆密文。
- 管理员修改密码后必须递增 pwversion，用于使旧 JWT 立即失效。

### 4.2.1 adminLoginLogs

用途：记录后台登录成功与失败事件，并为登录风控提供数据基础。

字段：

- username
- adminId，失败时可为空
- IP
- ipInfo
- deviceInfo
- success
- reason
- createdAt

索引：

- IP + createdAt 组合索引。
- username + createdAt 组合索引。
- success + createdAt 组合索引。

规则：

- 每次后台登录尝试都必须写入 adminLoginLogs，不允许只记录成功不记录失败。
- 登录失败限流必须基于 adminLoginLogs 统计，不允许只靠进程内内存计数。
- adminLoginLogs 不保存明文密码、JWT 原文或完整密钥内容。

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
- languageCode + alias 唯一索引；当 alias 为空时不写入该字段，不参与唯一约束，不允许以空字符串占位。

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
- 原站资源型远程附件在渲染阶段通过 sourceAssetResolver 使用 system.sourceBlogPublicOrigin 与相对路径拼接最终访问地址。
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

### 4.10 sourceContents

用途：保存原站原始结构化数据主档，作为未来派生任意语言内容的稳定上游来源。

字段：

- sourceId
- sourceAlias
- sourceType
- sourcePayload
- sourcePayloadHash
- fetchedAt
- lastImportedAt
- createdAt
- updatedAt

索引：

- sourceId 唯一索引。
- sourceAlias 普通索引。
- sourceType + updatedAt 组合索引。

规则：

- sourcePayload 必须保留原站 detail 返回的原始字段结构、原文字段值和关联关系，供未来新增语言时复用。
- 命中原站内部域名的 URL 在写入 sourcePayload 前仍需先相对化，以满足全局 URL 存储约束；除该安全归一化外，不对原文内容做裁剪、翻译或重排。
- 每次导入或刷新同一 sourceId 时，必须先 upsert sourceContents，再从 sourceContents 派生共享实体和语言文章。
- sourceContents 只作为上游主档，不直接承担前台渲染或后台编辑结果写入目标。

### 4.11 importJobs

用途：记录导入任务全流程。

字段：

- sourceIdentifier
- sourceResolvedId
- languageCode
- operatorAdminId
- status，值为 running、success、failed、cancelled
- stage，值为 resolveSource、persistSourceContent、extractDependencies、upsertSharedEntities、upsertPost、finalize
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

### 4.12 translationMemories

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

### 4.13 aiTranslationLogs

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
4. 将原站原始结构化载荷按 sourceContents 规则持久化，保留原始字段结构、原文字段值和关联关系。
5. 基于 sourceContents 分析文章主数据。
6. 提取作者、分类、标签、地点、封面图远程附件、关联实体、正文内关联实体、正文内媒体 URL。
7. 对原站内部 URL 执行相对路径归一化，对第三方外链保持原样。
8. 生成 sourceHash。
9. 对共享实体和远程附件执行 upsert。
10. 对 post/tweet 关联文章执行 stub 建档或已有记录复用。
11. 对目标多语言文章执行新建或覆盖更新。
12. 落 importJobs 日志。
13. 返回目标文章编辑页跳转信息。

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
- 解析到 javascript:、data:text/html、vbscript: 等危险协议时，必须直接拒绝写入并记为导入错误。
- 导入阶段从原站识别出的所有媒体都先登记为 remote 类型 attachments。
- 编辑阶段若用户为当前语言上传翻译站附件并替换某个媒体引用，则当前语言文章改引用 localized 类型 attachments，原 remote 附件记录保留。
- 正文中的原站内部 a[href]、img[src]、video[src]、source[src] 等定位符在落库前必须统一改写为相对路径。
- 前台渲染正文时，若检测到原站相对路径资源，则由 sourceAssetResolver 在渲染时拼接 system.sourceBlogPublicOrigin。

### 5.5 重复导入处理规则

若 sourceId + languageCode 已存在：

1. 后台先提示“当前语言文章已存在”。
2. 若用户取消，则终止导入。
3. 若用户确认覆盖：
   - 目标文章 status 立即改为 0。
   - 覆盖所有 source 同步字段。
   - 清空该文章自己的发布校验通过标记。
   - 重新计算 sourceHash。
   - 同步刷新 sourceContents.sourcePayload、sourcePayloadHash 和 lastImportedAt。
   - 将该文章 translationStatus 重置为 pending 或 outdated，具体取决于源文本是否变化。
4. 共享实体不直接重复插入，只做 upsert。
5. 共享实体若 sourceHash 未变化，保留现有翻译结果。
6. 共享实体若 sourceHash 已变化，标记为 outdated，要求重新确认后才能用于发布。

## 6. AI 翻译设计

### 6.1 服务约束

- 统一使用 @google/genai 1.50.1。
- 统一封装 GoogleGenAI 单例客户端。
- @google/genai 的客户端初始化、模型调用、函数调用、错误处理与可选能力设计，必须以 https://googleapis.github.io/js-genai/release_docs/index.html 为唯一基准文档，不允许凭经验猜测 SDK 参数结构或沿用旧版 Google AI SDK 写法。
- 计划落地时必须显式核对官方 release docs 中的 Initialization、Function Calling、Error Handling 章节；若文档与既有经验冲突，以文档为准。
- 必须支持后台系统配置项 aiGatewayUrl；若有值，则所有 GenAI 请求都必须通过该网关转发。
- Gemini 凭据、模型、网关与翻译批处理策略属于后台系统配置，不属于启动引导 env。
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

- 按 groupSourceId 聚合，以 sourceContents 原始数据主档作为父级。
- 父表行展示原文章 sourceId、sourceAlias、原类型、原始标题、最近抓取时间和原始数据哈希。
- 展开的子表格展示 en、jp、tw 对应文章的 status、translationStatus、更新时间、发布时间和编辑入口。
- 支持按文章类型、语言状态、发布日期、翻译状态筛选。

### 7.1.1 组表 UI 规则

- 所有涉及多语言实体的后台列表页统一采用“父表 + 子表格”的组表 UI，不允许把原始数据和各语言版本混排为单层重复行。
- 父级表格负责展示原始数据主档或原文快照，子表格按 en、jp、tw 展示语言化记录、状态和操作按钮。
- 文章列表的父级数据来自 sourceContents；作者、分类、标签、地点、附件和关联实体列表的父级数据来自各自的原文快照或原始数据主档。
- 父表与子表都必须使用 ResponsiveTable 和 ResponsiveTableColumn 组件实现，确保小屏设备可读性。

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
- 原文快照区：展示 sourceSnapshot、sourceContents 原始主档摘要和最近一次导入时间。

### 7.3 共享实体编辑规则

- 作者、分类、标签、地点、媒体、关联实体都属于共享实体。
- 翻译站附件虽然是本地文件，但仍按语言维度作为共享媒体实体管理，可被同语言下多个文章复用。
- 所有共享实体都必须提供独立的后台列表页和编辑入口，允许不进入文章编辑页直接维护。
- 共享实体独立列表页同样必须采用组表 UI，父级展示原始数据，子表格展示各语言版本。
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
- title 必须为去首尾空白后的非空字符串。
- excerpt 必须为字符串；允许为空字符串，但不允许为 null、数组、对象或其他非字符串类型。
- content 必须为字符串；在 HTML 安全清洗完成后，正文必须仍然至少包含可见文本节点、合法媒体节点或合法只读关联信息节点之一。
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
- HTML 回填后的 content 必须通过 HTML 安全清洗，不允许保留 script、object、embed、form、内联事件处理器或危险协议 URL。
- 正文中的资源定位符必须全部为可解析的原站相对路径、第三方外链 URL 或多语言站本地合法媒体路由。
- localized 附件的 storagePath 必须位于 LOCAL_ATTACHMENT_STORAGE_DIR 内，禁止路径穿越或越权引用其他本地文件。
- 对原站相对路径资源的最终访问地址必须由运行时 resolver 基于 system.sourceBlogPublicOrigin 拼接，不能在数据库中预存。

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

## 9. 博客端渲染、路由与展示方案

### 9.1 博客端运行方式

- 博客端统一由 Express 挂载 EJS 视图引擎进行服务端渲染，不单独启动 Nuxt 或 Nitro 进程。
- 请求先进入语言识别中间件，再进入页面控制器；页面控制器直接调用本地 Query Service，禁止通过 HTTP 自调 /api/blog。
- TailwindCSS 3.4.17 通过独立构建脚本产出单份前台样式文件，模板只消费编译结果，不在运行时动态生成样式。
- EJS 模板必须按 layout、partial、page、component 四层组织，避免把页面逻辑和展示逻辑混杂在单文件里。
- 颜色模式采用“服务端输出初始主题 class + 客户端极小脚本持久化”的方式实现，不引入前台框架状态管理。

### 9.2 语言路由规则

前台只允许以下语言前缀：

- /en
- /jp
- /tw

根路径 / 的处理规则：

- 统一 302 跳转到 site.defaultLanguageCode。
- site.defaultLanguageCode 存在数据库站点配置中，默认值为 en。

### 9.3 路由清单

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

- 路由命名、分页模式、type 过滤语义和列表筛选行为以本节列出的路径与参数规则为唯一实现依据；若原博客实现与本计划不一致，以本计划为准，不允许额外补充同义路径。
- :page 缺失时默认按 1 处理，只允许正整数。
- :type 缺失时表示同时查询 type=1 和 type=2；若提供值，则只允许 1 或 2。
- :id 在详情页中先按当前 languageCode 下的 posts.alias 查询，未命中再按当前语言文章本地 \_id 查询；前台详情路由不允许把 sourceId 暴露为公开路径参数。
- :sortid、:tagid、:mappointid 只按当前 languageCode 下的本地实体 \_id 解析，不允许跨语言复用 sourceId 作为前台列表路由参数。
- 详情页只支持 post 和 tweet。
- page 详情页一期不提供。

### 9.4 页面模板结构

博客端至少拆分为以下模板层级：

- layouts/base.ejs：统一 head、主题 class、公共 meta、静态资源引入。
- partials/head.ejs：title、description、canonical、hreflang、open graph、结构化数据入口。
- partials/header.ejs 与 partials/footer.ejs：站点级公共框架，不提供语言切换器。
- partials/page-scripts.ejs 或等价脚本入口：统一注入年份脚本、GLightbox、highlight.js、OpenLayers 与页面级轻量脚本。
- components/post-card.ejs：普通文章与推文列表卡片。
- components/tags-and-mappoints.ejs：标签与地点链接片段。
- components/media-grid.ejs：单图、多图、视频与全景媒体栅格。
- components/entity-panel.ejs：bangumi、movie、game、book、event、vote 等关联信息块。
- components/vote-readonly-card.ejs：只读投票卡片，明确无交互入口。
- components/media-card.ejs：bangumi、movie、game、book 等媒体卡片。
- pages/home.ejs、pages/post-list.ejs、pages/post-detail.ejs、pages/entity-cloud.ejs、pages/media-collection.ejs、pages/footprints.ejs：实际页面模板。

模板设计要求：

- 复杂条件判断、URL 拼接、状态翻译必须前移到 ViewModel 层，EJS 内只保留轻量分支。
- 原站相对路径资源在进入模板前必须先过 sourceAssetResolver，模板只消费可直接渲染的最终地址或解析结果。
- EJS 默认必须使用转义输出；只有经过安全清洗且通过发布校验的 content HTML 字段允许使用非转义输出。
- 移动端和暗黑模式为默认设计约束，不作为后补适配。
- 若后续博客端实现与 blog/template-source/wikimoeToGithubPage/src 的模板源发生偏差，必须先回补 template-source 或先修改本计划，再进行运行时模板调整，不允许直接绕开模板源落地。

### 9.5 前台交互约束

- 不渲染评论区。
- 不渲染点赞、分享、投票提交、浏览计数上报按钮。
- 若文章包含 voteList 或 contentVoteList，只允许渲染只读投票信息卡片，不允许渲染可选择项、提交按钮和结果写入逻辑。
- 若正文或实体中包含原站相对路径资源，前台必须通过统一 resolver 在运行时拼接 system.sourceBlogPublicOrigin。
- 博客端不提供语言切换器；访问什么语言路径，就只渲染该语言内容。
- 若复用原组件或原模板结构，互动相关区域必须在服务端模板分支层直接不渲染，不允许引入单独 feature flag 系统，也不能依赖样式隐藏或前端脚本卸载。

### 9.6 SEO 优先设计与缓存规则

- SEO 属于一期主链路，不是上线前的附加优化；首页、列表页、详情页、分类页、标签页和地点页都必须有各自独立的 SEO 输出。
- SEO 字段必须在服务端 ViewModel 阶段生成，包括 title、description、canonical、hreflang、open graph、twitter card 和结构化数据，不允许在客户端补写首屏 SEO。
- 每篇文章详情页必须输出 canonical。
- 同 groupSourceId 下已发布的其他语言版本必须输出 hreflang alternate。
- sitemap 只收录 status=1 的页面。
- sitemap URL 必须带语言前缀。
- 分页列表页必须输出与当前分页一致的 canonical 和可用的分页 SEO 元数据，不允许所有分页页共用第一页 SEO。
- 列表页与详情页的 meta、open graph、结构化数据由服务端渲染时直接输出，不依赖客户端二次补写。
- EJS 页面缓存与 /api/blog 只读数据缓存统一复用同一组语言维度缓存键，避免页面和接口缓存不一致。

## 10. 服务端接口计划

### 10.1 后台接口

必须实现以下后台接口组：

- auth
- security
- adminLoginLog
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
- PUT /api/admin/security/admin-jwt-secret/regenerate
- GET /api/admin/adminloginlog/list
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

### 10.2 后台认证与安全约束

- 除登录接口外，所有 /api/admin/\* 接口默认要求 Authorization: Bearer <token>。
- 鉴权链路必须依次校验：JWT 签名、token version、adminUsers 是否存在、disabled 是否为 false、pwversion 是否匹配当前数据库记录。
- 角色不足必须返回统一“权限不足”错误，不允许静默降级执行。
- 重新生成后台 JWT 密钥接口只能由最高权限管理员调用，并且必须写入结构化安全审计日志。
- 登录接口必须按 IP 维度做失败次数限制，默认设计为“窗口期 + 最大失败次数”双参数，可通过后台系统配置调整。
- import、publish、translate-all、attachment upload-localized、admin-jwt-secret regenerate 等高风险接口必须追加限流或加锁策略，避免暴力调用和并发踩踏。

### 10.3 前台公开接口

EJS 页面渲染主链路直接读取本地服务层，不通过 HTTP 自调；/api/blog 仅保留为只读公开数据接口，用于轻量异步场景、调试或后续扩展，但不是页面首屏渲染的数据来源。所有接口都必须带 languageCode 过滤。

最小清单：

- GET /api/blog/options?lang=en
- GET /api/blog/post/list?lang=en&page=1
- GET /api/blog/post/detail?lang=en&id=alias-or-id
- GET /api/blog/post/archive?lang=en
- GET /api/blog/sort/list?lang=en
- GET /api/blog/sort/detail?lang=en&id=sortid
- GET /api/blog/tag/detail?lang=en&id=tagid
- GET /api/blog/mappoint/detail?lang=en&id=mappointid

参数语义固定为：

- post/detail 的 id 解析顺序与第 9.3 节详情页一致：先 alias，后当前语言文章本地 \_id，不允许接受 sourceId。
- sort/detail、tag/detail、mappoint/detail 的 id 只接受当前 languageCode 下的本地实体 \_id，不接受 sourceId，不做跨语言回退。

明确不提供的公开写接口：

- comment/create
- comment/retract
- post/view/count
- post/share/count
- post/like/log
- comment/like/log
- vote 提交接口

## 11. 配置分层设计

配置必须拆成四层：启动引导 env、后台系统配置、站点展示配置、代码常量。判断标准很简单：缺失后会导致服务无法启动的，才允许进入 env；缺失后只是某项业务暂不可用或需要后台补齐的，必须放到后台配置，不允许偷懒塞进 env。

本计划中的 example.env 不是“通用部署模板”，而只是“启动引导最小样例”。生成器、实现者或后续 AI 不允许因为原项目存在更多运行参数，就把旧项目的 env 变量整包迁移到本项目的 example.env。

数据库配置固定采用带命名空间和可见性控制的 settings/options 结构：

- system.\*：后台可改、仅服务端可读、可包含敏感字段。
- site.\*：后台可改、服务端可读、其中允许前台消费的字段可进入模板渲染或 /api/blog/options。
- isSecret=true 的字段必须密文存储、后台接口只返回掩码值、操作日志记录更新人和更新时间。

强制实现边界：

- 根目录 env 体系只承担第 11.1 节定义的 5 个启动引导级键；本项目不设计第二套“业务 env”“前台公开 env”或“子应用专属 env”作为配置来源。
- 除第 11.1 节定义的 5 个键外，服务端、管理端、博客端代码都不得把 process.env 作为业务配置读取入口；不得新增 SOURCE*BLOG*\_、GEMINI\__、AI*GATEWAY_URL、JWT_SECRET_ADMIN、NUXT*_、NITRO\__、NUXT*PUBLIC*_、VITE\_\_ 一类同义变量作为旁路配置源。
- 第 11.2 节和第 11.3 节中的默认值只能通过数据库初始化逻辑写入 settings/options 集合，不允许通过 env 回填，不允许通过第二份配置文件回填，也不允许在运行时偷偷退回硬编码业务值。
- 若第 11.2 节或第 11.3 节中的某项配置尚未设置，系统行为只能是“服务可启动，但对应功能显式不可用或按数据库默认记录运行”，不允许自动改读 env 兜底。

### 11.1 启动引导级 env

只有缺失后服务应直接拒绝启动的部署引导项进入 env：

- DB_HOST，MongoDB 连接串。
- LOCAL_ATTACHMENT_STORAGE_DIR，翻译站附件本地存储根目录。
- INIT_ADMIN_USERNAME，首次初始化管理员账号。
- INIT_ADMIN_PASSWORD，首次初始化管理员密码。
- INIT_ADMIN_NICKNAME，首次初始化管理员昵称。

说明：

- example.env 中只允许出现以上 5 个赋值键。允许写注释，但不允许出现重复键、不允许出现空壳占位键、不允许追加第 11.2 节、第 11.3 节和第 11.5 节中的任何键。
- PORT、JSON_LIMIT、URLENCODED_LIMIT、日志大小上限等运行参数不属于启动引导 env。它们在一期实现中固定由代码默认配置层处理，不出现在 example.env；任何实现若想把这些项重新开放为 env，必须先修改本计划，不能自行扩展。
- 后台 JWT 密钥不进入 env，不进入数据库，不进入 example.env，而是固定采用 secret 目录下的密钥文件机制。
- 原站数据源、AI 翻译、站点 SEO、广告等业务配置均不属于启动引导项，不能放在 env。
- 因博客端已改为单 Express 进程内的 EJS SSR，本项目不存在 Nuxt/Nitro 独立运行时配置，也不存在 Vite 前台公开 env 方案；任何 NUXT*\*、NITRO*_、NUXT*PUBLIC*_、VITE\_\* 变量出现在 example.env 都视为违反本计划。
- 以下键名或同类键名出现在 example.env，均视为错误实现：SOURCE_BLOG_API_BASE_URL、SOURCE_BLOG_PUBLIC_ORIGIN、GEMINI_API_KEY、GEMINI_MODEL、GEMINI_THINKING_BUDGET、AI_GATEWAY_URL、JWT_SECRET_ADMIN、LOCAL_ATTACHMENT_PUBLIC_BASE_PATH、SITE_URL、SITE_TITLE、GOOGLE_AD_CLIENT_ID。

### 11.2 后台系统配置

这类配置由管理员在后台维护，保存在数据库中，仅服务端读取，不允许通过前台公开接口暴露：

- system.sourceBlogApiBaseUrl，原站公开接口基地址。
- system.sourceBlogPublicOrigin，原站静态资源访问域名，用于运行时拼接相对路径。
- system.sourceBlogRequestTimeoutMs，原站接口请求超时。
- system.aiTranslationEnabled，AI 翻译总开关。
- system.aiProvider，固定为 google-genai。
- system.aiModel，当前翻译模型。
- system.aiApiKey，Gemini Developer API 凭据，密文存储。
- system.aiApiVersion，可选，显式控制 @google/genai 调用的 API 版本。
- system.aiGatewayUrl，可选，若配置则所有 GenAI 请求走网关。
- system.aiThinkingBudget，可选，按模型能力启用。
- system.translationSystemPrompt，翻译系统提示词。
- system.translationHtmlBatchMaxSegments，HTML 翻译单批最大 segment 数。
- system.translationHtmlBatchMaxChars，HTML 翻译单批最大字符数。
- system.translationRetryLimit，翻译失败重试次数。
- system.adminTokenDefaultTtlHours，后台默认登录时长。
- system.adminTokenRememberMeTtlDays，后台记住登录时长。
- system.adminLoginAttemptWindowMinutes，后台登录失败统计窗口。
- system.adminLoginMaxAttempts，后台登录失败最大次数。

设计要求：

- 原站数据源与 AI 翻译都属于“可在后台调整的业务系统配置”，不是部署引导参数。
- system.aiApiKey、system.aiGatewayUrl 等敏感字段必须支持单独更新、掩码回显和审计日志。
- 若 system.sourceBlogApiBaseUrl 或 system.aiApiKey 未配置，系统仍可启动，但相关导入或翻译功能必须在后台显式提示“未配置，不可用”。
- system.adminTokenDefaultTtlHours、system.adminTokenRememberMeTtlDays、system.adminLoginAttemptWindowMinutes、system.adminLoginMaxAttempts 属于安全策略配置，只允许高权限管理员修改。
- 本节中的“可选”只表示该数据库字段允许为空或按数据库默认记录运行，不表示允许迁移到 env，也不表示允许新增第二配置源。
- 第 11.2 节中的字段不得以平铺 env 变量形式出现在 example.env，也不得在代码中通过同义 process.env 键读取；初始化值一律通过数据库初始化逻辑写入。
- 除本计划已经显式给出默认值的字段外，数据库初始化器不得臆造真实业务值；原站接口地址、原站公开域名、AI API Key、AI 模型名、AI 网关地址、广告参数等在首次初始化时都必须保持“未配置”状态，由管理员后续填写。

### 11.3 站点展示与运营配置

这类配置同样存数据库，但职责是控制博客端输出效果与运营行为，其中允许公开给前台消费的字段可进入 /api/blog/options：

- site.title
- site.subTitle
- site.description
- site.keywords
- site.url
- site.favicon
- site.footerInfo
- site.extraCss
- site.extraJs
- site.themeMode
- site.allowSwitchTheme
- site.pageSize
- site.timeZone
- site.enableSitemap
- site.robotsTxt
- site.defaultLanguageCode
- site.showBlogVersion
- site.googleAdEnabled
- site.googleAdClientId
- site.googleAdPostBottomEnabled
- site.googleAdPostBottomParams
- site.adsTxtContent

说明：

- 本项目明确不需要 logo 图片，因此不设计 siteLogo、siteDarkLogo 一类配置。
- site.url 用于 canonical、hreflang、sitemap 等 SEO 输出，不属于启动引导项。
- 站点展示配置允许后台即时修改并生效，不应要求重启服务。
- 第 11.3 节中的字段若需要首次默认值，必须由数据库初始化逻辑写入 site.\_ 记录，不允许回退为 SITE\_\_、VITE\_\* 或其他 env 变量。
- 除本计划已经显式给出默认值的字段外，site.\* 初始化时不得猜测站点标题、站点域名、广告位参数或其他运营值；缺什么就保持空值或关闭状态，等待后台填写。

### 11.4 固定写在代码常量中的内容

- 支持语言枚举：en、jp、tw。
- 文章类型白名单：1、2。
- 页面类型禁入：3。
- 后台根路径：/multilingual-admin。
- 原站资源相对路径白名单：/upload、/content、/ucloudImg、/up_works、/web_demo。
- 本地上传附件 MIME 白名单与扩展名白名单。
- 富文本内容禁止标签与危险协议白名单策略。
- 前台固定关闭的功能：评论、点赞、分享、投票提交、浏览计数上报、语言切换器。

### 11.5 密钥与安全控制基线

- 后台 JWT 密钥固定存放于 server/secret/JWTSecretAdmin.key，启动时执行 ensure 逻辑：目录不存在则先创建，文件不存在则生成新密钥，再加载到进程内存中使用。
- 新密钥必须通过安全随机源生成，不允许使用固定字符串、项目名哈希或可预测默认值兜底。
- 密钥文件写入后必须限制文件权限，避免被静态目录、日志、接口或仓库提交暴露。
- 管理后台提供“重新生成后台 JWT 密钥”操作，但该操作必须要求高权限、二次确认，并写入结构化安全审计日志。
- 重新生成后台 JWT 密钥后，服务端必须立即替换内存中的密钥引用，并让既有后台 token 全部失效。
- 管理员改密时必须递增 pwversion；鉴权中只要发现 token 中的 pwversion 与数据库不一致，就必须拒绝通过。
- 后台登录必须记录 adminLoginLogs，登录失败限流基于数据库日志统计，不依赖单进程内存状态。
- EJS 模板默认必须使用转义输出；只有经过清洗并通过发布校验的 content HTML 字段允许使用非转义输出。
- 翻译站附件上传必须验证文件头与 MIME 是否匹配，storagePath 必须规范化并限制在 LOCAL_ATTACHMENT_STORAGE_DIR 之内，禁止路径穿越。
- 发布前必须执行 HTML 安全校验，拒绝 script、object、embed、form、内联事件处理器和 javascript: 等危险内容。

## 12. 依赖与版本计划

### 12.1 服务端

- express 4.x，保持与原项目同代。
- ejs 5.0.2，用于博客端服务端模板渲染。
- helmet，用于基础安全响应头。
- mongoose 9.x，保持与原项目同代。
- joi 18.1.2。
- @google/genai 1.50.1，落地时必须以官方 release docs 为准，重点核对 Initialization、Function Calling、Error Handling 章节。
- async-lock，用于导入与发布加锁。
- sanitize-html 或等价 HTML 安全清洗库，用于正文与翻译回填结果的安全过滤。
- file-type 或等价文件头识别库，用于 localized 附件上传时的 MIME 校验。
- cheerio 或等价 DOM 解析库，用于 HTML 文本抽取与回填。

### 12.2 管理端

- vue 3。
- vite。
- element-plus。
- tailwindcss 3.4.17。
- @wangeditor/editor。
- @wangeditor/editor-for-vue。
- joi 18.1.2。

### 12.3 博客端

- tailwindcss 3.4.17。
- postcss 8.x，与 TailwindCSS 3.4.17 配套。
- autoprefixer 10.x，与 TailwindCSS 3.4.17 配套。
- EJS 模板体系，不引入 Nuxt、Nitro 或前台 SPA 框架。
- 复用原项目中已验证的展示依赖与样式语言，但按 EJS 模板方式重组。
- GLightbox，本地静态资源目录固定为 blog/public/glightbox。
- highlight.js，本地静态资源目录固定为 blog/public/highlight。
- OpenLayers，本地静态资源目录固定为 blog/public/openlayers。

## 13. 详细实施拆解

### Phase 0：仓库骨架与依赖初始化

- [ ] 按原项目结构创建 admin、blog、server 三层目录，并将公共规则按端内归位，不新增独立 common 层。
- [ ] 建立博客端 EJS 模板目录、Tailwind 构建目录和静态资源目录。
- [ ] 在 blog/template-source/wikimoeToGithubPage/src 中固化模板基线，至少包含 views、client、styles、utils 四层内容，供后续 SSR 实现持续对照。
- [ ] 锁定 ejs 5.0.2、tailwindcss 3.4.17，并确定 Tailwind content 扫描范围覆盖 EJS 模板与相关 ViewModel 文件。
- [ ] 创建根 package.json、build-all.js、README 草稿、example.env，其中 example.env 只能包含第 11.1 节定义的 5 个启动引导级键，且不得为 system._、site._ 或安全策略补充任何旁路 env。
- [ ] 复制并适配原项目可复用的公共组件和工具函数。
- [ ] 将 GLightbox、highlight.js、OpenLayers 的静态资源复制到 blog/public 对应目录，确保博客端运行时不依赖外部仓库目录或 CDN。
- [ ] 建立 server/secret 目录约定、管理员 JWT 密钥文件 ensure 逻辑与密钥轮换入口设计。
- [ ] 将后台路由基座统一改为 /multilingual-admin。
- [ ] 在 server/constants 中建立语言、状态、类型、资源路径常量。

### Phase 1：共享校验与基础配置

- [ ] 在 server/validation 中建立 Joi schema。
- [ ] 将 import、post update、publish、shared entity update、settings update 全部接入 Joi。
- [ ] 建立服务端 env 加载器与必填项校验器，只读取第 11.1 节定义的启动引导级键，并拒绝把其他业务键接入 process.env 读取链路。
- [ ] 建立带命名空间的 settings/options 初始化逻辑、默认值和密文字段存储方案；第 11.2 节和第 11.3 节的默认值只能从这里写入数据库。
- [ ] 初始化原站数据源、AI 翻译、站点 SEO、广告和默认语言配置项的数据库默认记录，不从 env 回填这些值，也不臆造原站地址、模型名、广告参数等真实业务值。
- [ ] 建立安全响应头、中间件级鉴权链路与敏感配置掩码回显规则。
- [ ] 建立 sourceUrlNormalizer 和 sourceAssetResolver，统一处理原站相对路径存储与运行时拼接。

### Phase 2：MongoDB 模型与索引

- [ ] 建立 adminUsers 模型。
- [ ] 建立 adminLoginLogs 模型，并为登录限流与审计建立索引。
- [ ] 建立 authors 模型。
- [ ] 建立 sorts、tags、mappoints、attachments 模型，并完成 remote/local 双类型字段与索引设计。
- [ ] 建立 bangumis、movies、games、books、events、votes 模型。
- [ ] 建立 posts 模型。
- [ ] 建立 sourceContents 原始数据主档模型，用于保存原站原始结构化数据并支撑未来新增语言派生。
- [ ] 建立 importJobs、translationMemories、aiTranslationLogs 模型。
- [ ] 为原站同步实体建立 sourceId + languageCode 唯一索引，并为附件建立 remote/local 分类型唯一索引。
- [ ] 为 posts 建立 alias、列表筛选和分组索引。

### Phase 3：原站公开接口客户端与导入服务

- [ ] 封装 sourceBlogClient。
- [ ] 实现“先 type=[1,2]，后无 type 回查”的类型确认逻辑。
- [ ] 实现 sourceContents 原始数据主档 upsert，并建立“先保存原始数据，再派生多语言实体”的导入链路。
- [ ] 实现原站资源 URL 规范化。
- [ ] 实现文章关联内容提取器。
- [ ] 实现正文内媒体 URL 解析器与远程附件登记逻辑。
- [ ] 实现共享实体 upsert 服务。
- [ ] 实现关联文章 stub 建档逻辑。
- [ ] 实现重复导入确认与覆盖更新逻辑。
- [ ] 接入 importJobs 流程日志。

### Phase 4：AI 翻译服务

- [ ] 建立 GoogleGenAI 单例客户端。
- [ ] 严格按 https://googleapis.github.io/js-genai/release_docs/index.html 校对客户端初始化、函数调用和错误处理实现。
- [ ] 接入后台系统配置项 aiGatewayUrl。
- [ ] 建立工具调用定义 submit_translation_segments。
- [ ] 建立文本翻译服务。
- [ ] 建立 HTML 文本抽取、分批、回填服务。
- [ ] 建立 translationMemories 读写逻辑。
- [ ] 建立 aiTranslationLogs 审计逻辑。
- [ ] 为作者、分类、标签、地点、媒体、关联实体、文章正文分别封装翻译入口。

### Phase 5：后台登录与基础管理页面

- [ ] 建立 adminUsers 登录接口。
- [ ] 建立首次启动管理员初始化逻辑。
- [ ] 建立后台 JWT 密钥文件启动检查、自动生成与后台重新生成接口。
- [ ] 建立后台登录失败限流、adminLoginLogs 写入与 pwversion 失效链路。
- [ ] 完成 /multilingual-admin/login。
- [ ] 完成 /multilingual-admin/import。
- [ ] 完成 /multilingual-admin/post/group/list 组表 UI，父级为 sourceContents，子表为各语言文章记录。
- [ ] 完成 /multilingual-admin/post/list。

### Phase 6：后台文章编辑页

- [ ] 复制并接入 RichEditor5。
- [ ] 完成文章基础信息编辑区。
- [ ] 完成作者编辑抽屉。
- [ ] 完成分类、标签、地点编辑抽屉。
- [ ] 完成远程附件与翻译站附件双面板、上传、替换和编辑抽屉。
- [ ] 为 localized 附件上传补齐 MIME、文件头、大小、路径和文件名安全校验。
- [ ] 完成关联实体编辑区。
- [ ] 完成正文内关联实体编辑区。
- [ ] 完成 AI 按钮区。
- [ ] 完成发布校验面板。
- [ ] 完成原文快照查看区。

### Phase 7：共享实体独立管理页

- [ ] 共享实体独立管理页统一采用组表 UI，父级展示原始数据，子表展示 en、jp、tw 版本。
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

- [ ] 建立 Express + EJS 博客端渲染基座。
- [ ] 建立语言前缀路由层与语言中间件。
- [ ] 建立根路径按 site.defaultLanguageCode 跳转逻辑。
- [ ] 建立 Query Service -> ViewModel -> EJS Template 的页面组装链路。
- [ ] 建立 TailwindCSS 编译与静态资源发布流程。
- [ ] 完成 /:lang 首页列表。
- [ ] 完成 /:lang/post/list。
- [ ] 完成 /:lang/post/:id。
- [ ] 完成分类、标签、地点列表页。
- [ ] 接入本地多语言公开接口。
- [ ] 关闭评论、点赞、分享、投票、浏览上报相关 UI 和调用。
- [ ] 接入 hreflang、canonical、sitemap、open graph、twitter card 和结构化数据。

### Phase 9：发布、缓存与广告

- [ ] 建立 publishValidator。
- [ ] 建立发布与撤回发布接口。
- [ ] 将 HTML 安全清洗、危险 URL 校验与本地附件路径安全检查纳入发布前强校验。
- [ ] 建立多语言缓存刷新逻辑。
- [ ] 建立站点 options 管理页。
- [ ] 建立翻译站附件本地存储与公开静态访问路径。
- [ ] 建立谷歌广告位开关与参数配置。
- [ ] 输出 ads.txt。

### Phase 10：测试、文档与上线准备

- [ ] 编写导入流程集成测试。
- [ ] 编写 HTML 文本抽取与回填单元测试。
- [ ] 编写管理员 JWT 密钥自动生成、密钥轮换和旧 token 失效测试。
- [ ] 编写后台登录失败限流与 pwversion 失效测试。
- [ ] 编写发布校验单元测试。
- [ ] 编写重复导入与 stub 处理测试。
- [ ] 编写 localized 附件上传安全校验测试。
- [ ] 编写后台编辑流程端到端测试。
- [ ] 编写前台多语言路由访问测试。
- [ ] 完成 example.env，并校对其只包含第 11.1 节定义的 5 个键，不得混入第 11.2 节、第 11.3 节、第 11.5 节或旧 Nuxt/Vite 项目的变量名。
- [ ] 完成部署文档。
- [ ] 完成与原站接口依赖说明文档。

## 14. 验收标准

以下条件全部满足，才视为一期完成：

- 管理员可以在 /multilingual-admin 输入原文章 ID 或别名并选择 en、jp、tw 发起导入。
- 页面类型文章会被明确拒绝导入。
- 原站原始结构化数据会在本地 sourceContents 主档中保留，后续新增语言时可以直接以该主档作为派生上游。
- 导入后，文章与关联作者、分类、标签、地点、媒体、关联实体均能在本地库中看到对应语言副本。
- 重复导入时会提示，确认后目标文章回到草稿并覆盖更新。
- 富文本编辑器体验与原后台一致。
- 正文 HTML 翻译不会破坏标签结构。
- 博客端首屏页面由 EJS 服务端完整输出，不依赖 Nuxt 或前台 SPA hydration。
- blog/template-source/wikimoeToGithubPage/src 中存在完整可读的模板基线文件，至少覆盖列表页、详情页、媒体卡片、只读投票、足迹地图、公共头尾和前台轻脚本。
- blog/public/glightbox、blog/public/highlight、blog/public/openlayers 可独立提供模板所需静态资源，不依赖外部仓库目录或 CDN。
- 首次启动时若 server/secret/JWTSecretAdmin.key 不存在，系统会自动生成管理员 JWT 密钥文件并正常启动。
- 后台重新生成管理员 JWT 密钥后，既有后台 token 会立即失效。
- 后台登录在连续失败超限后会临时阻断，并且后台可查看 adminLoginLogs。
- example.env 只包含 DB*HOST、LOCAL_ATTACHMENT_STORAGE_DIR、INIT_ADMIN_USERNAME、INIT_ADMIN_PASSWORD、INIT_ADMIN_NICKNAME 这 5 个启动引导级键，不包含任何 NUXT*\_、NITRO\__、VITE*\*、SOURCE_BLOG*_、GEMINI\__、AI*GATEWAY_URL、JWT_SECRET_ADMIN、SITE*_ 或 GOOGLE*AD*\_。
- 服务端、管理端、博客端代码不会把第 11.2 节和第 11.3 节字段从 process.env 读取为业务配置来源。
- 可以为 en、jp、tw 分别替换或上传各自语言专属的翻译站附件，且只影响对应语言文章。
- 修改 system.sourceBlogPublicOrigin 后，不需要迁移数据库即可继续正确解析原站内部资源。
- localized 附件上传会拒绝不在白名单内的 MIME、伪装文件头和路径穿越文件。
- 发布前会拦截包含 script、危险事件属性或 javascript: URL 的 HTML 内容。
- 共享实体不会因为重复导入产生重复翻译副本。
- 共享实体在后台独立修改后，会立即反映到对应语言下的已发布文章。
- 后台文章列表和共享实体列表统一采用组表 UI，父级展示原始数据，子表展示语言版本。
- 作者、分类、标签、地点、附件、bangumi、movie、game、book、event、vote 都可以在后台独立管理。
- 发布前能准确指出哪些关联内容尚未完成翻译。
- 发布成功后，可通过 /en、/jp、/tw 访问对应语言文章列表和详情页。
- 分类、标签、地点列表都能在对应语言前缀下独立工作。
- 多语言站不会向原站写入任何评论、点赞、分享、投票、浏览计数数据。
- 首页、列表页、详情页、分类页、标签页和地点页都能输出独立的 title、description、canonical、hreflang、open graph 和结构化数据。
- 谷歌广告配置可在后台 site.\* 配置中调整并即时生效。

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

### 15.6 localized 附件上传被伪装文件绕过

规避：

- 同时校验扩展名、声明 MIME 和文件头，不信任客户端单侧信息。
- 存储路径统一由服务端生成并限制在 LOCAL_ATTACHMENT_STORAGE_DIR 下。
- 拒绝脚本、可执行文件和路径穿越。

### 15.7 富文本内容携带危险脚本或危险 URL

规避：

- 导入、翻译回填、保存、发布四个阶段都执行 HTML 安全清洗。
- 发布前再次校验 script、危险属性和危险协议，避免绕过单点校验。

### 15.8 后台 JWT 密钥丢失或轮换导致会话失效

规避：

- 密钥采用 secret 文件持久化，不依赖 env 临时值。
- 轮换动作只允许高权限管理员执行，并明确提示“会让当前后台登录全部失效”。
- 密钥文件缺失时自动重建，但旧 token 失效属于预期安全行为。

## 16. 本计划的强制执行结论

- 用户表必须拆分为 adminUsers 与 authors，两者职责完全不同。
- 多语言共享实体采用稳定唯一键复用。原站同步实体使用 sourceId + languageCode，附件使用 remote/local 分类型唯一键。
- 必须保留可重复派生的原始数据主档 sourceContents，未来新增语言优先从本地原始数据派生，而不是重新依赖临时抓取结果。
- 共享实体的后台独立修改对对应语言下已发布文章立即生效，不做历史版本冻结。
- 后台多语言列表统一采用“父级原始数据 + 子表格语言版本”的组表 UI。
- 多语言文章全部采用 sourceId 分组，不允许脱离原文章分组单独漂移。
- 前台公开页面只服务本地多语言数据，不在运行期回查原站文章接口。
- 博客端界面与轻交互必须以 blog/template-source/wikimoeToGithubPage/src 为唯一直接基线，并使用 blog/public/glightbox、blog/public/highlight、blog/public/openlayers 作为固定第三方静态资源来源。
- 原站作为导入数据源和远程附件来源存在，但所有原站内部资源都只存相对路径，由运行时按 system.sourceBlogPublicOrigin 拼接；多语言站同时支持本地翻译站附件，不依赖原站参与运行期渲染。

## 补充

- 响应式设计，支持暗模式和亮模式切换。
- 不要LOGO图片。
- 博客端不需要语言切换，访问什么路径就是什么语言。
- 你不用设成 workspaces。
- 统一采用 ESM 模式。
- 需要有阶段性测试。
