# wikimoeNodeJSBlogMultilingual

基于 `wikimoeNodeJSBlog` 公开接口的多语言附属站。在完全不修改原项目的前提下，独立部署、独立数据库，通过原站公开接口导入文章并经 AI 翻译发布 `en` / `jp` / `tw` 三种语言版本。

## 当前状态

骨架已完成（Phase 0–2）：

- 三端目录结构（`server/` + `admin/` + `blog/` + `common/`）
- Joi 18.1.2 校验层、env 加载、默认 options 初始化
- 原站内部 URL 归一化器 `sourceUrlNormalizer`、运行时资产解析器 `sourceAssetResolver`
- 全部 MongoDB 模型与唯一索引（含 `adminUsers`/`authors` 拆分、`attachments` remote/localized 双类型、posts 多语言分组）
- 管理员登录与最小后台骨架（挂载在 `/multilingual-admin`）
- Nuxt 4 博客端语言前缀路由与根路径跳转

详细需求与阶段拆分见 [plan.md](./plan.md)。
