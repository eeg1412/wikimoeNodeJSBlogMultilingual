# GET /api/source-blog/options

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：获取源站站点配置。
- 访问路径：`/api/source-blog/options`
- 上游路径：`/api/blog/options`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/option/getoptionList.js`
- 前端封装：`blog/app/api/option.js#getOptionsApi`

## 请求

- Method：`GET`
- URL：`/api/source-blog/options`

### 参数

无。

## 行为

- Nuxt 代理将 `/api/source-blog/options` 重写到源站 `/api/blog/options`。

## 成功响应

```json
{
  "data": {
    "siteName": "...",
    "siteCommentPageSize": 10,
    "sitePageSize": 10
  }
}
```

## 错误响应

- 400: 源站全局配置缺失时返回 `{ errors: [{ message }] }`。

## 备注

- 无。
