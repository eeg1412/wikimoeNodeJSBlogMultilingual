# POST /api/source-blog/comment/retract

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：撤回 5 分钟内创建的评论。
- 访问路径：`/api/source-blog/comment/retract`
- 上游路径：`/api/blog/comment/retract`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/comment/commentRetract.js`
- 前端封装：`blog/app/api/comment.js#deleteCommentRetractApi`

## 请求

- Method：`POST`
- URL：`/api/source-blog/comment/retract`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `wm-comment-retract-authorization` | Header | Bearer JWT | 是 | 评论创建接口返回的撤回 JWT。 |
| `id` | Body | ObjectId | 是 | 评论 ID。 |

## 行为

- JWT 必须包含该评论且评论创建时间在 5 分钟内。
- 受 `siteCommentRetractLimit` 每日撤回次数限制。
- 撤回公开评论时会同步减少文章评论数并刷新最新评论缓存。

## 成功响应

```json
{
  "data": {
    "message": "撤回成功"
  },
  "commentRetractCountData": {
    "count": 1,
    "todayStartTime": "2026-05-22T00:00:00.000Z",
    "todayEndTime": "2026-05-22T23:59:59.999Z"
  }
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
