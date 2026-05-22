# GET /api/multilingual-blog/post/list

## 概述

- 接口类型：多语言 Blog API
- 说明：分页获取文章或动态列表。
- 访问路径：`/api/multilingual-blog/post/list`
- 上游路径：同访问路径
- 控制器：`server/api/blog/post/getPostList.js`
- 前端封装：`blog/app/api/post.js#getPostsApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/post/list`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |
| `page` | Query | number | 是 | 页码；必须能解析为数字。 |
| `keyword` | Query | string | 否 | 按标题、摘要、标签、地图点搜索；会 trim，并截断到 20 个字符。 |
| `type` | Query | 1 \| 2 \| Array<1 \| 2> | 否 | 文章类型：`1` 博客，`2` 动态；缺省查询两者。 |
| `sorttype` | Query | string | 否 | 排序：`date_ascending`、`date_descending`、`views_ascending`、`views_descending`、`comnum_ascending`、`comnum_descending`、`likes_ascending`、`likes_descending`、`updatedAt_ascending`、`updatedAt_descending`。 |
| `sortid` | Query | ObjectId\|string | 否 | 分类 ID 或 alias；命中父分类时会包含直接子分类。 |
| `tags` | Query | Array<ObjectId> | 否 | 标签 ID 数组。 |
| `mappointid` | Query | ObjectId | 否 | 地图点 ID。 |
| `bangumiId` | Query | ObjectId | 否 | 番剧 ID，匹配正文关联或侧栏关联。 |
| `movieId` | Query | ObjectId | 否 | 电影 ID，匹配正文关联或侧栏关联。 |
| `bookId` | Query | ObjectId | 否 | 书籍 ID，匹配正文关联或侧栏关联。 |
| `gameId` | Query | ObjectId | 否 | 游戏 ID，匹配正文关联或侧栏关联。 |
| `pageType` | Query | post \| sort | 否 | `post` 时置顶优先，`sort` 时分类置顶优先。 |
| `year` | Query | number | 否 | 归档年份；需要和 `month` 同时传入。 |
| `month` | Query | number | 否 | 归档月份，1-12；需要和 `year` 同时传入。 |

## 行为

- 固定筛选 `languageCode`、`recordKind=translation`、`status=1`。
- 分页大小来自 `global.$globalConfig.siteSettings.sitePageSize`，缺省为 1。
- 互动量排序会从源站文章同步 `views`、`likes`、`shares`、`comnum` 后再分页。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "title": "...",
      "alias": "...",
      "type": 1,
      "views": 0,
      "likes": 0,
      "comnum": 0
    }
  ],
  "total": 123,
  "size": 10
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 列表响应会过滤正文、投票列表、部分关联列表和 `editorVersion` 等较重字段。
