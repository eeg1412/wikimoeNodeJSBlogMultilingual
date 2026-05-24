# Server 新增语言手顺书

本文面向 `wikimoeNodeJSBlogMultilingual/server`。Server 端负责语言白名单、API 校验、Mongoose enum、缓存、RSS、Sitemap、翻译任务、专有名词和站点配置等后端能力。

新增语言不是后台动态开关，而是代码配置变更。新增后需要重启 Server，让 Mongoose schema、缓存刷新、RSS/Sitemap 刷新逻辑重新读取语言配置。

## 1. 新增前确认

新增语言前先确定这些信息：

| 项目       | 要求                                                      |
| ---------- | --------------------------------------------------------- |
| 规范语言码 | 使用完整 BCP 47 风格 code，例如 `fr-FR`、`ko-KR`、`de-DE` |
| 展示名称   | 使用该语言在后台、日志、任务中展示的名称，例如 `Français` |
| 默认语言   | 只新增语言时不要修改默认语言，当前默认语言仍是 `zh-CN`    |
| 三端一致性 | Server、Admin、Blog 必须添加同一个 code，顺序也要一致     |
| 内容策略   | 明确新语言是立即发布，还是先录入配置、草稿和翻译任务      |

不要把未知语言兜底成默认语言。未配置的语言应继续被判定为非法语言。

## 2. Server 代码手顺

### 2.1 修改语言配置

只修改：

```text
server/config/languages.js
```

在 `LANGUAGE_CONFIG_LIST` 中追加一条语言配置。以新增法国法语为例：

```javascript
const LANGUAGE_CONFIG_LIST = [
  {
    code: 'zh-CN',
    label: '简体中文',
    isDefault: true
  },
  {
    code: 'zh-HK',
    label: '繁体中文（香港）'
  },
  {
    code: 'zh-TW',
    label: '繁体中文（台湾）'
  },
  {
    code: 'zh-SG',
    label: '简体中文（新加坡）'
  },
  {
    code: 'ja-JP',
    label: '日本語'
  },
  {
    code: 'en-US',
    label: 'English'
  },
  {
    code: 'fr-FR',
    label: 'Français'
  }
]
```

注意：

- `isDefault: true` 只能存在一条。
- 只新增语言时不要给新语言加 `isDefault: true`。
- 新语言 code 不要写成短 code，例如不要用 `fr` 代替 `fr-FR`。

### 2.2 不要修改派生文件

不要为了新增语言手动修改这些文件：

```text
server/utils/language.js
server/mongodb/modelFactory/multilingualSchema.js
server/config/cacheData.js
server/utils/rss.js
server/utils/sitemap.js
server/routes/multilingualRss.js
```

这些文件会通过 `server/utils/language.js` 间接读取 `server/config/languages.js` 派生出来的语言能力。

`server/utils/language.js` 会从配置派生：

- `SUPPORTED_LANGUAGE_CODES`
- `DEFAULT_LANGUAGE_CODE`
- `LANGUAGE_TEXT_MAP`
- `LANGUAGE_CODE_MAP`
- `normalizeLanguageCode()`
- `isSupportedLanguageCode()`
- `getLanguageText()`

## 3. 同步三端配置

Server 只认后端语言。完整新增一种站点语言时，还必须同步：

| 端          | 必须同步的文件                                               |
| ----------- | ------------------------------------------------------------ |
| Admin       | `admin/src/config/languages.js`                              |
| Blog        | `blog/shared/languages.js`                                   |
| Blog 语言包 | `blog/app/lang/<code>/common.js`、`almanac.js`、`seeking.js` |

三端 language code 集合、顺序、默认语言必须一致。否则会出现管理端可选但后端拒绝、后端接受但前台 404、前台能进但管理端无法维护等问题。

## 4. 后端影响范围

新增语言配置后，以下后端能力会自动识别新 code：

- Mongoose 多语言 schema enum。
- 前台多语言内容 API 的 `languageCode` 校验。
- 管理端翻译文章、关联翻译、媒体、导航、侧边栏、Banner 等保存校验。
- `refreshAllLanguageCache()` 的按语言缓存刷新。
- `reflushRSS()` 和 `reflushSitemap()` 的全语言刷新。
- 翻译任务、AI 工作流、专有名词译名的目标语言校验。

新增语言后必须重启 Server。运行中的服务不会自动重新注册 Mongoose schema enum。

## 5. 数据补齐手顺

代码配置完成后，新语言上线还需要数据，不要用默认语言内容兜底。

至少补齐：

- 多语言站点配置：标题、描述、关键词、Logo、Favicon、默认封面。
- 博客端语言启用状态：新增语言默认启用，可在 Admin 多语言站点配置中关闭。
- RSS/Sitemap 设置：是否开启、最大数量、是否在页脚显示。
- 导航：`navis`。
- Banner：`banners`。
- 侧边栏：`sidebars`。
- 翻译文章：`posts` 中 `recordKind: 'translation'` 的新语言记录。
- 关联翻译：作者、分类、标签、地点、番剧、电影、游戏、书籍、活动、投票等。
- 媒体：远程快照或本地化媒体。
- 专有名词：`properNounTranslations`。
- AI 设置：新增语言后，必须把 6 条流程逐条检查完，确认新语言在对应的按语言提示词映射里已经出现；如果该流程没有额外规则，也要保留该语言对应的空字符串，不要漏掉该语言键。各流程通用规则分别使用对应默认提示词字段。

| 流程                      | 必查字段                              | 检查要求                   |
| ------------------------- | ------------------------------------- | -------------------------- |
| 主翻译 AI                 | `mainTranslationLanguagePrompts`      | 必须出现新语言 code 对应项 |
| 专有名词预处理 AI         | `properNounPreprocessLanguagePrompts` | 必须出现新语言 code 对应项 |
| 专有名词本地知识库查询 AI | `properNounKnowledgeLanguagePrompts`  | 必须出现新语言 code 对应项 |
| 专有名词联网搜索 AI       | `internetSearchLanguagePrompts`       | 必须出现新语言 code 对应项 |
| 图片识别 AI               | `imageRecognitionLanguagePrompts`     | 必须出现新语言 code 对应项 |
| 图片生成 AI               | `imageGenerationLanguagePrompts`      | 必须出现新语言 code 对应项 |

不要只检查主翻译 AI。少任何一条流程，都视为新增语言手顺未完成。

新语言没有内容时，列表为空或详情 404 是正确表现。

## 6. 校验手顺

新增语言配置后，按项目校验方式检查：

- 三端语言 code 集合一致。
- 三端默认语言一致且只有一个。
- Server 每个语言都有 `code` 和 `label`。
- Admin 每个语言都有完整侧边栏内置标题。
- Blog 每个语言都有完整语言包文件。
- Blog 不存在未配置的语言包目录。
- 未配置语言仍返回非法，而不是回退默认语言。

项目校验工具位于：

```text
server/validator-tool.js
```

不要通过 build 作为代码正确性的主要校验方式。构建属于发布流程，不是本手顺的代码校验手段。

## 7. Server 验收清单

- `server/config/languages.js` 已添加新 code 和 label。
- `isDefault: true` 仍然只有一个。
- `normalizeLanguageCode('<code>')` 能返回规范 code。
- `normalizeLanguageCode('<小写 code>')` 能返回规范 code。
- 短 code 或未配置 code 仍返回 `null`。
- 管理端保存新语言内容时不被后端语言校验拒绝。
- 新语言站点配置能保存。
- 新语言 RSS/Sitemap 开启并有有效 `siteUrl` 后能生成对应文件。
- 新语言没有内容时不会返回默认语言内容。
- Admin 关闭某语言的博客端启用状态后，`/api/multilingual-blog` 对应 languageCode 返回 404。

## 8. 常见错误

- 只改 Server，漏改 Admin 或 Blog。
- 把新语言设置成默认语言。
- 用短 code，例如 `fr`，代替完整 code。
- 为了避免报错把未知语言兜底为 `zh-CN`。
- 改完配置后没有重启 Server，导致 Mongoose enum 仍是旧值。
- 忘记补新语言站点配置，导致 SEO、Logo、RSS、Sitemap 信息缺失。
- 忘记补 AI prompt，导致翻译质量不稳定。
