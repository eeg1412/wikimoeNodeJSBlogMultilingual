# POST /api/source-blog/comment/create

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：创建评论。
- 访问路径：`/api/source-blog/comment/create`
- 上游路径：`/api/blog/comment/create`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/comment/createComment.js`
- 前端封装：`blog/app/api/comment.js#getCommentCreateApi`

## 请求

- Method：`POST`
- URL：`/api/source-blog/comment/create`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `wm-comment-retract-authorization` | Header | Bearer JWT | 否 | 已有评论撤回 JWT；用于合并 5 分钟内可撤回评论列表。 |
| `post` | Body | ObjectId | 是 | 文章 ID。 |
| `content` | Body | string | 是 | 评论内容，最长 500，且不能短于站点最小评论长度。 |
| `nickname` | Body | string | 是 | 昵称，最长 20。 |
| `email` | Body | string | 否 | 邮箱，最长 100，需满足邮箱格式。 |
| `url` | Body | string | 否 | 网址，最长 200，仅允许 http/https 且需完整主机名。 |
| `parent` | Body | ObjectId | 否 | 父评论 ID。 |

## 行为

- 校验评论功能是否开启、IP 黑名单、敏感词、机器人、评论间隔、文章是否允许评论。
- 开启评论审核时新评论 `status=0`，否则 `status=1` 并增加文章评论数。
- 成功后返回新的 `commentRetractJWT`，用于 5 分钟内撤回。

## 成功响应

```json
{
  "status": 1,
  "commentRetractJWT": "jwt"
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
