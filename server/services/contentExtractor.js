import * as cheerio from 'cheerio'
import {
  SOURCE_ASSET_PATH_PREFIXES,
  DANGEROUS_URL_PROTOCOLS,
  ATTACHMENT_IMPORT_ORIGIN
} from '../../common/constants/index.js'
import {
  normalizeSourceUrl,
  computeSourcePathHash,
  computeExternalUrlHash
} from '../utils/sourceUrlNormalizer.js'
import { creatSha256Str, md5hex } from '../utils/utils.js'

/**
 * 判断 URL 是否为危险协议
 * @param {string} url
 */
export function isDangerousUrl(url) {
  if (!url) return false
  const lower = url.toLowerCase().trim()
  return DANGEROUS_URL_PROTOCOLS.some(proto => lower.startsWith(proto))
}

/**
 * 判断路径是否为原站内部资源
 * @param {string} path
 */
export function isSourceAssetPath(path) {
  if (!path) return false
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => path.startsWith(prefix))
}

/**
 * 从原站文章详情数据提取所有关联信息
 * @param {object} sourcePost - 原站 post detail 返回数据
 * @param {string} sourceBlogPublicOrigin - 原站域名，用于相对化
 * @returns {object}
 */
export function extractPostDependencies(sourcePost, sourceBlogPublicOrigin) {
  return {
    // A. 文章主体元信息
    title: sourcePost.title || '',
    excerpt: sourcePost.excerpt || sourcePost.smalltext || '',
    content: sourcePost.content || sourcePost.text || '',
    alias: sourcePost.alias || '',
    date: sourcePost.date || sourcePost.time || null,
    lastChangDate: sourcePost.lastChangDate || null,
    type: sourcePost.type,

    // 作者
    author: sourcePost.author || null,

    // 分类
    sort: sourcePost.sort || null,

    // 标签
    tags: sourcePost.tags || sourcePost.tag || [],

    // 地点
    mappointList: sourcePost.mappointList || [],

    // 封面
    coverImages: sourcePost.coverImages || sourcePost.cover || [],

    // B. 详情页推荐相关内容
    bangumiList: sourcePost.bangumiList || [],
    movieList: sourcePost.movieList || [],
    gameList: sourcePost.gameList || [],
    bookList: sourcePost.bookList || [],
    postList: sourcePost.postList || [],
    tweetList: sourcePost.tweetList || [],
    eventList: sourcePost.eventList || [],
    voteList: sourcePost.voteList || [],
    seriesSortList: sourcePost.seriesSortList || [],

    // C. 正文内强相关内容
    contentBangumiList: sourcePost.contentBangumiList || [],
    contentMovieList: sourcePost.contentMovieList || [],
    contentGameList: sourcePost.contentGameList || [],
    contentBookList: sourcePost.contentBookList || [],
    contentPostList: sourcePost.contentPostList || [],
    contentTweetList: sourcePost.contentTweetList || [],
    contentEventList: sourcePost.contentEventList || [],
    contentVoteList: sourcePost.contentVoteList || [],
    contentSeriesSortList: sourcePost.contentSeriesSortList || []
  }
}

/**
 * 从 HTML 正文中解析媒体资源
 * 返回需要登记的附件描述对象列表
 *
 * @param {string} html
 * @param {string} sourceBlogPublicOrigin
 * @returns {{ assets: object[], errors: string[] }}
 */
export function extractHtmlAssets(html, sourceBlogPublicOrigin) {
  const assets = []
  const errors = []

  if (!html) return { assets, errors }

  const $ = cheerio.load(html, { decodeEntities: false })

  const processUrl = (rawUrl, tag, attr) => {
    if (!rawUrl) return

    // 危险协议直接拒绝
    if (isDangerousUrl(rawUrl)) {
      errors.push(`发现危险 URL 协议，已拒绝：${rawUrl}`)
      return
    }

    // 归一化：绝对地址→相对路径
    const normalized = normalizeSourceUrl(rawUrl, sourceBlogPublicOrigin)

    if (normalized.startsWith('/') && isSourceAssetPath(normalized)) {
      // 原站内部资源
      const hash = computeSourcePathHash(normalized)
      assets.push({
        attachmentSourceType: 'remote',
        sourcePath: normalized,
        sourcePathHash: hash,
        importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
        originalUrl: rawUrl,
        tag,
        attr
      })
    } else if (
      normalized.startsWith('http://') ||
      normalized.startsWith('https://')
    ) {
      // 第三方外链
      const hash = computeExternalUrlHash(normalized)
      assets.push({
        attachmentSourceType: 'remote',
        externalUrl: normalized,
        externalUrlHash: hash,
        importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
        originalUrl: rawUrl,
        tag,
        attr
      })
    }
    // 已经是其他相对路径，忽略（如相对文章的锚点链接）
  }

  // img[src]
  $('img').each((_, el) => {
    processUrl($(el).attr('src'), 'img', 'src')
  })

  // video[src]、source[src]
  $('video, source').each((_, el) => {
    processUrl($(el).attr('src'), el.tagName, 'src')
  })

  // a[href] 只处理原站内部资源路径
  $('a').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (isDangerousUrl(href)) {
      errors.push(`发现危险链接，已拒绝：${href}`)
      return
    }
    const normalized = normalizeSourceUrl(href, sourceBlogPublicOrigin)
    if (normalized.startsWith('/') && isSourceAssetPath(normalized)) {
      const hash = computeSourcePathHash(normalized)
      assets.push({
        attachmentSourceType: 'remote',
        sourcePath: normalized,
        sourcePathHash: hash,
        importOrigin: ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED,
        originalUrl: href,
        tag: 'a',
        attr: 'href'
      })
    }
  })

  return { assets, errors }
}

/**
 * 计算原文内容的 sourceHash
 * 先对内容 JSON 做 URL 归一化后计算哈希
 * @param {object} payload
 */
export function computePayloadHash(payload) {
  return creatSha256Str(JSON.stringify(payload))
}
