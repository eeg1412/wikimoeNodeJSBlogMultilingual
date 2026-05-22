# POST /api/multilingual-blog/vote

## 概述

- 接口类型：多语言 Blog API
- 说明：提交投票。
- 访问路径：`/api/multilingual-blog/vote`
- 上游路径：同访问路径
- 控制器：`server/api/blog/vote/postVote.js`
- 前端封装：`blog/app/api/vote.js#postVoteApi`

## 请求

- Method：`POST`
- URL：`/api/multilingual-blog/vote`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `voteId` | Body | ObjectId | 是 | 投票 ID。 |
| `postId` | Body | ObjectId | 否 | 关联文章 ID。 |
| `optionIdList` | Body | Array<ObjectId> | 是 | 选择的投票选项 ID，不能为空。 |

## 行为

- 拒绝 IP 黑名单和搜索引擎机器人。
- 校验投票存在、未过期、选项均存在且不超过 `maxSelect`。
- 同一 UUID 或 IP 已投票时拒绝。
- 成功后增加投票总数和选项票数，并异步保存投票日志。

## 成功响应

```json
{
  "data": {
    "_id": "ObjectId",
    "votes": 10,
    "options": []
  },
  "voted": true
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 无。
