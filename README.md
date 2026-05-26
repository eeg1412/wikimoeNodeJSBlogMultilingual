# 维基萌多语言站子系统

这是源站的多语言后台和多语言内容服务，不是独立 blog 前台。

部署完成后，主要会提供这几类能力：

- 多语言后台页面：`/multilingual-admin`
- 多语言后台 API：`/api/multilingual-admin/*`
- 多语言内容 API：`/api/multilingual-blog/*`
- 多语言资源路径：`/multilingual-assets/*`
- 多语言 RSS 和 Sitemap

## 技术组成

- `server`：Node.js + Express + MongoDB，负责多语言后台 API、内容 API、RSS、Sitemap、翻译任务。
- `admin`：Vue 3 + Vite，构建后产物会直接输出到 `server/front/multilingual-admin`，由 server 提供访问。
- `panorama-viewer`：独立静态工具，只有你要用全景图查看器时才需要单独构建。主部署不依赖它。

## 运行要求

- Node.js 20.19+
- Yarn Classic 1.x
- MongoDB 8

## 环境变量说明

普通部署时，把 `server/sample.env` 复制成 `server/.env` 再修改。

Docker 部署时，在项目根目录创建 `.env`，变量名保持一致。

| 变量名 | 是否必填 | 例子 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 建议填写 | `3016` | 多语言 server 监听端口。 |
| `DB_HOST` | 必填 | `mongodb://127.0.0.1:27017/blog` | 源站数据库连接串。 |
| `DB_HOST_MULTILINGUAL` | 必填 | `mongodb://127.0.0.1:27017/blog_multilingual` | 多语言数据库连接串，不能和 `DB_HOST` 指向同一个库。 |
| `JSON_LIMIT` | 可选 | `50mb` | JSON 请求体大小限制。 |
| `URLENCODED_LIMIT` | 可选 | `50mb` | 表单请求体大小限制。 |
| `SOURCE_DOMAIN` | 按需填写 | `https://source.example.com` | 源站域名。做源站认证校验、回调源站接口、回源拉取封面图时会用到。 |
| `IP2LOCATION_FILE_NAME` | 可选 | `IP2LOCATION-LITE-DB11.BIN` | IP 地址库文件名，文件本体放在 `server/utils/ip2location`。 |
| `MAX_HISTORYLOGS_SIZE` | 可选 | `1073741824` | 历史日志最大占用，单位字节。 |

## Docker 部署

### 1. 准备 `.env`

在项目根目录新建 `.env`，最少填这些：

```env
PORT=3016
DB_HOST=mongodb://mongodb:27017/blog
DB_HOST_MULTILINGUAL=mongodb://mongodb:27017/blog_multilingual
JSON_LIMIT=50mb
URLENCODED_LIMIT=50mb
SOURCE_DOMAIN=https://source.example.com
IP2LOCATION_FILE_NAME=
MAX_HISTORYLOGS_SIZE=1073741824
```

说明：

- `mongodb` 是 `docker-compose.yml` 里的数据库服务名。
- `DB_HOST` 和 `DB_HOST_MULTILINGUAL` 必须是两个不同的数据库。
- 如果现在还没接源站联动，可以先留空 `SOURCE_DOMAIN`，但涉及源站认证或回源取图时要补上。

### 2. 启动服务

```bash
docker compose up -d --build
```

启动后会创建这些持久化目录：

- `data/wikimoe-multilingual-server`
- `data/wikimoe-multilingual-db`

### 3. 登录后台

后台地址：`http://你的服务器IP:3016/multilingual-admin`

多语言后台没有独立的管理员账号系统。

登录时直接使用源站数据库里的管理员账号：

- 用户来源：`DB_HOST` 指向的源站数据库 `users` 集合
- 账号要求：必须是源站管理员账号
- 密码：和源站后台密码一致

这套服务不会自动创建管理员，也不应该单独创建一套多语言站账号。

## 普通部署

### 1. 配置服务端环境变量

复制一份环境变量模板：

```bash
cp server/sample.env server/.env
```

然后按上面的说明把 `server/.env` 改好。

### 2. 编译后台并安装服务端依赖

```bash
yarn --cwd admin install
yarn --cwd admin build
yarn --cwd server install
```

### 3. 启动服务

```bash
yarn --cwd server run start
```

后台地址同样是：`http://你的服务器IP:3016/multilingual-admin`

登录时直接使用源站管理员账号，不需要在多语言站再创建一次用户。

## 根目录快捷命令

如果你已经准备好了 `server/.env`，也可以直接在根目录执行：

```bash
yarn run start --build
```

这条命令会做三件事：

- 安装并构建 admin
- 安装 server 依赖
- 直接启动 server

登录仍然使用源站管理员账号。

## Docker 工作流

仓库已经提供 GitHub Actions 工作流：

- 文件位置：`.github/workflows/docker.yml`
- 触发条件：推送 `main`，或者推送 `v*` tag
- 行为：构建多语言 server 镜像；打 tag 时推送到 Docker Hub

默认镜像名是 `eeg1412/wikimoe-multilingual-server`。如果你的 Docker Hub 仓库名不同，改工作流里的 `IMAGE_NAME` 就行。
