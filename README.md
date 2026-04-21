# wikimoeNodeJSBlogMultilingual

一个独立于原站运行的多语言博客工程，包含以下三部分：

- server: Node.js + Express + MongoDB 管理与公开 API
- admin: Vue 3 + Vite + Element Plus 多语言管理后台
- blog: Nuxt 4 + TailwindCSS 多语言前台站点

项目目标是从原站导入指定文章或推文，建立英文、日文、繁中三个语言版本，经过 AI 翻译与人工校对后独立发布，并通过本地数据库与本地化附件完成运行。

## 功能概览

- 从原站按 sourceId 导入文章或推文
- 自动同步共享实体：作者、分类、标签、地点、附件以及各类关联内容
- 支持 EN / JP / TW 三种语言分别建稿、翻译、审核、发布
- 提供 AI 单字段翻译、HTML 正文翻译、一键翻译
- 发布前执行严格校验，阻止未完成翻译或缺失依赖的内容上线
- 后台支持独立管理共享实体与站点配置
- 前台按 /:lang 路径独立展示已发布内容
- 支持原站远程资源与本地化附件混合渲染

## 目录结构

```text
wikimoeNodeJSBlogMultilingual/
├── common/                    # 常量、通用校验、共享工具
├── server/                    # Express 服务端 + Mongo 业务
├── admin/                     # 管理后台
├── blog/                      # Nuxt 前台
├── build-all.js               # 一键安装与构建脚本
├── example.env                # 环境变量示例
└── plan.md                    # 项目规划说明
```

## 技术栈

- Server: Express 4, Mongoose 9, Joi, Cheerio, Async Lock
- Admin: Vue 3, Vue Router, Vuex, Element Plus, WangEditor
- Blog: Nuxt 4, TailwindCSS, Color Mode
- AI: @google/genai，强制函数调用模式

## 环境准备

1. Node.js 20+
2. MongoDB 6+
3. 可访问原站公开接口与公开资源域名
4. 可选的 Gemini API Key 或兼容网关

## 配置说明

1. 复制 example.env 为项目根目录下的 .env
2. 根据实际环境填写以下关键配置

```env
PORT=3100
DB_HOST=mongodb://127.0.0.1:27017/wikimoe_multilingual

SOURCE_BLOG_API_BASE_URL=http://127.0.0.1:3000
SOURCE_BLOG_PUBLIC_ORIGIN=http://127.0.0.1:3000

LOCAL_ATTACHMENT_STORAGE_DIR=./server/public/localized
LOCAL_ATTACHMENT_PUBLIC_BASE_PATH=/localized

JWT_SECRET_ADMIN=replace-this

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
AI_GATEWAY_URL=

INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=admin123456
INIT_ADMIN_NICKNAME=Admin
```

说明：

- SOURCE_BLOG_API_BASE_URL 用于导入原站文章详情
- SOURCE_BLOG_PUBLIC_ORIGIN 用于前台渲染原站相对资源
- LOCAL_ATTACHMENT_STORAGE_DIR 用于保存本地化附件文件
- JWT_SECRET_ADMIN 必须自行设置
- AI_GATEWAY_URL 可为空，留空时直接调用 Google

## 安装与启动

在项目根目录执行：

```bash
npm install
npm install --prefix server
npm install --prefix admin
npm install --prefix blog
```

开发模式：

```bash
npm run dev
```

该命令会同时启动：

- server: http://127.0.0.1:3100
- admin: http://127.0.0.1:5173/multilingual-admin/
- blog: http://127.0.0.1:3101

首次启动后会自动初始化默认管理员：

- 用户名：admin
- 密码：admin123456

## 构建

单独构建：

```bash
npm run build:server
npm run build:admin
npm run build:blog
```

整体验证：

```bash
npm run build-all
```

当前仓库已经完成一次完整 build-all 验证并通过。

## 主要访问路径

- 管理后台: /multilingual-admin/
- 多语言首页: /en /jp /tw
- 文章详情: /:lang/post/:id
- 通用列表: /:lang/post/list
- 分类列表: /:lang/post/list/sort/:sortid
- 标签列表: /:lang/post/list/tag/:tagid
- 地点列表: /:lang/post/list/mappoint/:mappointid

## 后台工作流

1. 登录后台
2. 在导入页输入原站文章或推文 sourceId 与目标语言
3. 系统创建对应语言稿件，并同步共享实体与附件记录
4. 进入文章编辑页补全标题、摘要、正文和关联内容
5. 视情况执行单字段翻译、正文翻译或一键翻译
6. 手动检查共享实体和关联内容翻译状态
7. 上传本地化附件并替换需要本地托管的资源
8. 执行发布，系统会做发布前校验

## 服务端说明

服务端提供两类接口：

- /api/admin: 后台登录、导入、翻译、发布、实体管理、配置管理
- /api/blog: 前台只读接口，读取本地库已发布内容

本地化附件默认通过以下路径暴露：

- /localized/*

## 数据模型要点

- posts: 以 sourceId + languageCode 唯一确定一篇多语言文章
- groupSourceId: 归并同一原站内容的不同语言版本
- attachments: 区分 remote 与 localized 两种来源
- importJobs: 记录导入任务结果
- translationMemories / aiTranslationLogs: 记录翻译上下文与日志
- adminUsers 与 authors 分离，避免后台账号与内容作者混用

## 前台行为说明

- 仅展示已发布内容
- 默认根路径会跳转到 siteDefaultLanguageCode
- 正文中的原站相对资源会在运行时拼接到 SOURCE_BLOG_PUBLIC_ORIGIN
- 本地化附件保持 /localized 前缀直接访问
- 支持亮色与暗色主题

## 注意事项

- 原站仅作为导入来源和远程资源来源，不直接承担翻译站展示逻辑
- 发布前如果共享实体仍处于 pending、ai_draft、manual_draft、outdated 或 stub，系统会阻止发布
- blog 的 tsconfig 在未安装依赖前会提示 .nuxt/tsconfig.json 不存在，这是 Nuxt prepare 前的正常现象
- admin 构建可能出现 chunk size 警告，但不影响打包成功

## 后续建议

- 为生产环境补充 PM2 或容器部署脚本
- 增加真实数据联调用例与集成测试
- 根据站点视觉需求继续扩展 blog 组件与 SEO 配置
