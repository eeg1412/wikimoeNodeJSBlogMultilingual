# GET /api/multilingual-blog/bangumi/list

## 概述

- 接口类型：多语言 Blog API
- 说明：分页获取番剧列表。
- 访问路径：`/api/multilingual-blog/bangumi/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/bangumi/getBangumiList.js`
- 前端封装：`blog/app/api/bangumi.js#getBangumiListApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/bangumi/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `page` | Query | number | 是 | 页码。 |
| `year` | Query | number | 否 | 年份。 |
| `season` | Query | 1 \| 2 \| 3 \| 4 | 否 | 季度。 |
| `sortType` | Query | rating | 否 | 为 `rating` 时按评分优先排序。 |
| `status` | Query | 99 | 否 | `99` 表示只看已弃番。 |
| `keyword` | Query | string | 否 | 按 `title` 或 `label` 模糊搜索，最长 20 字符。 |

## 行为

- 固定筛选 `status=1`；每页 20 条。

## 成功响应

```json
{
  "data": {
    "list": [
      {
        "_id": "ObjectId",
        "title": "...",
        "year": 2026,
        "season": 2,
        "rating": 9
      }
    ],
    "total": 123
  }
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
