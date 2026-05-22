# GET /api/multilingual-blog/post/detail

## 概述

- 接口类型：多语言 Blog API
- 说明：获取文章、动态或页面详情。
- 访问路径：`/api/multilingual-blog/post/detail`
- 上游路径：同访问路径
- 控制器：`server/api/blog/post/getPostDetail.js`
- 前端封装：`blog/app/api/post.js#getDetailApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/post/detail`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `id` | Query | ObjectId\|string | 是 | 文章 `_id`、源站 `sourceId` 或 alias；alias 长度不能超过 64。 |
| `type` | Query | Array<number> | 否 | 限制文章类型。 |
| `randompost` | Query | 1 | 否 | 为 `1` 时按配置返回相似随机文章。 |

## 行为

- 固定筛选 `languageCode`、`recordKind=translation`、`status=1`。
- 如果 `id` 是 ObjectId 且按 `_id` 未命中，会再按 `sourceId` 查询。
- 返回前会同步源站互动统计；开启 `randompost=1` 且站点配置允许时，附加 `randomPostList`。

## 成功响应

```json
{
  "data": {
    "_id": "ObjectId",
    "sourceId": "ObjectId",
    "title": "...",
    "content": "...",
    "randomPostList": []
  }
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。
- 404: 指定文章不存在。

## 备注

- 无。
