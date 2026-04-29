const { SitemapStream } = require('sitemap')
const { createWriteStream, createReadStream, constants } = require('fs')
const { access, mkdir, unlink } = require('fs').promises
const utils = require('./utils')
const postUtils = require('../mongodb/utils/posts')
const path = require('path')
const {
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('./language')
const languageSettingsService = require('../api/multilingual-admin/services/languageSettingsService')
const {
  getSourceSeoSettings,
  normalizeSiteUrl
} = require('./sourceSeoSettings')
const sitemapCacheFolder = './seo/sitemap'
const sitemapXslUrl = '/api/multilingual-asset/sitemap.xsl'

const LANGUAGE_SITEMAP_SETTING_NAMES = [
  'siteEnableSitemap',
  'siteShowSitemapInFooter'
]

function pickLanguageSitemapSettings(values) {
  const sitemapSettings = {}
  LANGUAGE_SITEMAP_SETTING_NAMES.forEach(name => {
    sitemapSettings[name] = values[name]
  })

  return sitemapSettings
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
  const languageSitemapSettings = pickLanguageSitemapSettings(values)
  const siteSettings = global.$globalConfig?.siteSettings || {}
  const siteUrl = normalizeSiteUrl(
    sourceSettings.siteUrl || siteSettings.siteUrl || languageValues.siteUrl
  )

  return {
    ...sourceSettings,
    ...siteSettings,
    ...languageValues,
    ...languageSitemapSettings,
    siteUrl
  }
}

function getPostSitemapUrl(languageCode, post) {
  const pathType = post.type === 3 ? 'page' : 'post'
  return `/${languageCode}/${pathType}/${post.alias || post._id}`
}

function getPostPriority(type) {
  if (type === 3) {
    return 0.8
  }

  if (type === 1) {
    return 0.5
  }

  return 0.3
}

exports.updateSitemap = async () => {
  const promise = new Promise(async (resolve, reject) => {
    console.info('creating sitemap')
    const siteSettings = global.$globalConfig?.siteSettings || {}
    const { siteUrl, siteEnableSitemap } = siteSettings
    if (siteEnableSitemap !== true) {
      console.info(`sitemap not enabled`)
      // 删除旧的sitemap
      // 检查 sitemapCacheFolder里的sitemap.xml是否存在，存在则删除
      const sitemapPath = path.join(sitemapCacheFolder, 'sitemap.xml')
      try {
        await access(sitemapPath)
        await unlink(sitemapPath)
      } catch (error) {
        if (error.code !== 'ENOENT') {
          // ENOENT 错误表示文件不存在，忽略这个错误
          return reject(error)
        }
        resolve()
      }
      resolve()
      return null
    }

    // 创建SitemapStream实例
    const sitemapStream = new SitemapStream({
      hostname: siteUrl,
      xslUrl: sitemapXslUrl
    })
    const writeStream = createWriteStream(
      path.join(sitemapCacheFolder, 'sitemap.xml')
    )
    sitemapStream.pipe(writeStream)
    writeStream.on('finish', () => {
      console.info('Sitemap has been written to sitemap.xml successfully.')
      resolve()
    })
    writeStream.on('error', err => {
      console.error(err)
      reject(err)
    })
    // 添加首页
    sitemapStream.write({
      url: '/',
      changefreq: 'always',
      priority: 1,
      lastmod: new Date()
    })
    // 添加页面
    const params = {
      status: 1,
      type: 3
    }
    const sort = {
      date: -1,
      _id: -1
    }
    const pageCursor = postUtils.findCursor(
      params,
      sort,
      '_id date alias lastChangDate date'
    )
    console.info('creating sitemap type is page')
    for await (const page of pageCursor) {
      sitemapStream.write({
        url: `/page/${page.alias || page._id}`,
        changefreq: 'always',
        priority: 0.8,
        lastmod: page.lastChangDate
      })
    }
    console.info('creating sitemap type is page done')
    // 添加博客
    params.type = 1
    const blogCursor = postUtils.findCursor(
      params,
      sort,
      '_id date alias lastChangDate date'
    )
    console.info('creating sitemap type is blog')
    for await (const blog of blogCursor) {
      sitemapStream.write({
        url: `/post/${blog.alias || blog._id}`,
        changefreq: 'always',
        priority: 0.5,
        lastmod: blog.lastChangDate
      })
    }
    console.info('creating sitemap type is blog done')
    // 添加推文
    params.type = 2
    const tweetCursor = postUtils.findCursor(
      params,
      sort,
      '_id date alias lastChangDate date'
    )
    console.info('creating sitemap type is tweet')
    for await (const tweet of tweetCursor) {
      sitemapStream.write({
        url: `/post/${tweet.alias || tweet._id}`,
        changefreq: 'always',
        priority: 0.3,
        lastmod: tweet.lastChangDate
      })
    }
    console.info('creating sitemap type is tweet done')
    // 结束
    sitemapStream.end()
    console.info('sitemap done')
  })
  return promise
}

exports.reflushSitemap = async () => {
  await utils.executeInLock('reflushSitemap', async () => {
    for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
      await this.reflushLanguageSitemap(languageCode)
    }
  })
}

exports.updateLanguageSitemap = async languageCodeInput => {
  const languageCode = normalizeLanguageCode(languageCodeInput)
  if (!languageCode) {
    throw new Error('LANGUAGE_CODE_UNSUPPORTED')
  }

  const siteSettings = await getLanguageSeoSettings(languageCode)
  const { siteUrl, siteEnableSitemap } = siteSettings
  const sitemapFolder = path.join(sitemapCacheFolder, languageCode)
  const sitemapPath = path.join(sitemapFolder, 'sitemap.xml')

  if (siteEnableSitemap !== true) {
    try {
      await access(sitemapPath)
      await unlink(sitemapPath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    return null
  }
  if (!siteUrl) {
    console.warn(`sitemap:${languageCode} siteUrl is empty or invalid`)
    try {
      await access(sitemapPath)
      await unlink(sitemapPath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
    return null
  }

  await mkdir(sitemapFolder, { recursive: true })

  return new Promise(async (resolve, reject) => {
    console.info(`creating sitemap:${languageCode}`)
    const sitemapStream = new SitemapStream({
      hostname: siteUrl,
      xslUrl: sitemapXslUrl
    })
    const writeStream = createWriteStream(sitemapPath)
    sitemapStream.pipe(writeStream)
    writeStream.on('finish', () => {
      console.info(`sitemap created:${languageCode}`)
      resolve()
    })
    writeStream.on('error', err => {
      console.error(err)
      reject(err)
    })

    sitemapStream.write({
      url: `/${languageCode}`,
      changefreq: 'always',
      priority: 1,
      lastmod: new Date()
    })

    const params = {
      languageCode,
      recordKind: 'translation',
      status: 1,
      type: {
        $in: [1, 2, 3]
      }
    }
    const sort = {
      date: -1,
      _id: -1
    }
    const postCursor = postUtils.findCursor(
      params,
      sort,
      '_id type alias lastChangDate date'
    )

    try {
      for await (const post of postCursor) {
        sitemapStream.write({
          url: getPostSitemapUrl(languageCode, post),
          changefreq: 'always',
          priority: getPostPriority(post.type),
          lastmod: post.lastChangDate || post.date
        })
      }
      sitemapStream.end()
    } catch (error) {
      sitemapStream.end()
      reject(error)
    }
  })
}

exports.reflushLanguageSitemap = async languageCodeInput => {
  const languageCode = normalizeLanguageCode(languageCodeInput)
  if (!languageCode) {
    throw new Error('LANGUAGE_CODE_UNSUPPORTED')
  }

  await utils.executeInLock(`reflushSitemap:${languageCode}`, async () => {
    await this.updateLanguageSitemap(languageCode)
  })
}

exports.getSitemap = async (req, res) => {
  const sitemapPath = path.join(sitemapCacheFolder, 'sitemap.xml')
  try {
    await access(sitemapPath, constants.R_OK)
    const readStream = createReadStream(sitemapPath)
    res.setHeader('Content-Type', 'application/xml')
    readStream.pipe(res)
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).send('sitemap not found')
    } else {
      res.status(500).send('server error')
    }
  }
}

exports.getLanguageSitemap = async (req, res) => {
  const languageCode = normalizeLanguageCode(req.params.code)
  if (!languageCode) {
    res.status(404).send('sitemap not found')
    return
  }

  const sitemapPath = path.join(sitemapCacheFolder, languageCode, 'sitemap.xml')
  try {
    await access(sitemapPath, constants.R_OK)
    const readStream = createReadStream(sitemapPath)
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    readStream.pipe(res)
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).send('sitemap not found')
    } else {
      res.status(500).send('server error')
    }
  }
}
