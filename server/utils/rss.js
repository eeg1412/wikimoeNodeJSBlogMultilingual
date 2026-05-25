const Feed = require('feed').Feed
const postUtils = require('../mongodb/utils/posts')
const utils = require('./utils')
const fs = require('fs')
const path = require('path')
const {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('./language')
const languageSettingsService = require('../api/multilingual-admin/services/languageSettingsService')
const {
  getSourceSeoSettings,
  normalizeSiteUrl
} = require('./sourceSeoSettings')
const rssCacheFolder = './seo/rss'

const LANGUAGE_RSS_SETTING_NAMES = [
  'siteEnableRss',
  'siteRssMaxCount',
  'siteRssTweetTitleType',
  'siteShowRssInFooter'
]

const SOURCE_ASSET_PATH_PREFIXES = [
  '/content/',
  '/upload/',
  '/ucloudImg/',
  '/up_works/',
  '/web_demo/'
]

const MULTILINGUAL_ASSET_PATH_PREFIX = '/multilingual-assets/'

function pickLanguageRssSettings(values) {
  const rssSettings = {}
  LANGUAGE_RSS_SETTING_NAMES.forEach(name => {
    rssSettings[name] = values[name]
  })

  return rssSettings
}

async function getLanguageSeoSettings(languageCode) {
  const sourceSettings = await getSourceSeoSettings()
  const languageSettings =
    await languageSettingsService.getLanguageSettings(languageCode)
  const values = languageSettings.values || {}
  const configuredNames = languageSettings.configuredNames || []
  const languageValues = {}
  configuredNames.forEach(name => {
    languageValues[name] = values[name]
  })
  const languageRssSettings = pickLanguageRssSettings(values)
  const siteUrl = normalizeSiteUrl(sourceSettings.siteUrl)

  return {
    ...sourceSettings,
    ...languageValues,
    ...languageRssSettings,
    siteUrl,
    sourceSiteUrl: sourceSettings.siteUrl || '',
    siteTimeZone: sourceSettings.siteTimeZone || ''
  }
}

function getPostUrl(siteUrl, languageCode, post) {
  const pathType = post.type === 3 ? 'page' : 'post'
  return `${siteUrl}/${languageCode}/${pathType}/${post.alias || post._id}`
}

function isAbsoluteUrl(value) {
  return /^(https?:)?\/\//i.test(value)
}

function buildAbsoluteUrl(baseUrl, value) {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  if (text.startsWith('data:') || text.startsWith('blob:')) {
    return text
  }

  if (text.startsWith('//')) {
    return `https:${text}`
  }

  if (/^https?:\/\//i.test(text)) {
    return text
  }

  const normalizedBaseUrl = normalizeSiteUrl(baseUrl)
  if (!normalizedBaseUrl) {
    return text
  }

  const pathText = text.startsWith('/') ? text : `/${text}`
  return `${normalizedBaseUrl}${pathText}`
}

function isSourceAssetPath(value) {
  return SOURCE_ASSET_PATH_PREFIXES.some(prefix => {
    return value.startsWith(prefix)
  })
}

function getAttachmentPath(attachment, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = String(attachment?.[fieldName] || '').trim()
    if (value) {
      return value
    }
  }

  return ''
}

function getAssetBaseUrl(siteSettings, attachment, assetPath) {
  const value = String(assetPath || '').trim()
  if (!value || isAbsoluteUrl(value)) {
    return ''
  }

  if (value.startsWith(MULTILINGUAL_ASSET_PATH_PREFIX)) {
    return siteSettings.siteUrl
  }

  if (attachment?.mediaMode === 'local') {
    return siteSettings.siteUrl
  }

  if (
    value === attachment?.localFilepath ||
    value === attachment?.localThumbnailPath
  ) {
    return siteSettings.siteUrl
  }

  if (isSourceAssetPath(value)) {
    return siteSettings.sourceSiteUrl || siteSettings.siteUrl
  }

  return siteSettings.sourceSiteUrl || siteSettings.siteUrl
}

function getMediaUrl(siteSettings, attachment, fieldNames) {
  const assetPath = getAttachmentPath(attachment, fieldNames)
  if (!assetPath) {
    return ''
  }

  return buildAbsoluteUrl(
    getAssetBaseUrl(siteSettings, attachment, assetPath),
    assetPath
  )
}

function getContentAssetBaseUrl(siteSettings, assetPath) {
  const value = String(assetPath || '').trim()
  if (!value || value.startsWith('#') || isAbsoluteUrl(value)) {
    return ''
  }

  if (value.startsWith('data:') || value.startsWith('blob:')) {
    return ''
  }

  if (value.startsWith(MULTILINGUAL_ASSET_PATH_PREFIX)) {
    return siteSettings.siteUrl
  }

  if (isSourceAssetPath(value)) {
    return siteSettings.sourceSiteUrl || siteSettings.siteUrl
  }

  return ''
}

function appendQuerySuffix(url, suffix) {
  if (!url || !suffix) {
    return url
  }

  const hashIndex = url.indexOf('#')
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const joiner = urlWithoutHash.includes('?') ? '&' : '?'
  return `${urlWithoutHash}${joiner}${suffix}${hash}`
}

function normalizeContentAssetUrls(content, siteSettings) {
  const html = String(content || '')
  if (!html) {
    return html
  }

  return html.replace(
    /(\s(?:src|href|poster)\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (match, prefix, quotedValue, doubleQuotedValue, singleQuotedValue) => {
      const rawValue =
        typeof doubleQuotedValue === 'string'
          ? doubleQuotedValue
          : singleQuotedValue
      const baseUrl = getContentAssetBaseUrl(siteSettings, rawValue)
      if (!baseUrl) {
        return match
      }

      const normalizedValue = buildAbsoluteUrl(
        baseUrl,
        rawValue
      )
      if (!normalizedValue || normalizedValue === rawValue) {
        return match
      }

      const quote = quotedValue.startsWith('"') ? '"' : "'"
      return `${prefix}${quote}${normalizedValue}${quote}`
    }
  )
}

async function cleanLanguageRss(languageCode) {
  const rssPath = path.join(rssCacheFolder, languageCode)
  try {
    const files = await fs.promises.readdir(rssPath)
    for (const file of files) {
      await fs.promises.unlink(path.join(rssPath, file))
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

exports.updateRSS = async (type, languageCodeInput = DEFAULT_LANGUAGE_CODE) => {
  const prmise = new Promise(async (resolve, reject) => {
    const languageCode = normalizeLanguageCode(languageCodeInput)
    if (!languageCode) {
      return reject(new Error('LANGUAGE_CODE_UNSUPPORTED'))
    }

    console.info(`creating rss:${languageCode}:${type}`)
    const siteSettings = await getLanguageSeoSettings(languageCode)
    const {
      siteEnableRss,
      siteRssMaxCount,
      siteRssTweetTitleType,
      siteTitle,
      siteUrl,
      siteDescription,
      siteLogo,
      siteFavicon,
      siteTimeZone
    } = siteSettings
    if (siteEnableRss !== true) {
      console.info(`rss:${languageCode}:${type} not enabled`)
      return resolve(null)
    }
    if (!siteUrl) {
      console.warn(`rss:${languageCode}:${type} siteUrl is empty or invalid`)
      await cleanLanguageRss(languageCode)
      return resolve(null)
    }

    const params = {
      languageCode,
      recordKind: 'translation',
      status: 1,
      // type是1或者2
      type: {
        $in: [1, 2]
      }
    }
    if (type === 'blog') {
      params.type = 1
    }
    if (type === 'tweet') {
      params.type = 2
    }
    const sort = {
      date: -1,
      _id: -1
    }
    const size = parseInt(siteRssMaxCount) || 1
    const filter =
      '-voteList -bangumiList -movieList -bookList -eventList -gameList -postList -tweetList -seriesSortList -code -editorVersion'
    const data = await postUtils
      .findPage(params, sort, 1, size, filter, {
        authorFilter: 'nickname',
        voteFliter:
          '_id endTime maxSelect showResultAfter title options.title options._id'
      })
      .then(res => {
        return res
      })
      .catch(err => {
        console.error(err)
        return null
      })
    if (!data) {
      return reject('no data')
    }
    const { list } = data
    let feedLinksRss = `${siteUrl}/${languageCode}/rss`
    if (type === 'blog') {
      feedLinksRss = `${siteUrl}/${languageCode}/rss/blog`
    } else if (type === 'tweet') {
      feedLinksRss = `${siteUrl}/${languageCode}/rss/tweet`
    }
    const feed = new Feed({
      title: siteTitle,
      description: siteDescription,
      id: siteUrl,
      link: `${siteUrl}/${languageCode}`,
      language: languageCode,
      image: buildAbsoluteUrl(siteUrl, siteLogo),
      favicon: buildAbsoluteUrl(siteUrl, siteFavicon),
      generator: 'wikimoeBlog',
      feedLinks: {
        rss: feedLinksRss
      }
    })
    list.forEach(item => {
      const { title, excerpt, content, _id, author, type, date, alias } = item
      const link = getPostUrl(siteUrl, languageCode, item)
      // 注意如果用到作者的话，务必在更改作者的时候更新rss！！！
      let newTitle = title
      let newContent = normalizeContentAssetUrls(content, siteSettings)
      if (type === 2) {
        if (siteRssTweetTitleType === 2) {
          // 推文标题类型为日期
          const dateStr = utils.formatDateByTimezone(
            date,
            siteTimeZone,
            'YYYY年MM月DD日 HH:mm:ss'
          )
          newTitle = `发布于 ${dateStr} 的推文`
        } else {
          // 将excerpt去掉换行符设定为newTitle，最大长度为50，超过50的部分用...代替
          newTitle = utils.getTitleFromText(excerpt)
        }

        newContent = `<p>${excerpt}</p>`
        // 换行符替换为br标签
        newContent = newContent.replace(/\n/g, '<br/>')

        let contentSeriesSortList = item.contentSeriesSortList
        if (!contentSeriesSortList || contentSeriesSortList.length <= 0) {
          contentSeriesSortList = ['media', 'event', 'vote', 'post', 'acgn']
        }

        contentSeriesSortList.forEach(typeName => {
          if (typeName === 'media') {
            // 遍历coverImages，以图片形式展示
            const coverImages = item.coverImages || []
            coverImages.forEach(image => {
              const imageIsVideo = String(image.mimetype || '').startsWith(
                'video'
              )
              const createdAt = new Date(image.createdAt).getTime()
              if (imageIsVideo) {
                const videoUrl = getMediaUrl(siteSettings, image, [
                  'localFilepath',
                  'filepath',
                  'remoteFilepath'
                ])
                const posterUrl = appendQuerySuffix(
                  getMediaUrl(siteSettings, image, [
                    'localThumbnailPath',
                    'thumfor'
                  ]),
                  createdAt
                )
                newContent += `<p><video src="${videoUrl}" controls="controls" playsinline="true" preload="none" muted="muted" poster="${posterUrl}" loop="loop" style="border-radius: 10px; margin-bottom: 10px; max-width: 100%;"></video></p>`
              } else {
                const imageUrl = getMediaUrl(siteSettings, image, [
                  'localThumbnailPath',
                  'thumfor',
                  'localFilepath',
                  'filepath',
                  'remoteFilepath'
                ])
                newContent += `<p><img src="${imageUrl}" alt="${
                  image.name
                }" style="border-radius: 10px; margin-bottom: 10px; max-width: 100%;" /></p>`
              }
            })
          } else if (typeName === 'event') {
            // 遍历contentEventList，以链接形式展示
            const contentEventList = item.contentEventList || []
            contentEventList.forEach(event => {
              newContent += `<p><a href="${link}#event-content-${event._id}-${item._id}" target="_blank">活动：${event.title}</a></p>`
            })
          } else if (typeName === 'vote') {
            // 遍历contentVoteList，以链接形式展示
            const contentVoteList = item.contentVoteList || []
            contentVoteList.forEach(vote => {
              newContent += `<p><a href="${link}#vote-item-content-${vote._id}-${item._id}" target="_blank">投票：${vote.title}</a></p>`
            })
          } else if (typeName === 'post') {
            // 遍历contentPostList，以链接形式展示
            const contentPostList = item.contentPostList || []
            contentPostList.forEach(post => {
              newContent += `<p><a href="${getPostUrl(
                siteUrl,
                languageCode,
                post
              )}" target="_blank">博文：${post.title}</a></p>`
            })
          } else if (typeName === 'tweet') {
            // 遍历contentTweetList，以链接形式展示
            const contentTweetList = item.contentTweetList || []
            contentTweetList.forEach(tweet => {
              newContent += `<p><a href="${getPostUrl(
                siteUrl,
                languageCode,
                tweet
              )}" target="_blank">推文：${utils.limitStr(
                tweet.excerpt,
                20
              )}</a></p>`
            })
          } else if (typeName === 'acgn') {
            // 遍历contentBangumiList，以链接形式展示
            const contentBangumiList = item.contentBangumiList || []
            contentBangumiList.forEach(bangumi => {
              newContent += `<p><a href="${link}#ent-title-content-${bangumi._id}-${item._id}" target="_blank">番剧：${bangumi.title}</a></p>`
            })
            // 遍历contentMovieList，以链接形式展示
            const contentMovieList = item.contentMovieList || []
            contentMovieList.forEach(movie => {
              newContent += `<p><a href="${link}#ent-title-content-${movie._id}-${item._id}" target="_blank">电影：${movie.title}</a></p>`
            })
            // 遍历contentBookList，以链接形式展示
            const contentBookList = item.contentBookList || []
            contentBookList.forEach(book => {
              newContent += `<p><a href="${link}#ent-title-content-${book._id}-${item._id}" target="_blank">书籍：${book.title}</a></p>`
            })
            // 遍历contentGameList，以链接形式展示
            const contentGameList = item.contentGameList || []
            contentGameList.forEach(game => {
              newContent += `<p><a href="${link}#ent-title-content-${game._id}-${item._id}" target="_blank">游戏：${game.title}</a></p>`
            })
          }
        })
      }
      feed.addItem({
        title: newTitle,
        id: link,
        link: link,
        description: newContent,
        date: new Date(item.date)
      })
    })
    const rssXML = feed.rss2()
    // 写入文件
    const rssFolder = path.join(rssCacheFolder, languageCode)
    await fs.promises.mkdir(rssFolder, { recursive: true })
    const rssPath = path.join(rssFolder, `${type}.xml`)
    await fs.promises.writeFile(rssPath, rssXML)
    resolve(rssXML)
    console.info(`rss created:${languageCode}:${type}`)
  })
  return prmise
}

exports.reflushLanguageRSS = async languageCodeInput => {
  const languageCode = normalizeLanguageCode(languageCodeInput)
  if (!languageCode) {
    throw new Error('LANGUAGE_CODE_UNSUPPORTED')
  }

  await utils.executeInLock(`reflushRSS:${languageCode}`, async () => {
    const siteSettings = await getLanguageSeoSettings(languageCode)
    const { siteEnableRss } = siteSettings
    if (siteEnableRss !== true) {
      console.info(`rss not enabled delete ${languageCode} rss files`)
      await cleanLanguageRss(languageCode)
      return null
    }
    const promiseArray = [
      this.updateRSS('all', languageCode),
      this.updateRSS('blog', languageCode),
      this.updateRSS('tweet', languageCode)
    ]
    await Promise.all(promiseArray)
      .then(res => {
        return res
      })
      .catch(err => {
        console.error(err)
        return null
      })
  })
}

exports.reflushRSS = async () => {
  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    await this.reflushLanguageRSS(languageCode)
  }
}

exports.getRSS = (type, res) => {
  // 校验type只能是all、blog、tweet
  if (!['all', 'blog', 'tweet'].includes(type)) {
    res.status(404).send('Not found')
    return
  }
  const filePath = `${rssCacheFolder}/${type}.xml`
  fs.access(filePath, fs.constants.F_OK, err => {
    if (err) {
      res.status(404).send('File not found')
      return
    }
    // 设置正确的Content-Type
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    const readStream = fs.createReadStream(filePath)
    readStream.pipe(res)
  })
}
