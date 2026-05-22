# GET /api/source-blog/comment/latest

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：获取最新评论缓存列表。
- 访问路径：`/api/source-blog/comment/latest`
- 上游路径：`/api/blog/comment/latest`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/comment/getLatestComments.js`
- 前端封装：`blog/app/api/comment.js#getCommentLatestApi`

## 请求

- Method：`GET`
- URL：`/api/source-blog/comment/latest`

### 参数

无。

## 行为

- 优先读取源站 `global.$cacheData.commentList`，缓存不存在时重新构建。

## 成功响应

```json
[
  {
    "_id": "ObjectId",
    "content": "...",
    "nickname": "...",
    "post": {}
  }
]
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
