# Blog 新增语言手顺书

本文面向 `wikimoeNodeJSBlogMultilingual/blog`。Blog 前台使用自建语言系统：语言前缀路由、静态语言包、请求自动注入 `languageCode`、Nuxt server RSS/Sitemap 代理，以及后端多语言内容 API。

新增语言不是手写 import，也不是改 Nuxt i18n。当前 Blog 语言入口已经配置化，新增语言时只修改 `blog/shared/languages.js`，并新增对应语言包文件。

## 1. 新增前确认

新增语言前先确认：

| 项目           | 要求                                                  |
| -------------- | ----------------------------------------------------- |
| 规范语言码     | 与 Server、Admin 完全一致，例如 `fr-FR`               |
| 展示名称       | 与 Server、Admin 配置一致，例如 `Français`            |
| 默认语言       | 只新增语言时不要修改默认语言                          |
| 语言包         | 必须补齐 `common.js`、`almanac.js`、`seeking.js`      |
| 侧边栏标题     | 必须在 `common.sidebarBuiltinTitles` 补齐所有内置类型 |
| 博客端启用状态 | 新增语言默认启用，可在 Admin 多语言站点配置中关闭     |
| 内容策略       | 明确新语言页面是立即上线，还是先只进入配置和翻译流程  |

不要让新语言页面回退显示默认语言内容。缺数据时空列表和 404 是正确表现。

## 2. Blog 代码手顺

### 2.1 修改共享语言配置

只修改：

```text
blog/shared/languages.js
```

在 `LANGUAGE_CONFIG_LIST` 中追加一条语言配置。以新增法国法语为例：

```javascript
export const LANGUAGE_CONFIG_LIST = [
  {
    code: 'zh-CN',
    label: '简体中文（中国）',
    isDefault: true
  },
  {
    code: 'zh-HK',
    label: '繁體中文（香港特別行政區）'
  },
  {
    code: 'zh-TW',
    label: '繁體中文（台灣）'
  },
  {
    code: 'zh-SG',
    label: '简体中文（新加坡）'
  },
  {
    code: 'ja-JP',
    label: '日本語 (日本)'
  },
  {
    code: 'en-US',
    label: 'English (United States)'
  },
  {
    code: 'fr-FR',
    label: 'Français'
  }
]
```

不要修改 `REQUIRED_LANGUAGE_MODULE_NAMES`，除非整个项目决定新增一种语言包模块。

### 2.2 新增语言包目录

新增目录：

```text
blog/app/lang/<code>/
```

以 `fr-FR` 为例，需要新增：

```text
blog/app/lang/fr-FR/common.js
blog/app/lang/fr-FR/almanac.js
blog/app/lang/fr-FR/seeking.js
```

建议以 `zh-CN` 或 `en-US` 作为模板复制，再完整翻译。必须保持对象结构和 key 完整。

不要做这些事：

- 删除暂时不会翻译的 key。
- 把缺失 key 设置成空对象。
- 改 key 名来适配某种语言。
- 在 UI 文案里写 `TODO` 或开发说明。
- 把静态文案放到 public 静态资源里。

### 2.3 补齐侧边栏内置标题

Blog 前台侧边栏内置标题已经迁移到语言包：

```text
blog/app/lang/<code>/common.js
```

必须在 `common.js` 中补齐：

```javascript
export default {
  sidebarBuiltinTitles: {
    1: 'Contenu personnalisé',
    3: 'Commentaires récents',
    4: 'Tags aléatoires',
    8: 'Catégories',
    9: 'Archives',
    10: 'Publicités Google',
    11: 'HTML personnalisé',
    12: 'Articles populaires',
    13: 'Anime de la saison',
    14: 'Jeux en cours',
    15: 'Lectures en cours'
  }
}
```

这段示例只展示相关 key。实际 `common.js` 必须保留完整语言包结构。

### 2.4 不要修改派生文件

不要为了新增语言手动修改：

```text
blog/app/lang/index.js
blog/server/utils/languageSeo.js
```

`blog/app/lang/index.js` 会通过 `import.meta.glob` 收集 `blog/app/lang/*/*.js`，并根据 `blog/shared/languages.js` 检查：

- 配置了语言但缺少语言包目录。
- 配置了语言但缺少必需模块。
- 存在未配置语言目录。

`blog/server/utils/languageSeo.js` 会从 `blog/shared/languages.js` 派生 RSS/Sitemap 代理白名单，不再单独维护语言数组。

Nuxt/Nitro server 代码引用共享语言配置时必须使用 `#shared/languages`。不要在 server 代码里写 `../../shared/languages` 这类相对路径，否则构建产物可能把导入解析到错误目录。

## 3. 同步三端配置

完整新增语言时必须同时修改：

| 端          | 必须同步的文件                                               |
| ----------- | ------------------------------------------------------------ |
| Server      | `server/config/languages.js`                                 |
| Admin       | `admin/src/config/languages.js`                              |
| Blog        | `blog/shared/languages.js`                                   |
| Blog 语言包 | `blog/app/lang/<code>/common.js`、`almanac.js`、`seeking.js` |

三端 language code 集合、顺序、默认语言必须一致。否则会出现前台路由可进入但 API 被拒绝、RSS/Sitemap 代理 404、管理端无法维护内容等问题。

## 4. Blog 自动生效范围

新增配置和语言包后，这些能力会自动识别新语言：

- `useLang()` 当前语言解析。
- `localePath()` 和 `localeUrl()` 生成当前语言路径。
- 静态文案 `t()`。
- 多语言 API 请求自动注入 `languageCode`。
- 全局 `html lang`。
- RSS alternate 链接。
- Nuxt server RSS/Sitemap 代理语言白名单。
- 前台侧边栏内置标题本地化。

通常不需要新增页面文件，因为前台页面位于：

```text
blog/app/pages/[[code]]/**
```

## 5. 内容数据手顺

Blog 只负责展示。新语言要正常上线，还需要 Server 数据和管理端内容：

- 站点配置：`/api/multilingual-blog/options?languageCode=<code>`。
- 导航：`navis`。
- Banner：`banners`。
- 侧边栏：`sidebars`。
- 分类、标签、作者等关联翻译。
- 文章：`posts` 中 `recordKind: 'translation'` 且 `languageCode` 为新 code 的记录。
- 页面：`type: 3` 的翻译记录。
- 番剧、电影、游戏、书籍、地点、活动、投票等关联内容翻译。
- 媒体：翻译文章引用的附件或本地化媒体。
- RSS/Sitemap 开关和生成文件。

新语言没有内容时，不要显示默认语言内容。

## 6. SEO 和路由检查手顺

新增语言后检查：

- `/<code>` 可以进入新语言首页。
- Admin 中关闭该语言的博客端启用状态后，`/<code>` 和该语言前缀下所有前台页面通过 Nuxt 错误页返回 404，错误页按钮导航到根路径主站 `/`。
- `/<小写 code>` 会规范化为标准 code 相关行为。
- 短 code 或未配置 code 按当前设计 404。
- 导航、搜索、文章链接都带当前语言前缀。
- API 请求带当前 `languageCode`。
- 文章列表只显示当前语言内容。
- 文章详情 URL、OG URL、JSON-LD URL 都带语言前缀。
- RSS alternate 链接带 `/<code>/rss`。
- `/<code>/rss`、`/<code>/rss/blog`、`/<code>/rss/tweet` 能代理到 Server。
- `/<code>/sitemap.xml` 能代理到 Server。

如果目标语言是阿拉伯语、希伯来语等 RTL 语言，不能只加语言包。还需要单独评估 `html dir`、Tailwind left/right、图标方向、导航、文章内容和管理端编辑器。

## 7. 本地化格式检查手顺

新增语言后检查 `blog/app/composables/useLocalizedText.js` 是否需要新增地区规则：

- 数字单位。
- 日期格式。
- 评分文案。
- 阅读数、评论数、点赞数文案。
- 复数形式。

如果现有规则不适合目标语言，应作为该语言支持的一部分处理，不要依赖默认语言格式兜底。

## 8. 校验手顺

新增语言后检查：

- `blog/shared/languages.js` 已添加新 code 和 label。
- `blog/app/lang/<code>/common.js` 存在并 key 完整。
- `blog/app/lang/<code>/almanac.js` 存在并 key 完整。
- `blog/app/lang/<code>/seeking.js` 存在并 key 完整。
- `common.sidebarBuiltinTitles` 与 Admin 配置一致。
- Blog 不存在未配置语言目录。
- `blog/app/lang/index.js` 仍使用 `import.meta.glob`。
- `blog/server/utils/languageSeo.js` 仍读取 `blog/shared/languages.js`。
- Blog 入口和 Nitro server 入口引用共享配置时仍使用 `#shared/languages`。
- `blog/app/middleware/language-active.global.js` 仍会在每次进入页面时检查博客端语言启用状态。
- `blog/server/plugins/routecache.js` 仍会在返回页面缓存前检查博客端语言启用状态。

项目一致性校验位于：

```text
server/validator-tool.js
```

不要通过 build 作为代码正确性的主要校验方式。构建属于发布流程。

## 9. Blog 验收清单

- 新语言路由可进入。
- 关闭博客端启用状态后，新语言路由通过 Nuxt 错误页返回 404，错误页按钮进入根路径主站 `/`，对应 Blog API 返回 404 状态。
- 静态文案来自新语言语言包。
- 缺失 key 不会大量回退默认语言。
- 前台侧边栏内置标题显示新语言文案。
- API 请求带新语言 `languageCode`。
- 列表和详情不混入默认语言内容。
- RSS/Sitemap 代理识别新语言。
- 手机端布局正常。
- 暗黑模式正常。
- 若目标语言有特殊日期、数字、复数规则，已完成本地化处理。

## 10. 常见错误

- 只新增语言包，漏改 `blog/shared/languages.js`。
- 只改 Blog，漏改 Server 或 Admin。
- 手写修改 `blog/app/lang/index.js`，破坏自动收集机制。
- 手写修改 `blog/server/utils/languageSeo.js`，导致 RSS/Sitemap 白名单再次分裂。
- 漏补 `common.sidebarBuiltinTitles`，导致前台内置侧边栏标题缺失。
- 语言包 key 不完整，页面混默认语言。
- 新语言没有内容时用默认语言内容兜底。
- 语言关闭后仍由 SWR 页面缓存返回旧页面。
- 目标语言是 RTL，却只加语言包没有做额外评估。
