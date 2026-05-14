# Admin 新增语言手顺书

本文面向 `wikimoeNodeJSBlogMultilingual/admin`。Admin 端负责让管理员选择新语言、配置新语言站点信息、创建和编辑新语言翻译内容、查看翻译矩阵、执行 AI 翻译任务，并保持移动端和暗黑模式体验。

新增语言不是在页面里硬写选项。当前管理端语言入口已经配置化，新增语言时只修改 `admin/src/config/languages.js`。

## 1. 新增前确认

新增语言前先确认：

| 项目       | 要求                                               |
| ---------- | -------------------------------------------------- |
| 规范语言码 | 与 Server、Blog 完全一致，例如 `fr-FR`             |
| 展示名称   | 与 Server、Blog 配置一致，例如 `Français`          |
| 默认语言   | 只新增语言时不要修改默认语言                       |
| 侧边栏标题 | 必须补齐所有内置类型的新语言标题                   |
| UI 影响    | 语言 tab、筛选项、翻译矩阵、AI prompt 区域都会变多 |

Admin 不能单独决定支持语言。Server、Admin、Blog 三端必须同步添加同一个 code。

## 2. Admin 代码手顺

### 2.1 修改语言配置

只修改：

```text
admin/src/config/languages.js
```

在 `LANGUAGE_CONFIG_LIST` 中追加一条配置。以新增法国法语为例：

```javascript
{
  code: 'fr-FR',
  label: 'Français',
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

把这条对象放进数组末尾，并确保前一项后面有逗号。

### 2.2 必须补齐的侧边栏内置类型

`sidebarBuiltinTitles` 必须覆盖这些 type：

| type | 含义        |
| ---- | ----------- |
| `1`  | 自定义内容  |
| `3`  | 最新评论    |
| `4`  | 随机标签    |
| `8`  | 分类        |
| `9`  | 归档        |
| `10` | Google 广告 |
| `11` | 自定义 HTML |
| `12` | 热门文章    |
| `13` | 当季追番    |
| `14` | 攻略中      |
| `15` | 阅读中      |

不要只补常用类型。缺少任何一个 type 都应视为配置不完整。

### 2.3 不要修改派生文件

不要为了新增语言手动修改：

```text
admin/src/utils/multilingual.js
```

该文件会从 `admin/src/config/languages.js` 派生：

- `SUPPORTED_LANGUAGE_OPTIONS`
- `SUPPORTED_LANGUAGE_CODES`
- `DEFAULT_LANGUAGE_CODE`
- `compareSupportedLanguage()`
- `sortBySupportedLanguageOrder()`
- `getLanguageText()`
- `getLocalizedSidebarBuiltinTitle()`
- `SIDEBAR_BUILTIN_TITLE_MAP`

## 3. 同步三端配置

完整新增语言时必须同时修改：

| 端          | 必须同步的文件                                               |
| ----------- | ------------------------------------------------------------ |
| Server      | `server/config/languages.js`                                 |
| Admin       | `admin/src/config/languages.js`                              |
| Blog        | `blog/shared/languages.js`                                   |
| Blog 语言包 | `blog/app/lang/<code>/common.js`、`almanac.js`、`seeking.js` |

三端 language code 集合、顺序、默认语言必须一致。Admin 多语言顺序会影响列表展示、矩阵排序和翻译进度分母。

## 4. Admin 自动生效范围

新增配置后，这些页面会自动出现新语言选项或新语言行：

- 多语言站点配置页。
- AI 设置页语言 prompt 区域。
- 多语言仪表盘。
- 源文章导入和 AI 批量翻译。
- 源快照列表。
- 翻译文章列表和翻译矩阵。
- 单篇源文章语言版本页。
- 翻译文章编辑器。
- 翻译任务列表。
- 关联内容翻译列表。
- 多语言媒体列表。
- 导航、侧边栏、Banner 管理。
- 专有名词翻译页面。

通常不需要为这些页面单独新增语言代码。若发现某页面没有出现新语言，优先检查它是否没有使用 `SUPPORTED_LANGUAGE_OPTIONS` 或相关工具函数。

## 5. 上线前数据手顺

新增语言配置只让管理端看见和保存新语言。上线前还要在管理端补齐数据：

- 多语言站点配置：标题、副标题、SEO、Logo、Favicon、默认封面、页脚、RSS、Sitemap。
- 博客端语言启用状态：新增语言默认开启；关闭后只影响 Blog 前台和 Blog API，不影响 Admin 继续维护内容。
- AI 设置：补新语言 `deepSeekLanguagePrompts`，明确目标地区用词和专有名词规则。
- 导航：创建或复制并翻译新语言导航。
- Banner：创建或复制并翻译新语言 Banner。
- 侧边栏：创建或复制并翻译新语言侧边栏。
- 翻译文章：创建新语言文章记录或通过 AI 任务生成。
- 关联内容：作者、分类、标签、地点、番剧、电影、游戏、书籍、活动、投票等。
- 媒体：确认新语言内容引用的媒体和本地化媒体。
- 专有名词：优先补 ACG 作品名、角色名、品牌、游戏、地名、活动名等基础术语。

不要隐藏新语言来让旧内容看起来“完成”。新增语言后旧内容缺少该语言翻译是正确状态。

复制默认语言配置不会复制“启用博客端语言”开关。这个开关是每个语言独立的运营状态，不属于翻译内容。

## 6. UI/UX 检查手顺

新增语言会让管理端信息更密。至少检查：

- 多语言站点配置页 tab 是否能在小屏正常滚动或换行。
- AI 设置页 prompt 区域是否仍然清晰。
- 源文章导入页目标语言多选是否可读。
- 翻译矩阵语言 tag 换行后是否清楚。
- `ResponsiveTable` 小屏卡片模式是否显示完整语言信息。
- 暗黑模式下新增语言标签、表单、textarea、富文本编辑器是否可读。
- 不要把管理端列表改回 Element Plus 原生 Table；列表页继续使用 `ResponsiveTable` 和 `ResponsiveTableColumn`。

## 7. 校验手顺

新增语言后检查：

- `admin/src/config/languages.js` 中新语言 code、label、侧边栏标题完整。
- Server、Admin、Blog 的 code 集合、顺序、默认语言一致。
- 管理端语言下拉、语言 tab、语言筛选都能显示新语言 label。
- `getTranslationProgress()` 分母随语言数量变化。
- `getLocalizedSidebarBuiltinTitle()` 能返回新语言内置标题。
- 不支持的 language code 不应在管理端被当成已支持语言处理。

项目一致性校验位于：

```text
server/validator-tool.js
```

不要通过 build 作为代码正确性的主要校验方式。构建属于发布流程。

## 8. Admin 验收清单

- 多语言站点配置页出现新语言 tab。
- 多语言站点配置页可以切换该语言的“启用博客端语言”开关。
- 能保存新语言站点配置。
- AI 设置页出现新语言 prompt 文本框。
- 源文章导入页可以选择新语言作为目标语言。
- 翻译文章列表语言矩阵显示新语言状态。
- 单篇语言版本页出现新语言行，并能创建翻译。
- 翻译编辑器能打开新语言文章。
- 关联翻译列表能筛选新语言。
- 媒体列表能筛选和操作新语言媒体。
- 导航、侧边栏、Banner 能创建新语言内容。
- 专有名词页面能创建新语言译名。
- 手机端和暗黑模式没有明显布局问题。

## 9. 常见错误

- 只改 Admin，漏改 Server 或 Blog。
- 在 `admin/src/utils/multilingual.js` 里手工加语言，破坏配置化入口。
- 侧边栏内置标题漏 type，导致新语言标题缺失。
- 忘记补 AI prompt，导致翻译质量不稳定。
- 默认语言被顺手改掉。
- 用默认语言内容兜底，掩盖新语言缺数据问题。
- 关闭博客端语言后仍期望 Admin 翻译流程被禁用；该开关只影响 Blog 端访问。
