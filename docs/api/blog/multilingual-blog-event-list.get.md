# GET /api/multilingual-blog/event/list

## 概述

- 接口类型：多语言 Blog API
- 说明：获取指定时间范围内的事件列表。
- 访问路径：`/api/multilingual-blog/event/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/event/getEventList.js`
- 前端封装：`blog/app/api/event.js#getEventListApiFetch`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/event/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `startTime` | Query | ISO8601 string | 是 | 范围开始时间，严格 ISO8601。 |
| `endTime` | Query | ISO8601 string | 是 | 范围结束时间，严格 ISO8601。 |

## 行为

- `endTime` 必须大于等于 `startTime`。
- 查询区间不能超过 40 天。
- 时间范围必须在 1978-01-01 到当前时间后 21 年之间。
- 返回与该时间范围有交集的公开翻译事件。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "title": "...",
      "startTime": "2026-05-22T00:00:00.000Z",
      "endTime": "2026-05-22T01:00:00.000Z"
    }
  ]
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
