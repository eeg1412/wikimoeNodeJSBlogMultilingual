# GET /api/multilingual-blog/trend/post/list

## 概述

- 接口类型：多语言 Blog API
- 说明：获取热门文章列表。
- 访问路径：`/api/multilingual-blog/trend/post/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/trend/getTrendPostList.js`
- 前端封装：`blog/app/api/trend.js#getTrendPostListApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/trend/post/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |

## 行为

- 读取侧边栏中 `type=12` 的配置，使用其 `count` 作为数量。
- 从源站 readerlogs 中统计最近 24 小时 `postView`，再映射到当前语言的翻译文章。
- 结果缓存约 2 分钟。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "sourceId": "ObjectId",
      "target": "blog",
      "hot": 13,
      "postDetail": {
        "_id": "ObjectId",
        "title": "..."
      }
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
