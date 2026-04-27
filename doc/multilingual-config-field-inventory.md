# Multilingual Config Field Inventory

## 结论

多语言后台语言 tab 只维护 `language-owned` 字段。写入多语言 DB 的 `options` 记录使用 `scope: 'multilingual'`、`languageCode`、`name`、`value`；`value` 模型层为 String，接口返回时按默认值转换为业务类型。

## language-owned 字段

| 字段                                                                                      | 类型 / 默认值         | 理由                                                        |
| ----------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `siteTitle`, `siteSubTitle`                                                               | String / `''`         | 站点标题、副标题直接进入页面 title、OG/Twitter 和布局展示。 |
| `siteDescription`, `siteKeywords`                                                         | String / `''`         | SEO 与侧栏站点描述需要按语言维护。                          |
| `siteLogo`, `siteDarkLogo`, `siteFavicon`, `siteDefaultCover`                             | String / `''`         | 品牌图、favicon、默认封面会进入布局和 SEO 图片。            |
| `siteShowLoadingText`                                                                     | String / `''`         | 加载文案是可见语言内容。                                    |
| `siteShareDescription`                                                                    | String / `''`         | 分享文案会按文章替换变量，需要语言化。                      |
| `siteFooterInfo`                                                                          | String/HTML / `''`    | 页脚自定义信息直接展示，需要语言化。                        |
| `sitePostBlogCommonFooterOpen`, `sitePostTweetCommonFooterOpen`                           | Boolean / `false`     | 控制该语言文章/推文底部共通内容是否展示。                   |
| `sitePostBlogCommonFooterContent`, `sitePostTweetCommonFooterContent`                     | String/HTML / `''`    | 文章页公共内容是可见文案。                                  |
| `sitePostBlogCommonFooterContentIsRichMode`, `sitePostTweetCommonFooterContentIsRichMode` | Boolean / `true`      | 渲染模式应随对应语言内容保存。                              |
| `sitePostRandomSimilarTitle`                                                              | String / `'相似内容'` | 随机相似内容标题直接展示。                                  |

## source-owned / runtime-global 示例

| 分类             | 字段示例                                                                                                                                    | 原因                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `source-owned`   | 评论配置、邮件配置、媒体压缩配置、Google Ad ID、`AdAdsTxt`                                                                                  | 源站接管评论/邮件/广告账号/处理策略，多语言后台不编辑。 |
| `runtime-global` | `siteUrl`, `siteTimeZone`, `siteEnableSitemap`, `siteEnableRss`, `siteRssMaxCount`, `siteRssTweetTitleType`                                 | 影响部署、RSS/Sitemap 生成或时间格式，不按语言分叉。    |
| `runtime-global` | `siteAllowSwitchTheme`, `siteThemeMode`, `sitePageSize`, `siteTopSlideTime`, `siteSharePlatforms`, `siteShowLoading`, `siteShowBlogVersion` | 全站体验策略，不含语言文案。                            |
| `runtime-global` | `siteShowSitemapInFooter`, `siteShowRssInFooter`                                                                                            | 当前只是显示开关，页脚文字来自语言包。                  |
| `runtime-global` | `siteExtraCss`, `siteExtraJs`, `siteRobotsTxt`, `siteGravatarSource`, IP 黑名单、白名单、敏感词、管理员登录限制                             | 安全、SEO、资源或运维策略，不进入语言 tab。             |

## 缺口

- `siteShareImage` 在现有 `Config*.vue`、`globalConfig.js`、`options` 模型中未发现，不能列入已确认 language-owned。
- RSS title/description、语言 sitemap 元信息没有现有 option 字段；如要实现，需要另行新增字段并确认默认值。
- 现有 blog options 接口仍会平铺返回评论、广告、地图等非 language-owned 配置；多语言设置页按 ownership 边界拆分。
