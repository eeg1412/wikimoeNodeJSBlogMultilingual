import { limitStr } from '@/utils/utils'

const DEFAULT_RELATION_SORT = ['event', 'vote', 'post', 'tweet', 'acgn']

function getRelationFieldName(prefix, fieldName) {
  if (!prefix) {
    return fieldName
  }

  return `${prefix}${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}`
}

function getRelationList(post, prefix, fieldName) {
  const targetFieldName = getRelationFieldName(prefix, fieldName)
  const targetList = post?.[targetFieldName]
  if (!Array.isArray(targetList)) {
    return []
  }

  return targetList
}

function appendRelationItems(targetList, sourceList, type, formatter) {
  sourceList.forEach(item => {
    const nextItem = formatter ? formatter(item) : item
    targetList.push({
      ...nextItem,
      type
    })
  })
}

export function buildMergedRelationContentList(post, prefix = '') {
  const relationSortFieldName = prefix
    ? `${prefix}SeriesSortList`
    : 'seriesSortList'
  const relationSortList = Array.isArray(post?.[relationSortFieldName])
    ? post[relationSortFieldName]
    : []
  const finalRelationSortList = relationSortList.length
    ? relationSortList
    : DEFAULT_RELATION_SORT

  const bookList = getRelationList(post, prefix, 'bookList')
  const bangumiList = getRelationList(post, prefix, 'bangumiList')
  const movieList = getRelationList(post, prefix, 'movieList')
  const gameList = getRelationList(post, prefix, 'gameList')
  const postList = getRelationList(post, prefix, 'postList')
  const tweetList = getRelationList(post, prefix, 'tweetList')
  const eventList = getRelationList(post, prefix, 'eventList')
  const voteList = getRelationList(post, prefix, 'voteList')

  const mergedList = []
  finalRelationSortList.forEach(item => {
    if (item === 'event' && eventList.length > 0) {
      appendRelationItems(mergedList, eventList, 'event')
      return
    }

    if (item === 'vote' && voteList.length > 0) {
      appendRelationItems(mergedList, voteList, 'vote')
      return
    }

    if (item === 'post' && postList.length > 0) {
      appendRelationItems(mergedList, postList, 'post')
      return
    }

    if (item === 'tweet' && tweetList.length > 0) {
      appendRelationItems(mergedList, tweetList, 'tweet', relationItem => {
        return {
          ...relationItem,
          title: limitStr(relationItem.excerpt || relationItem.title || '', 20)
        }
      })
      return
    }

    if (item !== 'acgn') {
      return
    }

    if (bangumiList.length > 0) {
      appendRelationItems(mergedList, bangumiList, 'bangumi')
    }
    if (movieList.length > 0) {
      appendRelationItems(mergedList, movieList, 'movie')
    }
    if (bookList.length > 0) {
      appendRelationItems(mergedList, bookList, 'book')
    }
    if (gameList.length > 0) {
      appendRelationItems(mergedList, gameList, 'game')
    }
  })

  return mergedList
}

export function buildMergedDetailRelationList(post) {
  return buildMergedRelationContentList(post)
}

export function buildMergedRecommendContentList(post) {
  return buildMergedDetailRelationList(post)
}

export function buildMergedContentRelationList(post) {
  return buildMergedRelationContentList(post, 'content')
}

export function checkShowText(item) {
  if (Number(item?.status) === 0) {
    return '【状态:不显示】'
  }

  return ''
}

export function setMovieTitle(item) {
  const year = item?.year
  const month = item?.month
  const day = item?.day
  if (year && month && day) {
    return `【${year}年${month}月${day}日观看】`
  }

  return ''
}
