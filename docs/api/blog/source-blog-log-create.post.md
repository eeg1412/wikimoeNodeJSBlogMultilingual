# POST /api/source-blog/log/create

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：创建读者行为日志。
- 访问路径：`/api/source-blog/log/create`
- 上游路径：`/api/blog/log/create`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/log/createLog.js`
- 前端封装：`blog/app/api/log.js#postLogCreateApi`

## 请求

- Method：`POST`
- URL：`/api/source-blog/log/create`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `action` | Body | string | 是 | 允许：`open`、`postList`、`postListArchive`、`postListKeyword`、`postListSort`、`postListTag`、`postListBangumi`、`postListMovie`、`postListBook`、`postListGame`、`postListMappoint`。 |
| `referrer` | Body | string | 否 | 来源地址。 |
| `performanceNavigationTiming` | Body | object | 否 | `open` 行为可传性能指标。 |
| `timeZone` | Body | string | 否 | `open` 行为可传浏览器时区。 |
| `language` | Body | string | 否 | `open` 行为可传浏览器语言。 |
| `title` | Body | string | 否 | `postListArchive` 或 `postListMappoint` 需要。 |
| `keyword` | Body | string | 否 | `postListKeyword` 需要。 |
| `sortid/sortname` | Body | ObjectId/string | 否 | `postListSort` 需要。 |
| `tagid/tagname` | Body | ObjectId/string | 否 | `postListTag` 需要。 |
| `mappointid` | Body | ObjectId | 否 | `postListMappoint` 需要。 |
| `bangumiid/banguminame` | Body | ObjectId/string | 否 | `postListBangumi` 需要。 |
| `movieid/moviename` | Body | ObjectId/string | 否 | `postListMovie` 需要。 |
| `bookid/bookname` | Body | ObjectId/string | 否 | `postListBook` 需要。 |
| `gameid/gamename` | Body | ObjectId/string | 否 | `postListGame` 需要。 |

## 行为

- 接口会先生成日志 ID 并立即返回，后续校验和写入异步执行。
- 无效 action、UUID、ID、IP 黑名单或每日行为超限会静默跳过写入。
- 内容字段会截断到 20 字符。

## 成功响应

```json
{
  "id": "ObjectId"
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
