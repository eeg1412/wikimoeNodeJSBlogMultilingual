export const TEMPLATE_SOURCE_VERSION = 'wikimoeToGithubPage-derived-2026-04-22'

export const PAGE_TYPE_CONFIG = Object.freeze({
  home: '首页列表',
  postList: '文章列表',
  postDetail: '文章详情',
  entityCloud: '分类或标签云',
  mediaCollection: '番剧/书籍/游戏/剧场版列表',
  footprints: '足迹地图'
})

export const POST_CARD_FIELDS = Object.freeze([
  'url',
  'kind',
  'type',
  'typeLabel',
  'authorName',
  'dateText',
  'dateTime',
  'sortName',
  'sortUrl',
  'title',
  'excerpt',
  'tweetHtml',
  'mediaItems',
  'galleryKey',
  'inlineSectionsHtml',
  'tags',
  'mappoints',
  'coverImage'
])

export const FOOTPRINT_MARKER_FIELDS = Object.freeze([
  '_id',
  'title',
  'summary',
  'longitude',
  'latitude',
  'zIndex',
  'postCount',
  'href'
])
