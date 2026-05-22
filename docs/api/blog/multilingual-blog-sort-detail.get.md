# GET /api/multilingual-blog/sort/detail

## 概述

- 接口类型：多语言 Blog API
- 说明：获取分类详情。
- 访问路径：`/api/multilingual-blog/sort/detail`
- 上游路径：同访问路径
- 控制器：`server/api/blog/sort/getSortDetail.js`
- 前端封装：`blog/app/api/sort.js#getSortDetailApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/sort/detail`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `id` | Query | ObjectId\|string | 是 | 分类 `_id` 或 alias，最长 64 字符。 |

## 行为

- 从语言缓存分类树中递归查找。
- 响应只保留 `_id`、`sortname`、`taxis`、`description`。

## 成功响应

```json
{
  "_id": "ObjectId",
  "sortname": "...",
  "taxis": 0,
  "description": "..."
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。
- 404: 分类列表获取失败或分类不存在。

## 备注

- 无。
