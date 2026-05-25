# 新增语言配置化设计报告

## 1. 目标

新增语言时，把改动收敛为：

| 端     | 新增语言时应改什么                                          |
| ------ | ----------------------------------------------------------- |
| Server | `server/config/languages.js` 增加一条配置                   |
| Admin  | `admin/src/config/languages.js` 增加一条配置                |
| Blog   | `blog/shared/languages.js` 增加一条配置，并新增对应翻译文件 |

这是代码配置方案，不是后台运行时动态加语言。新增语言后：

- Server 正常重启。
- Admin 正常重新构建。
- Blog 正常重新构建。
- 不做旧结构兼容层。
- 不添加迁移代码。
- 不为了无重启动态生效引入 DB 语言白名单。

## 2. 总体结论

| 维度   | 结论                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------ |
| 可行性 | 中高。Server/Admin 很适合配置化；Blog 可以用配置白名单加 `import.meta.glob` 构建期收集翻译文件。 |
| 难度   | 中。主要工作是把散落的语言常量收敛到三端配置入口，并补齐一致性校验。                             |
| 风险   | 中到高。核心风险是三端配置不一致、Blog 翻译文件缺失、RSS/Sitemap 语言白名单漏同步。              |

推荐做。不要把“支持语言列表”放进数据库。语言站点信息、SEO、Logo、RSS 开关可以在 DB 中配置，但语言 code 白名单应保持代码配置。

## 3. Server 设计

新增：

```text
server/config/languages.js
```

建议配置：

```javascript
const LANGUAGE_CONFIG_LIST = [
  {
    code: 'zh-CN',
    label: '中国大陆简体中文',
    isDefault: true
  },
  {
    code: 'zh-HK',
    label: '香港繁體中文'
  },
  {
    code: 'zh-TW',
    label: '臺灣正體中文'
  },
  {
    code: 'zh-SG',
    label: '新加坡简体中文'
  },
  {
    code: 'ja-JP',
    label: '日本語'
  },
  {
    code: 'en-US',
    label: 'English'
  }
]

module.exports = {
  LANGUAGE_CONFIG_LIST
}
```

`server/utils/language.js` 从配置派生：

- `SUPPORTED_LANGUAGE_CODES`
- `DEFAULT_LANGUAGE_CODE`
- `LANGUAGE_TEXT_MAP`
- `LANGUAGE_CODE_MAP`
- `normalizeLanguageCode()`

注意点：

- Mongoose enum 依赖 `SUPPORTED_LANGUAGE_CODES`，新增语言后重启服务即可。
- `server/validator-tool.js` 不能继续硬编码 6 个语言。
- 不支持未知语言兜底。配置没有的语言应直接判定非法。

**Server 可行性：高**

当前 Server 已经集中通过 `server/utils/language.js` 提供语言能力。只要这个文件改为配置派生，schema、缓存、RSS/Sitemap、AI 翻译任务都能继续从统一入口读取。

**Server 难度：低到中**

主要是新增配置文件、改语言工具、改 validator。

**Server 风险：中**

配置写错会影响 schema、缓存刷新、RSS/Sitemap、翻译任务。必须用校验脚本提前发现。

## 4. Admin 设计

新增：

```text
admin/src/config/languages.js
```

建议配置：

```javascript
export const LANGUAGE_CONFIG_LIST = [
  {
    code: 'zh-CN',
    label: '中国大陆简体中文',
    isDefault: true,
    sidebarBuiltinTitles: {
      1: '自定义内容',
      3: '最新评论',
      4: '随机标签',
      8: '分类',
      9: '归档',
      10: '谷歌广告',
      11: '自定义HTML',
      12: '热门文章',
      13: '当季追番',
      14: '攻略中',
      15: '阅读中'
    }
  }
]
```

`admin/src/utils/multilingual.js` 从配置派生：

- `SUPPORTED_LANGUAGE_OPTIONS`
- `SUPPORTED_LANGUAGE_CODES`
- `compareSupportedLanguage()`
- `sortBySupportedLanguageOrder()`
- `getLocalizedSidebarBuiltinTitle()`
- `SIDEBAR_BUILTIN_TITLE_MAP`

侧边栏内置标题建议按语言配置，而不是按 type 分散写。新增语言时，一条配置里补齐该语言所有内置标题。

**Admin 可行性：中高**

Admin 语言能力主要集中在 `admin/src/utils/multilingual.js`，配置化后页面层可以继续使用统一工具。

**Admin 难度：中**

主要难点是侧边栏标题结构调整，以及语言数量增加后管理端表单、tabs、列表展示变密。

**Admin 风险：中**

风险集中在 UI 展示：

- 语言 tabs 变多。
- 翻译矩阵更宽。
- AI prompt 表单更长。
- 小屏列表必须继续使用 `ResponsiveTable` 和 `ResponsiveTableColumn`。

## 5. Blog 设计

新增共享配置：

```text
blog/shared/languages.js
```

建议配置：

```javascript
export const LANGUAGE_CONFIG_LIST = [
  {
    code: 'zh-CN',
    label: '中国大陆简体中文',
    isDefault: true
  },
  {
    code: 'en-US',
    label: 'English'
  }
]

export const REQUIRED_LANGUAGE_MODULE_NAMES = ['common', 'almanac', 'seeking']
```

新增语言时补齐：

```text
blog/app/lang/<code>/common.js
blog/app/lang/<code>/almanac.js
blog/app/lang/<code>/seeking.js
```

Blog 前台侧边栏内置标题不再写在 `blog/app/layouts/default.vue`。这些文案属于前台 UI 翻译，统一放在 `common.js` 的 `sidebarBuiltinTitles` 中。新增语言时必须在新语言 `common.js` 补齐所有内置类型标题，否则语言包完整性校验会失败。

`blog/app/lang/index.js` 不再手写 import，不再人工维护 `LANGUAGE_PACK_MAP`。用 `import.meta.glob` 构建期收集翻译模块：

```javascript
import {
  LANGUAGE_CONFIG_LIST,
  REQUIRED_LANGUAGE_MODULE_NAMES
} from '../../shared/languages'

const translationModules = import.meta.glob('./*/*.js', {
  eager: true,
  import: 'default'
})

const discoveredLanguageTextMap = {}

for (const [path, moduleText] of Object.entries(translationModules)) {
  const match = path.match(/^\.\/([^/]+)\/([^/]+)\.js$/)

  if (!match) {
    throw new Error(`Invalid language file path: ${path}`)
  }

  const languageCode = match[1]
  const moduleName = match[2]

  if (!discoveredLanguageTextMap[languageCode]) {
    discoveredLanguageTextMap[languageCode] = {}
  }

  discoveredLanguageTextMap[languageCode][moduleName] = moduleText
}

export const SUPPORTED_LANGUAGE_CODES = LANGUAGE_CONFIG_LIST.map(item => {
  return item.code
})

const LANGUAGE_TEXT_MAP = {}

for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
  const languageText = discoveredLanguageTextMap[languageCode]

  if (!languageText) {
    throw new Error(`Missing translation directory: ${languageCode}`)
  }

  for (const moduleName of REQUIRED_LANGUAGE_MODULE_NAMES) {
    if (!languageText[moduleName]) {
      throw new Error(
        `Missing translation file: ${languageCode}/${moduleName}.js`
      )
    }
  }

  LANGUAGE_TEXT_MAP[languageCode] = languageText
}

for (const languageCode of Object.keys(discoveredLanguageTextMap)) {
  if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
    throw new Error(`Unexpected translation directory: ${languageCode}`)
  }
}
```

这里的扫描是 Vite 构建期模块收集，不是浏览器运行时或 Node 运行时读磁盘。Blog 编译后，翻译模块已经在产物里。

`blog/server/utils/languageSeo.js` 必须从 `blog/shared/languages.js` 派生语言白名单，不能再维护独立数组。

**Blog 可行性：中高**

Blog 可以做到“一条配置 + 翻译文件”。`import.meta.glob` 能去掉手写 import 和人工 `LANGUAGE_PACK_MAP`。

**Blog 难度：中**

主要难点是前台代码和 Nitro server 同时读取共享配置，以及翻译文件完整性校验。

**Blog 风险：中到高**

主要风险：

- 配置了语言但缺翻译文件。
- 有未配置语言目录被误纳入。
- `blog/server/utils/languageSeo.js` 漏同步导致 RSS/Sitemap 404。
- `getLanguageText()` 的默认语言回退可能掩盖漏翻译。

缓解方式：

- 配置语言缺文件直接抛错。
- 未配置语言目录直接抛错。
- validator 检查所有语言包 key 完整性。
- RSS/Sitemap 代理只从共享配置取语言 code。

## 6. 一致性校验

必须增加校验，否则三端配置化后仍然会漏改。

建议校验：

- Server、Admin、Blog 的 language code 集合完全一致。
- 三端默认语言一致，且只能有一个默认语言。
- Server 每个语言都有 `code`、`label`。
- Admin 每个语言都有 `code`、`label`、完整 `sidebarBuiltinTitles`。
- Blog 每个语言都有 `common.js`、`almanac.js`、`seeking.js`。
- Blog 不存在未配置语言目录。
- `blog/server/utils/languageSeo.js` 不再硬编码语言数组。
- `server/validator-tool.js` 不再硬编码语言数量。

## 7. 推荐实施顺序

1. 新增三端语言配置文件，先迁移现有 6 种语言。
2. 改 Server：`server/utils/language.js` 从配置派生。
3. 改 Admin：`admin/src/utils/multilingual.js` 从配置派生。
4. 改 Blog：`blog/app/lang/index.js` 使用 `import.meta.glob`，`blog/server/utils/languageSeo.js` 读取共享配置。
5. 增加一致性校验。
6. 用一个新语言试跑完整流程，例如 `fr-FR`。

## 8. 新增语言最终流程

新增 `fr-FR` 时，理想流程是：

1. `server/config/languages.js` 添加 `fr-FR`。
2. `admin/src/config/languages.js` 添加 `fr-FR`。
3. `blog/shared/languages.js` 添加 `fr-FR`。
4. 新增 `blog/app/lang/fr-FR/common.js`。
5. 新增 `blog/app/lang/fr-FR/almanac.js`。
6. 新增 `blog/app/lang/fr-FR/seeking.js`。
7. 在 `common.js` 中补齐 `sidebarBuiltinTitles`。
8. 运行一致性校验。
9. 重启 Server，重新构建 Admin 和 Blog。
10. 检查管理端语言选择、前台页面、`/fr-FR/rss`、`/fr-FR/sitemap.xml`。

## 9. 结论

这个方案值得做。它不会让新增语言变成后台点一下就生效，但能把工程改动收敛到清晰、可校验、可部署的几个入口。

最终目标：

- Server：一条配置。
- Admin：一条配置。
- Blog：一条配置 + 翻译文件。
- 校验脚本负责发现漏改。
