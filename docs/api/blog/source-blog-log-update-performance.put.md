# PUT /api/source-blog/log/update/performance

## 概述

- 接口类型：源站 Blog 代理 API
- 说明：补充更新 open 日志的性能指标。
- 访问路径：`/api/source-blog/log/update/performance`
- 上游路径：`/api/blog/log/update/performance`
- 控制器：`D:/project/demo/wikimoeNodeJSBlog/server/api/blog/log/updateLogPerformanceNavigationTiming.js`
- 前端封装：`blog/app/api/log.js#putLogUpdatePerformanceApi`

## 请求

- Method：`PUT`
- URL：`/api/source-blog/log/update/performance`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `wmb-request-id` | Header | UUID v4 | 是 | 前端 `shouldUuid: true` 自动传入，用于防刷、投票、点赞或日志归属。 |
| `id` | Body | ObjectId | 是 | `/log/create` 返回的日志 ID。 |
| `action` | Body | open | 是 | 当前只允许 `open`。 |
| `performanceNavigationTiming` | Body | object | 是 | 浏览器性能指标。 |

## 行为

- 接口立即返回 `{}`。
- 只更新最近 2 分钟内、同 UUID、同 action 的 readerlog。
- 机器人、无效性能数据或 IP 黑名单会静默跳过。

## 成功响应

```json
{}
```

## 错误响应

- 503: 源站服务未就绪时由上游 `checkIsReady` 返回 `Service Unavailable`。
- 400: 请求参数校验失败或源站处于备份维护状态时返回 `{ errors: [{ message }] }`。
- 代理层会透传源站 `/api/blog` 的错误响应。

## 备注

- 无。
