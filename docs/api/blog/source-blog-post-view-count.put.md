# PUT /api/source-blog/post/view/count

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：记录文章浏览并增加浏览数。
- 访问路径：`/api/source-blog/post/view/count`
- 上游路径：`/api/blog/post/view/count`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/post/updatePostViewCount.js`
- 前端封装：`blog/app/api/post.js#putViewCountApi`

## 请求

- Method：`PUT`
- URL：`/api/source-blog/post/view/count`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `id` | Body | ObjectId | 是 | 文章 ID。 |

## 行为

- 接口会先立即返回 `{}`，后续校验和写日志异步执行。
- 会写入 `readerlogs` 的 `postView`，并在配置允许时增加文章 `views`。
- IP 黑名单、UUID/ID 无效、每日行为超限或机器人访问可能被静默跳过。

## 成功响应

```json
{}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
