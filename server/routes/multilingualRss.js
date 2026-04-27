var express = require('express')
var router = express.Router({ mergeParams: true })
const { createReadStream, constants } = require('fs')
const { access } = require('fs').promises
const path = require('path')
const rsslogUtils = require('../mongodb/utils/rsslogs')
const utils = require('../utils/utils')
const { normalizeLanguageCode } = require('../utils/language')

const RSS_TYPE_FILE_MAP = {
  all: 'all.xml',
  blog: 'blog.xml',
  tweet: 'tweet.xml'
}

function getRssType(req) {
  if (req.path === '/' || req.path === '') {
    return 'all'
  }

  const type = req.path.replace(/^\//, '')
  return RSS_TYPE_FILE_MAP[type] ? type : null
}

router.get(['/', '/blog', '/tweet'], async function (req, res) {
  const languageCode = normalizeLanguageCode(req.params.code)
  if (!languageCode) {
    res.status(404).send('Not found')
    return
  }

  const type = getRssType(req)
  if (!type) {
    res.status(404).send('Not found')
    return
  }

  const rssPath = path.join(
    __dirname,
    '..',
    'seo',
    'rss',
    languageCode,
    RSS_TYPE_FILE_MAP[type]
  )

  try {
    await access(rssPath, constants.R_OK)
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    createReadStream(rssPath).pipe(res)
  } catch (error) {
    res.status(404).send('rss not found')
    return
  }

  const ip = utils.getUserIp(req)
  const rsslogParams = {
    ip,
    ipInfo: await utils.IP2LocationUtils(ip, null, null, false),
    deviceInfo: utils.deviceUAInfoUtils(req),
    rssPath: req.originalUrl,
    languageCode
  }
  let uaStr = req.headers['user-agent'] || ''
  if (uaStr.length > 1000) {
    uaStr = uaStr.substring(0, 1000)
  }
  const uaUrl = uaStr.match(/(https?:\/\/[^\s;)]+)/g)
  if (uaUrl && uaUrl.length > 0) {
    rsslogParams.reader = uaUrl[0]
  }
  await rsslogUtils.save(rsslogParams)
})

module.exports = router
