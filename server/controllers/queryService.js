/**
 * 博客端 Query Service
 * 页面控制器直接调用这里，禁止通过 HTTP 自调 /api/blog
 */
import Post from '../mongodb/models/post.js'
import Sort from '../mongodb/models/sort.js'
import Tag from '../mongodb/models/tag.js'
import Mappoint from '../mongodb/models/mappoint.js'
import { POST_STATUS } from '../../common/constants/index.js'
import { findPostPage, findPostForDetail } from '../mongodb/utils/posts.js'

/**
 * 文章列表查询
 */
export async function queryPostList({
  languageCode,
  page = 1,
  limit = 10,
  type,
  sortId,
  tagId,
  mappointId
}) {
  const query = { languageCode, status: POST_STATUS.PUBLISHED }
  if (type) query.type = parseInt(type)
  if (sortId) query.sort = sortId
  if (tagId) query.tags = tagId
  if (mappointId) query.mappointList = mappointId

  return findPostPage({ query, page, limit, sort: { date: -1 } })
}

/**
 * 文章详情查询
 */
export async function queryPostDetail(idOrAlias, languageCode) {
  return findPostForDetail(idOrAlias, languageCode)
}

/**
 * 分类列表查询
 */
export async function querySortList(languageCode) {
  return Sort.find({ languageCode }).sort({ taxis: 1 }).lean()
}

/**
 * 按 alias 或 _id 查分类详情
 */
export async function querySortDetail(aliasOrId, languageCode) {
  let sort = await Sort.findOne({ alias: aliasOrId, languageCode }).lean()
  if (!sort) {
    try {
      sort = await Sort.findOne({ _id: aliasOrId, languageCode }).lean()
    } catch {
      // 无效 ID
    }
  }
  return sort
}

/**
 * 标签详情
 */
export async function queryTagDetail(id, languageCode) {
  let tag = await Tag.findOne({ sourceId: id, languageCode }).lean()
  if (!tag) {
    tag = await Tag.findOne({ _id: id, languageCode })
      .lean()
      .catch(() => null)
  }
  return tag
}

/**
 * 地点详情
 */
export async function queryMappointDetail(id, languageCode) {
  let mp = await Mappoint.findOne({
    sourceId: id,
    languageCode,
    status: 1
  }).lean()
  if (!mp) {
    mp = await Mappoint.findOne({ _id: id, languageCode, status: 1 })
      .lean()
      .catch(() => null)
  }
  return mp
}

/**
 * 同 groupSourceId 的其他语言已发布文章（用于 hreflang）
 */
export async function queryHreflangAlternates(
  groupSourceId,
  currentLanguageCode
) {
  return Post.find({
    groupSourceId,
    status: POST_STATUS.PUBLISHED,
    languageCode: { $ne: currentLanguageCode }
  })
    .select('languageCode alias _id')
    .lean()
}
