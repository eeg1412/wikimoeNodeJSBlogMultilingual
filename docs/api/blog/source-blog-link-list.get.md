# GET /api/source-blog/link/list

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：获取友情链接列表。
- 访问路径：`/api/source-blog/link/list`
- 上游路径：`/api/blog/link/list`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/link/getlinkList.js`
- 前端封装：`blog/app/api/link.js#getLinkListApi`

## 请求

- Method：`GET`
- URL：`/api/source-blog/link/list`

### 参数

无。

## 行为

- 筛选 `status=1`，按 `taxis` 升序、`_id` 倒序返回。

## 成功响应

```json
{
  "list": [
    {
      "_id": "ObjectId",
      "name": "...",
      "url": "...",
      "status": 1
    }
  ]
}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
