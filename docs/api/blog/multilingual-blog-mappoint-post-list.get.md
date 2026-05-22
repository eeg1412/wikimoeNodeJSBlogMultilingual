# GET /api/multilingual-blog/mappoint/post/list

## 概述

- 接口类型：多语言 Blog API
- 说明：分页获取地图点关联文章。
- 访问路径：`/api/multilingual-blog/mappoint/post/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/mappoint/getMappointPostList.js`
- 前端封装：`blog/app/api/mappoint.js#getMappointPostListApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/mappoint/post/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `id` | Query | ObjectId | 是 | 地图点 ID。 |
| `page` | Query | number | 否 | 页码，缺省为 1。 |

## 行为

- 筛选 `status=1` 且 `mappointList` 包含该地图点；每页固定 10 条。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "title": "...",
      "date": "2026-05-22T00:00:00.000Z",
      "coverImage": {}
    }
  ],
  "total": 123,
  "page": 1,
  "size": 10
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
