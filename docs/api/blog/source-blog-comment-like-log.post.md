# POST /api/source-blog/comment/like/log

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：创建或更新评论点赞记录。
- 访问路径：`/api/source-blog/comment/like/log`
- 上游路径：`/api/blog/comment/like/log`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/commentLikeLog/createCommentLikeLog.js`
- 前端封装：`blog/app/api/comment.js#postCommentLikeLogApi`

## 请求

- Method：`POST`
- URL：`/api/source-blog/comment/like/log`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `id` | Body | ObjectId | 是 | 评论 ID。 |
| `like` | Body | boolean | 是 | `true` 点赞，`false` 取消点赞。 |
| `__v` | Body | number | 否 | 更新已有点赞记录时用于乐观锁校验。 |

## 行为

- 拒绝 IP 黑名单和搜索引擎机器人。
- 同一 UUID 对同一评论只保留一条点赞记录。
- 成功后异步更新评论 `likes` 并写 readerlog。

## 成功响应

```json
{
  "data": {
    "_id": "ObjectId",
    "comment": "ObjectId",
    "like": true,
    "__v": 0
  }
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
