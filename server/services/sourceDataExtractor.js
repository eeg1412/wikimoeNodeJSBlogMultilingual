const { extractFromHtml } = require('./htmlMediaExtractor')

function safeString(v) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function pickId(obj) {
  if (!obj) return null
  if (typeof obj === 'string') return obj
  if (obj._id) return String(obj._id)
  if (obj.id) return String(obj.id)
  return null
}

function mapIdList(list) {
  if (!Array.isArray(list)) return []
  const ids = []
  for (let i = 0; i < list.length; i++) {
    const id = pickId(list[i])
    if (id) ids.push(id)
  }
  return ids
}

function extractAuthor(post) {
  if (!post.author) return null
  if (typeof post.author === 'string') {
    return { sourceId: post.author, payload: null }
  }
  const a = post.author
  const sourceId = pickId(a)
  if (!sourceId) return null
  return {
    sourceId,
    payload: {
      nickname: safeString(a.nickname),
      description: safeString(a.description),
      photo: a.photo || null,
      cover: a.cover || null
    }
  }
}

function extractSort(post) {
  if (!post.sort) return null
  if (typeof post.sort === 'string') {
    return { sourceId: post.sort, payload: null, parentSourceId: null }
  }
  const s = post.sort
  const sourceId = pickId(s)
  if (!sourceId) return null
  return {
    sourceId,
    parentSourceId: pickId(s.parent),
    payload: {
      sortname: safeString(s.sortname),
      alias: safeString(s.alias),
      description: safeString(s.description),
      template: safeString(s.template),
      taxis: typeof s.taxis === 'number' ? s.taxis : 0
    }
  }
}

function extractTags(post) {
  if (!Array.isArray(post.tags)) return []
  return post.tags
    .map(function (t) {
      if (!t) return null
      if (typeof t === 'string') return { sourceId: t, payload: null }
      const sourceId = pickId(t)
      if (!sourceId) return null
      return {
        sourceId,
        payload: {
          tagname: safeString(t.tagname),
          lastusetime: t.lastusetime || null
        }
      }
    })
    .filter(Boolean)
}

function extractMappoints(post) {
  if (!Array.isArray(post.mappointList)) return []
  return post.mappointList
    .map(function (m) {
      if (!m) return null
      if (typeof m === 'string') return { sourceId: m, payload: null }
      const sourceId = pickId(m)
      if (!sourceId) return null
      return {
        sourceId,
        payload: {
          title: safeString(m.title),
          summary: safeString(m.summary),
          longitude: m.longitude || 0,
          latitude: m.latitude || 0,
          zIndex: m.zIndex || 0,
          status: typeof m.status === 'number' ? m.status : 0
        }
      }
    })
    .filter(Boolean)
}

function extractAttachmentObjects(list) {
  if (!Array.isArray(list)) return []
  return list
    .map(function (a) {
      if (!a) return null
      if (typeof a === 'string') return { sourceId: a, payload: null }
      const sourceId = pickId(a)
      if (!sourceId) return null
      return {
        sourceId,
        payload: {
          filename: safeString(a.filename),
          filepath: safeString(a.filepath),
          name: safeString(a.name),
          description: safeString(a.description),
          filesize: typeof a.filesize === 'number' ? a.filesize : 0,
          fileHash: safeString(a.fileHash),
          width: a.width || null,
          height: a.height || null,
          mimetype: safeString(a.mimetype),
          thumfor: safeString(a.thumfor),
          thumWidth: a.thumWidth || null,
          thumHeight: a.thumHeight || null,
          is360Panorama: !!a.is360Panorama,
          albumSourceId: pickId(a.album)
        }
      }
    })
    .filter(Boolean)
}

function extractRelatedEntity(list, translatableFields) {
  if (!Array.isArray(list)) return []
  return list
    .map(function (e) {
      if (!e) return null
      if (typeof e === 'string') {
        return {
          sourceId: e,
          payload: null,
          translatableFields: translatableFields
        }
      }
      const sourceId = pickId(e)
      if (!sourceId) return null
      // 拷贝整份 payload，剥离 mongo 内部字段
      const payload = Object.assign({}, e)
      delete payload._id
      delete payload.__v
      delete payload.createdAt
      delete payload.updatedAt
      return {
        sourceId,
        title: safeString(e.title || e.name),
        name: safeString(e.name),
        payload,
        translatableFields: translatableFields
      }
    })
    .filter(Boolean)
}

function extractVotes(list) {
  if (!Array.isArray(list)) return []
  return list
    .map(function (v) {
      if (!v) return null
      if (typeof v === 'string') return { sourceId: v, payload: null }
      const sourceId = pickId(v)
      if (!sourceId) return null
      const options = Array.isArray(v.options)
        ? v.options.map(function (o) {
            return {
              sourceOptionId: pickId(o) || safeString(o._id),
              title: safeString(o.title),
              sort: typeof o.sort === 'number' ? o.sort : 0
            }
          })
        : []
      return {
        sourceId,
        payload: {
          title: safeString(v.title),
          options,
          maxSelect: typeof v.maxSelect === 'number' ? v.maxSelect : 1,
          showResultAfter: !!v.showResultAfter,
          endTime: v.endTime || null,
          status: typeof v.status === 'number' ? v.status : 0
        }
      }
    })
    .filter(Boolean)
}

function extractRelatedPosts(list, type) {
  if (!Array.isArray(list)) return []
  return list
    .map(function (p) {
      if (!p) return null
      if (typeof p === 'string')
        return { sourceId: p, type: type, payload: null }
      const sourceId = pickId(p)
      if (!sourceId) return null
      return {
        sourceId,
        type: typeof p.type === 'number' ? p.type : type,
        payload: {
          title: safeString(p.title),
          excerpt: safeString(p.excerpt),
          alias: safeString(p.alias),
          date: p.date || null,
          status: typeof p.status === 'number' ? p.status : 0
        }
      }
    })
    .filter(Boolean)
}

/**
 * 将原站 detail 接口响应数据解析为导入器使用的依赖描述结构。
 * @param {object} post - fetchPostDetail 返回的原始文章对象
 */
function extractPostDependencies(post) {
  const htmlExtract = extractFromHtml(post.content || '')

  return {
    post: {
      sourceId: pickId(post),
      sourceAlias: safeString(post.alias) || null,
      type: Number(post.type),
      title: safeString(post.title),
      excerpt: safeString(post.excerpt),
      content: safeString(post.content),
      alias: safeString(post.alias) || null,
      date: post.date || null,
      lastChangDate: post.lastChangDate || null,
      template: safeString(post.template),
      code: safeString(post.code),
      editorVersion:
        typeof post.editorVersion === 'number' ? post.editorVersion : 5,
      seriesSortList: Array.isArray(post.seriesSortList)
        ? post.seriesSortList.slice()
        : [],
      contentSeriesSortList: Array.isArray(post.contentSeriesSortList)
        ? post.contentSeriesSortList.slice()
        : []
    },
    author: extractAuthor(post),
    sort: extractSort(post),
    tags: extractTags(post),
    mappoints: extractMappoints(post),
    coverAttachments: extractAttachmentObjects(post.coverImages),
    bangumis: extractRelatedEntity(post.bangumiList, ['title', 'summary']),
    movies: extractRelatedEntity(post.movieList, ['title', 'summary']),
    games: extractRelatedEntity(post.gameList, ['title', 'summary']),
    books: extractRelatedEntity(post.bookList, ['title', 'summary']),
    events: extractRelatedEntity(post.eventList, ['title', 'summary']),
    votes: extractVotes(post.voteList),
    relatedPosts: extractRelatedPosts(post.postList, 1),
    relatedTweets: extractRelatedPosts(post.tweetList, 2),
    contentBangumis: extractRelatedEntity(post.contentBangumiList, [
      'title',
      'summary'
    ]),
    contentMovies: extractRelatedEntity(post.contentMovieList, [
      'title',
      'summary'
    ]),
    contentGames: extractRelatedEntity(post.contentGameList, [
      'title',
      'summary'
    ]),
    contentBooks: extractRelatedEntity(post.contentBookList, [
      'title',
      'summary'
    ]),
    contentEvents: extractRelatedEntity(post.contentEventList, [
      'title',
      'summary'
    ]),
    contentVotes: extractVotes(post.contentVoteList),
    contentPosts: extractRelatedPosts(post.contentPostList, 1),
    contentTweets: extractRelatedPosts(post.contentTweetList, 2),
    htmlExtract
  }
}

module.exports = {
  extractPostDependencies,
  // 内部函数导出以便单元测试
  _pickId: pickId,
  _mapIdList: mapIdList
}
