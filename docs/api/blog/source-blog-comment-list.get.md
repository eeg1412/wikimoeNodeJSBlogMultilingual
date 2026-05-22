# GET /api/source-blog/comment/list

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：分页获取文章评论。
- 访问路径：`/api/source-blog/comment/list`
- 上游路径：`/api/blog/comment/list`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/comment/getCommentList.js`
- 前端封装：`blog/app/api/comment.js#getCommentListApi`

## 请求

- Method：`GET`
- URL：`/api/source-blog/comment/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 否 | 存在时用于返回该访客待审核评论或记录行为。 |
| `page` | Query | number | 是 | 页码。 |
| `id` | Query | ObjectId | 是 | 文章 ID。 |
| `sorttype` | Query | like | 否 | 为 `like` 时按点赞数排序，否则按置顶和时间排序。 |

## 行为

- 分页大小来自源站 `global.$globalConfig.commentSettings.siteCommentPageSize`。
- 默认返回公开评论；传入 UUID 时也返回该 UUID 自己的待审核评论。
- 会把邮箱转换为 Gravatar hash，管理员评论使用用户头像和昵称。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "content": "...",
      "nickname": "...",
      "likes": 0,
      "parent": null,
      "status": 1
    }
  ],
  "total": 20,
  "size": 10
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
