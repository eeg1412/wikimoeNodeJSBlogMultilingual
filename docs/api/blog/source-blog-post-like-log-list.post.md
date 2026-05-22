# POST /api/source-blog/post/like/log/list

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：批量获取当前访客对文章的点赞记录。
- 访问路径：`/api/source-blog/post/like/log/list`
- 上游路径：`/api/blog/post/like/log/list`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/postLikeLog/getPostLikeLogList.js`
- 前端封装：`blog/app/api/post.js#postLikeLogListApi`

## 请求

- Method：`POST`
- URL：`/api/source-blog/post/like/log/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `postIdList` | Body | Array<ObjectId> | 是 | 文章 ID 列表。 |

## 行为

- 按当前 UUID 和 `postIdList` 查询点赞记录。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "post": "ObjectId",
      "like": true,
      "__v": 0
    }
  ]
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
