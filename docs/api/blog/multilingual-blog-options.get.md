# GET /api/multilingual-blog/options

## 概述

- 接口类型：多语言 Blog API
- 说明：获取指定语言的站点配置。
- 访问路径：`/api/multilingual-blog/options`
- 上游路径：同访问路径
- 控制器：`server/api/blog/option/getoptionList.js`
- 前端封装：`blog/app/api/option.js#getMultilingualOptionsApi`

## 请求

- Method：`GET`
- URL：`/api/multilingual-blog/options`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `languageCode` | Query/Body | string | 否 | 语言代码；前端 `multilingualRequest` 会自动补齐，缺省时服务端使用默认语言。 |

## 行为

- 读取 `languageSettingsService.getLanguageSettings(languageCode)`。
- 返回当前语言配置值以及已配置的配置项名称。
- `siteTitle`、`siteDescription`、`siteLogo`、`siteFavicon` 由多语言站点配置维护；源站配置不再作为这些字段的 RSS 输出兜底。
- `siteUrl`、`siteTimeZone`、`sitePageSize`、相似内容数量与范围仍来自源站运行配置缓存，刷新入口在管理端“源站配置管理”。

## 成功响应

```json
{
  "data": {
    "siteName": "..."
  },
  "meta": {
    "configuredNames": ["siteName"]
  }
}
```

## 错误响应

- 503: 服务未就绪时由 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或服务处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 多语言接口会先校验 `languageCode` 是否可用于 Blog；未启用时返回 404。

## 备注

- 这是多语言配置接口；前端默认 `getOptionsApi` 走源站配置，`getMultilingualOptionsApi` 才走本接口。
