# GET /api/multilingual-blog/vote/detail

## 概述

- 接口类型：多语言 Blog API
- 说明：获取投票详情和当前访客投票状态。
- 访问路径：`/api/multilingual-blog/vote/detail`
- 上游路径：同访问路径
- 控制器：`server/api/blog/vote/getVoteDetail.js`
- 前端封装：`blog/app/api/vote.js#getVoteDetailApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/vote/detail`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `id` | Query | ObjectId | 是 | 投票 ID。 |

## 行为

- 按投票 ID 和 `status=1` 查询。
- 通过 UUID 或 IP 查找投票记录。
- 如果配置为投票后显示结果，且当前访客未投票且投票未过期，会隐藏票数。

## 成功响应

```json
{
  "data": {
    "_id": "ObjectId",
    "title": "...",
    "options": []
  },
  "voted": false,
  "options": [],
  "isExpired": false,
  "bothIP": false,
  "bothUUID": false
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
