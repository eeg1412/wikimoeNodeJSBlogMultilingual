# GET /api/multilingual-blog/post/archive

## 概述

- 接口类型：多语言 Blog API
- 说明：获取文章归档列表。
- 访问路径：`/api/multilingual-blog/post/archive`
- 上游路径：同访问路径
- 控制器：`server/api/blog/post/getPostArchiveList.js`
- 前端封装：`blog/app/api/post.js#getArchiveApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/post/archive`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |

## 行为

- 优先读取语言缓存 `languageCache.postArchiveList`，缓存不存在时重新构建。

## 成功响应

```json
[
  {
    "year": 2026,
    "month": 5,
    "count": 10
  }
]
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
