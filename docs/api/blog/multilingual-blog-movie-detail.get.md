# GET /api/multilingual-blog/movie/detail

## 概述

- 接口类型：多语言 Blog API
- 说明：获取电影详情。
- 访问路径：`/api/multilingual-blog/movie/detail`
- 上游路径：同访问路径
- 控制器：`server/api/blog/movie/getMovieDetail.js`
- 前端封装：`blog/app/api/movie.js#getMovieDetailApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/movie/detail`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `id` | Query | ObjectId | 是 | 电影 ID。 |

## 行为

- 按 `_id` 和 `status=1` 查询，详情会 populate `title` 相关字段。

## 成功响应

```json
{
  "data": {
    "_id": "ObjectId",
    "title": "...",
    "summary": "..."
  }
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。
- 404: 电影不存在。

## 备注

- 无。
