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
  const siteUrl = normalizeSiteUrl(sourceSettings.siteUrl)

  return {
    ...sourceSettings,
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
