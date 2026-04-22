const cheerio = require('cheerio')

const { SOURCE_RESOURCE_PREFIXES } = require('../../../common/constants/app')
const {
  normalizeSourceUrl
} = require('../../../common/utils/sourceUrlNormalizer')

function isSourceRelativeResource(pathname) {
  for (const prefix of SOURCE_RESOURCE_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true
    }
  }

  return false
}

function buildDiscoveredMediaRecord(
  tagName,
  attributeName,
  originalValue,
  normalizedValue
) {
  return {
    tagName,
    attributeName,
    originalValue,
    normalizedValue,
    isSourceRelative:
      typeof normalizedValue === 'string' &&
      isSourceRelativeResource(normalizedValue),
    isExternal:
      typeof normalizedValue === 'string' &&
      /^https?:\/\//i.test(normalizedValue)
  }
}

function extractHtmlMedia(content, options) {
  const htmlContent = typeof content === 'string' ? content : ''
  const $ = cheerio.load(htmlContent, {
    decodeEntities: false
  })
  const discoveredMediaList = []
  const selectors = [
    { selector: 'img[src]', attribute: 'src' },
    { selector: 'video[src]', attribute: 'src' },
    { selector: 'source[src]', attribute: 'src' },
    { selector: 'a[href]', attribute: 'href' }
  ]

  for (const selectorConfig of selectors) {
    $(selectorConfig.selector).each(function () {
      const element = $(this)
      const originalValue = element.attr(selectorConfig.attribute)

      if (!originalValue) {
        return
      }

      const normalizedValue = normalizeSourceUrl(originalValue, options)
      element.attr(selectorConfig.attribute, normalizedValue)
      discoveredMediaList.push(
        buildDiscoveredMediaRecord(
          this.tagName,
          selectorConfig.attribute,
          originalValue,
          normalizedValue
        )
      )
    })
  }

  return {
    content: $.html(),
    mediaList: discoveredMediaList
  }
}

module.exports = {
  extractHtmlMedia,
  isSourceRelativeResource
}
