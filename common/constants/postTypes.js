// 原站 posts.type 枚举
// 1 = 博文 blog
// 2 = 推文 tweet
// 3 = 页面 page（多语言站禁止导入）
const POST_TYPE_BLOG = 1
const POST_TYPE_TWEET = 2
const POST_TYPE_PAGE = 3

// 多语言站允许导入的类型白名单
const IMPORTABLE_POST_TYPES = [POST_TYPE_BLOG, POST_TYPE_TWEET]

// 多语言站文章状态
// 0 草稿 / 1 发布 / 99 回收站
const POST_STATUS_DRAFT = 0
const POST_STATUS_PUBLISHED = 1
const POST_STATUS_TRASH = 99

module.exports = {
  POST_TYPE_BLOG,
  POST_TYPE_TWEET,
  POST_TYPE_PAGE,
  IMPORTABLE_POST_TYPES,
  POST_STATUS_DRAFT,
  POST_STATUS_PUBLISHED,
  POST_STATUS_TRASH
}
