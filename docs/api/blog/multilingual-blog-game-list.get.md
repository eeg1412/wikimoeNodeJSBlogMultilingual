# GET /api/multilingual-blog/game/list

## 概述

- 接口类型：多语言 Blog API
- 说明：分页获取游戏列表。
- 访问路径：`/api/multilingual-blog/game/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/game/getGameList.js`
- 前端封装：`blog/app/api/game.js#getGameListApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/game/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `page` | Query | number | 是 | 页码。 |
| `gamePlatformId` | Query | ObjectId | 否 | 游戏平台 ID。 |
| `sortType` | Query | rating | 否 | 为 `rating` 时按评分优先排序。 |
| `status` | Query | 99 \| 1 \| 2 \| 3 | 否 | `99` 放弃，`1` 未开始，`2` 进行中，`3` 已完成。 |
| `keyword` | Query | string | 否 | 按 `title` 或 `label` 模糊搜索，最长 20 字符。 |

## 行为

- 固定筛选 `status=1`；每页 20 条。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "title": "...",
      "gamePlatform": "ObjectId",
      "rating": 9
    }
  ],
  "total": 123
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
