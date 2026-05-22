# PUT /api/source-blog/post/share/count

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：记录文章分享并增加分享数。
- 访问路径：`/api/source-blog/post/share/count`
- 上游路径：`/api/blog/post/share/count`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/post/updatePostShareCount.js`
- 前端封装：`blog/app/api/post.js#putShareCountApi`

## 请求

- Method：`PUT`
- URL：`/api/source-blog/post/share/count`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `id` | Body | ObjectId | 是 | 文章 ID。 |
| `sharePlatform` | Body | string | 是 | 分享平台，必须在源站 `siteSharePlatforms` 配置内。 |

## 行为

- 同一 UUID/IP 对同一文章同一平台当天只计一次。
- 拒绝 IP 黑名单、机器人、无效平台和每日行为超限。
- 成功时写 `readerlogs` 的 `postShare` 并增加文章 `shares`。

## 成功响应

```json
{
  "add": true
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
