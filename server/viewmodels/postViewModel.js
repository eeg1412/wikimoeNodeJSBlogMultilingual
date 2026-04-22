import {
  resolveAttachmentSrc,
  resolveContentHtmlAssets
} from '../utils/sourceAssetResolver.js'
import { getSiteConfig } from '../config/globalConfig.js'

/**
 * 把原始 Post lean 文档映射为模板可直接消费的 ViewModel
 */
export function mapPostToViewModel(post, options = {}) {
  return {
    _id: String(post._id),
    title: post.title || '',
    excerpt: post.excerpt || '',
    alias: post.alias || '',
    type: post.type,
    date: post.date ? new Date(post.date).toISOString() : '',
    dateFormatted: post.date ? formatDate(new Date(post.date)) : '',
    languageCode: post.languageCode,

    // 封面图（第一张）
    coverSrc:
      post.coverImages && post.coverImages.length > 0
        ? resolveAttachmentSrc(post.coverImages[0])
        : '',

    // 作者
    author: post.author
      ? {
          _id: String(post.author._id),
          nickname: post.author.nickname || '',
          photoSrc: post.author.photoAttachment
            ? resolveAttachmentSrc(post.author.photoAttachment)
            : ''
        }
      : null,

    // 分类
    sort: post.sort
      ? {
          _id: String(post.sort._id),
          sortname: post.sort.sortname || '',
          alias: post.sort.alias || ''
        }
      : null,

    // 标签
    tags: (post.tags || []).map(t => ({
      _id: String(t._id),
      tagname: t.tagname || ''
    })),

    // 地点
    mappointList: (post.mappointList || []).map(mp => ({
      _id: String(mp._id),
      title: mp.title || '',
      longitude: mp.longitude,
      latitude: mp.latitude
    }))
  }
}

/**
 * 把原始 Post lean 文档映射为详情页 ViewModel（含正文）
 */
export function mapPostDetailToViewModel(post, hreflangAlternates = []) {
  const siteConfig = getSiteConfig()
  const siteUrl = siteConfig.url || siteConfig.siteUrl || ''

  const base = mapPostToViewModel(post)

  // 处理正文中的内部资源路径
  const content = post.content
    ? resolveContentHtmlAssets(post.content)
    : ''

  const pageUrl = `${siteUrl}/${post.languageCode}/post/${post.alias || post._id}`
  const canonicalUrl = pageUrl

  // hreflang
  const hreflang = hreflangAlternates.map(alt => ({
    lang: alt.languageCode,
    url: `${siteUrl}/${alt.languageCode}/post/${alt.alias || alt._id}`
  }))

  // 关联实体
  const entities = {
    bangumiList: (post.bangumiList || []).map(mapEntityToViewModel),
    movieList: (post.movieList || []).map(mapEntityToViewModel),
    gameList: (post.gameList || []).map(mapEntityToViewModel),
    bookList: (post.bookList || []).map(mapEntityToViewModel),
    eventList: (post.eventList || []).map(mapEntityToViewModel),
    voteList: (post.voteList || []).map(mapVoteToViewModel),
    postList: (post.postList || []).map(mapRelatedPostToViewModel),
    tweetList: (post.tweetList || []).map(mapRelatedPostToViewModel),
    contentBangumiList: (post.contentBangumiList || []).map(
      mapEntityToViewModel
    ),
    contentMovieList: (post.contentMovieList || []).map(mapEntityToViewModel),
    contentGameList: (post.contentGameList || []).map(mapEntityToViewModel),
    contentBookList: (post.contentBookList || []).map(mapEntityToViewModel),
    contentEventList: (post.contentEventList || []).map(mapEntityToViewModel),
    contentVoteList: (post.contentVoteList || []).map(mapVoteToViewModel),
    contentPostList: (post.contentPostList || []).map(
      mapRelatedPostToViewModel
    ),
    contentTweetList: (post.contentTweetList || []).map(
      mapRelatedPostToViewModel
    )
  }

  return {
    ...base,
    content,
    canonicalUrl,
    hreflang,
    metaTitle: post.title || '',
    metaDescription: post.excerpt || '',
    entities,
    coverImages: (post.coverImages || []).map(img => ({
      src: resolveAttachmentSrc(img),
      name: img.name || '',
      width: img.width || 0,
      height: img.height || 0
    }))
  }
}

function mapEntityToViewModel(entity) {
  if (!entity) return null
  return {
    _id: String(entity._id),
    title: entity.title || '',
    description: entity.description || '',
    translationStatus: entity.translationStatus
  }
}

function mapVoteToViewModel(vote) {
  if (!vote) return null
  return {
    _id: String(vote._id),
    title: vote.title || '',
    options: (vote.options || []).map(opt => ({
      sourceOptionId: opt.sourceOptionId,
      title: opt.title || ''
    }))
  }
}

function mapRelatedPostToViewModel(post) {
  if (!post) return null
  return {
    _id: String(post._id),
    title: post.title || '',
    alias: post.alias || '',
    type: post.type,
    languageCode: post.languageCode
  }
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
